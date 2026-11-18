import { ruleConfig, type RuleConfig } from '../alerts/filters';
import { metricConfig, type MetricConfig } from '../alerts/metric-rules';
import { waitingForSession, waitingForUser } from '../alerts/import-state';
import { scrub } from '../privacy';

export const sentryRuleKinds = ['rules', 'metric_alerts', 'workflows', 'detectors'];

type Condition = { path: string; reason: string };
export type SourceDestination = { kind: string; id: string | null; path: string };
type Settings = {
  kinds: ('new_issue' | 'regression' | 'spike' | 'metric')[];
  config: RuleConfig | MetricConfig;
  windowMs: number;
  threshold: number;
};
export type AlertProposal = {
  name: string;
  location: string;
  sourceKind: string;
  monitorLocation?: string;
  settings: Settings | null;
  destinations: SourceDestination[];
  omissions: Condition[];
  waiting: string | null;
  enabled: false;
};

const label = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() && value.length <= 200 && !/[\x00-\x1f\x7f]/.test(value) ? scrub(value).trim() : fallback;
const id = (value: unknown) => typeof value === 'string' && value.length > 0 && value.length <= 200
  ? value : Number.isSafeInteger(value) ? String(value) : null;
const minutes = (value: unknown) => {
  if (Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= 1440) return Number(value);
  if (typeof value !== 'string') return null;
  const match = /^(\d+)([mhdw])$/.exec(value);
  if (!match) return null;
  const scale = { m: 1, h: 60, d: 1440, w: 10080 };
  const n = Number(match[1]) * scale[match[2] as keyof typeof scale];
  return n > 0 && n <= 1440 ? n : null;
};
const number = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value
  : typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;

function destination(action: any, path: string): SourceDestination {
  const key = typeof action?.id === 'string' ? action.id.split('.').at(-1) : '';
  const type = label(action?.type || key, 'unknown');
  const service = type.toLowerCase();
  const target = String(action?.targetType ?? action?.config?.targetType ?? '').toLowerCase();
  const kind = ['teams', 'team'].includes(target) ? 'team' : ['user', 'member', 'users'].includes(target) ? 'member' : 'email';
  if (['email', 'notifyemailaction', 'notifyeventaction', 'notifyeventserviceaction'].includes(service) && (service === 'email' || service === 'notifyemailaction')) {
    return { kind, id: id(action.targetIdentifier ?? action.config?.targetIdentifier), path };
  }
  const names: [string, string][] = [['slack', 'Slack'], ['pagerduty', 'PagerDuty'], ['opsgenie', 'Opsgenie'], ['webhook', 'webhook']];
  return { kind: names.find(([prefix]) => service.includes(prefix))?.[1] ?? type, id: null, path };
}

function issueRule(data: any, omit: (path: string, reason: string) => void): Settings | null {
  if (!Array.isArray(data.conditions) || !Array.isArray(data.filters) || !Array.isArray(data.actions)) throw new Error('Issue rule conditions, filters and actions must be arrays');
  const filters: RuleConfig['filters'] = {};
  if (data.environment !== undefined && data.environment !== null) filters.environment = data.environment;
  let kinds: Settings['kinds'] = [], windowMs = 60000, threshold = 2;
  let metric: RuleConfig['metric'] = 'count';
  if (!data.conditions.length || data.conditions.length > 1 && data.actionMatch !== 'any') omit('/actionMatch', 'Unsupported combination of issue conditions');
  if (data.filters.length > 1 && data.filterMatch !== 'all') omit('/filterMatch', 'Unsupported combination of issue filters');
  for (const [index, condition] of data.conditions.entries()) {
    const name = condition?.id?.split?.('.').at(-1);
    const path = '/conditions/' + index;
    if (name === 'FirstSeenEventCondition') kinds.push('new_issue');
    else if (name === 'RegressionEventCondition') kinds.push('regression');
    else if (['EventFrequencyCondition', 'EventUniqueUserFrequencyCondition'].includes(name) && data.conditions.length === 1) {
      const interval = minutes(condition.interval);
      const limit = number(condition.value);
      const users = name === 'EventUniqueUserFrequencyCondition';
      if (!interval || !Number.isSafeInteger(limit) || limit < (users ? 2 : 1) || limit > (users ? 10000 : 9999)) {
        omit(path, 'Unsupported frequency threshold or window');
        continue;
      }
      kinds.push('spike');
      metric = users ? 'users' : 'count';
      windowMs = interval * 60000;
      threshold = users ? limit : limit + 1;
    } else omit(path, 'Unsupported issue condition: ' + label(name, 'unknown'));
  }
  const operators = { eq: 'eq', ne: 'ne', co: 'contains', nc: 'not_contains', sw: 'starts_with', ew: 'ends_with', is: 'is_set', ns: 'not_set' } as const;
  for (const [index, filter] of data.filters.entries()) {
    const name = filter?.id?.split?.('.').at(-1);
    const path = '/filters/' + index;
    if (name === 'TaggedEventFilter' && typeof filter.key === 'string' && Object.hasOwn(operators, filter.match)
      && !Object.hasOwn(filters.tags ?? {}, filter.key)) {
      const op = operators[filter.match as keyof typeof operators];
      const match = op === 'is_set' || op === 'not_set' ? { op } : { op, value: filter.value };
      filters.tags = { ...filters.tags, [filter.key]: match };
    } else if (name === 'LevelFilter' && !filters.level) {
      filters.level = filter.level;
      filters.levelMatch = filter.match;
    } else omit(path, 'Unsupported issue filter: ' + label(name, 'unknown'));
  }
  const actionIntervalMinutes = data.frequency === undefined ? undefined : number(data.frequency);
  const config = ruleConfig({ metric, filters, tagKeys: Object.keys(filters.tags ?? {}), ...actionIntervalMinutes === undefined ? {} : { actionIntervalMinutes } });
  kinds = [...new Set(kinds)].sort();
  return kinds.length ? { kinds, config, windowMs, threshold } : null;
}

function metricRule(data: any, path: string, omit: (path: string, reason: string) => void, triggers: any[] = data.triggers): Settings | null {
  const sourceAggregate = typeof data.aggregate === 'string' ? data.aggregate.trim() : '';
  const aggregate = ({ 'count()': 'count', 'count_unique(user)': 'users', 'count_unique(user.id)': 'users',
    'percentage(sessions_crashed, sessions)': 'crash_free_rate', 'crash_free_rate()': 'crash_free_rate', 'equation|100 - percentage(sessions_crashed, sessions)': 'crash_free_rate',
    'failure_rate()': 'failure_rate', 'count(session)': 'session_count', 'sum(session)': 'session_count',
    'p95(transaction.duration)': 'p95_duration' } as Record<string, string>)[sourceAggregate.replace(/,\s*/g, ', ')];
  if(data.comparisonDelta != null)omit(path+'/comparisonDelta','Unsupported change from a comparison period');
  if(data.thresholdPeriod != null && data.thresholdPeriod!==1)omit(path+'/thresholdPeriod','Unsupported consecutive threshold periods');
  const session = ['crash_free_rate', 'failure_rate', 'session_count'].includes(aggregate);
  const dataset = session ? 'sessions' : aggregate === 'p95_duration' ? 'transactions' : 'errors';
  if (!aggregate || data.dataset === 'sessions' && !session && aggregate !== 'count' || data.dataset === 'transactions' && dataset !== 'transactions') {
    omit(path + '/aggregate', 'Unsupported aggregate: ' + label(data.aggregate, 'unspecified'));
    return null;
  }
  const nativeAggregate = aggregate === 'count' && data.dataset === 'sessions' ? 'session_count' : aggregate;
  const nativeDataset = nativeAggregate === 'session_count' ? 'sessions' : dataset;
  if (data.eventTypes != null && (!Array.isArray(data.eventTypes) || data.eventTypes.some((type: unknown) =>
    !(nativeDataset === 'errors' ? ['error', 'default'] : nativeDataset === 'transactions' ? ['transaction'] : ['session']).includes(String(type))))) {
    omit(path + '/eventTypes', 'Unsupported metric event selection');
  }
  const query: MetricConfig['query'] = {}, filters: MetricConfig['filters'] = {};
  if (data.environment != null && data.environment !== '') filters.environment = data.environment;
  const terms = typeof data.query === 'string' ? data.query.trim().split(/\s+/).filter(Boolean) : [];
  const tags: NonNullable<MetricConfig['query']['tags']> = {};
  for (const term of terms) {
    if (term === 'event.type:error' && nativeDataset === 'errors') continue;
    const part = /^([a-zA-Z0-9_.-]+):([a-zA-Z0-9_.-]+)$/.exec(term);
    if (part?.[1] === 'environment' && (!filters.environment || filters.environment === part[2])) filters.environment = part[2];
    else if (part?.[1] === 'transaction' && nativeDataset === 'transactions' && !query.transaction) query.transaction = { op: 'eq', value: part[2] };
    else if (part?.[1].startsWith('tags.') && nativeDataset === 'errors' && !Object.hasOwn(tags, part[1].slice(5))) tags[part[1].slice(5)] = { op: 'eq', value: part[2] };
    else omit(path + '/query', 'Unsupported metric search filter');
  }
  if (data.query != null && typeof data.query !== 'string') omit(path + '/query', 'Unsupported metric search filter');
  if (Object.keys(tags).length) query.tags = tags;
  const window = minutes(data.timeWindow);
  if (!window) { omit(path + '/timeWindow', 'Unsupported metric window'); return null; }
  if (!Array.isArray(triggers) || !triggers.length) { omit('/triggers', 'A threshold trigger is required'); return null; }
  const direction = data.thresholdType === 0 || data.thresholdType === 'above' ? 'above'
    : data.thresholdType === 1 || data.thresholdType === 'below' ? 'below' : null;
  if (!direction) { omit(path + '/thresholdType', 'Unsupported threshold direction'); return null; }
  // Sentry's percentage of crashed sessions is the complement of crash-free rate.
  const complement = sourceAggregate.replace(/,\s*/g, ', ') === 'percentage(sessions_crashed, sessions)';
  const convert = (value: unknown) => complement ? 100 - number(value) : number(value);
  const config = metricConfig({ metric: 'aggregate', dataset: nativeDataset, aggregate: nativeAggregate, query, filters,
    thresholdType: complement ? direction === 'above' ? 'below' : 'above' : direction,
    triggers: triggers.map(trigger => ({ label: trigger?.label, alertThreshold: convert(trigger?.alertThreshold) })),
    resolveThreshold: data.resolveThreshold == null ? null : convert(data.resolveThreshold), tagKeys: Object.keys(tags) });
  return { kinds: ['metric'], config, windowMs: window * 60000, threshold: 2 };
}

export function mapAlert(kind: string, data: any, location: string, detector?: { data: any; location: string }): AlertProposal {
  const name = label(data.name, '');
  if (!id(data.id) || !name || name.length > 100) throw new Error('Invalid alert rule identity or name');
  if (kind === 'metric_alerts' && (typeof data.aggregate !== 'string' || !Array.isArray(data.triggers))) throw new Error('Metric alert aggregate and triggers are required');
  const omissions: Condition[] = [];
  const omit = (path: string, reason: string) => omissions.push({ path: path.startsWith('/collections/') ? path : location + path, reason });
  const destinations: SourceDestination[] = [];
  function actions(items: any, path: string) {
    if (items == null) return;
    if (!Array.isArray(items)) { omit(path, 'Invalid rule actions'); return; }
    for (const [i, action] of items.entries()) {
      const at = location + path + '/' + i;
      if (action?.status === 'disabled') { omit(at, 'Destination is disabled in the source'); continue; }
      destinations.push(destination(action, at));
    }
  }
  let settings: Settings | null = null;
  let sourceDisabled = data.enabled === false || data.status === 'disabled';
  try {
    if (kind === 'rules') {
      settings = issueRule(data, omit);
      actions(data.actions, '/actions');
    } else if (kind === 'metric_alerts') {
      settings = metricRule(data, '', omit);
      const lists = data.triggers.map((trigger: any) => trigger.actions ?? []);
      const different = lists.some((list: any) => JSON.stringify(list) !== JSON.stringify(lists[0]));
      if (different && lists.some((list: any) => list.length)) omit('/triggers', 'Destinations differ by threshold');
      data.triggers.forEach((trigger: any, i: number) => actions(trigger.actions, '/triggers/' + i + '/actions'));
    } else {
      const d = detector?.data ?? data;
      sourceDisabled ||= d.enabled === false;
      const detectorPath = detector?.location ?? location;
      const sources = d.dataSources;
      const query = Array.isArray(sources) && sources.length === 1 ? sources[0]?.queryObj?.snubaQuery : null;
      const conditions = d.conditionGroup?.conditions;
      const workflowConditions = data.triggers?.conditions;
      const workflowSupported = kind === 'detectors' ||
        Array.isArray(workflowConditions) && workflowConditions.length === 1 && workflowConditions[0]?.type === 'detector_changed'
        && [true, 'high', 2].includes(workflowConditions[0]?.conditionResult)
        && [true, 'high', 2].includes(workflowConditions[0]?.comparison);
      if (kind === 'workflows' && !detector) omit('/detectorIds', 'Linked monitor is missing');
      else if (!workflowSupported) omit('/triggers', 'Unsupported workflow trigger');
      else if (!query || !Array.isArray(conditions) || conditions.length !== 1 || conditions[0]?.type !== 'event_frequency_count') {
        omit(detectorPath + '/conditionGroup', 'Unsupported monitor condition');
      } else {
        const condition = conditions[0];
        const timeWindow = condition.comparison?.interval ?? (Number.isSafeInteger(query.timeWindow) && query.timeWindow % 60 === 0 ? query.timeWindow / 60 : null);
        settings = metricRule({ ...query, timeWindow, thresholdType: 'above' }, detectorPath + '/dataSources/0/queryObj/snubaQuery', omit,
          [{ label: 'critical', alertThreshold: condition.comparison?.value ?? condition.comparison }]);
      }
      if (kind === 'workflows') {
        actions(data.triggers?.actions, '/triggers/actions');
        if (!Array.isArray(data.actionFilters)) omit('/actionFilters', 'Workflow actions could not be reviewed');
        else data.actionFilters.forEach((group: any, i: number) => {
          if (!Array.isArray(group?.conditions) || group.conditions.length) omit('/actionFilters/' + i + '/conditions', 'Unsupported workflow delivery filter');
          actions(group?.actions, '/actionFilters/' + i + '/actions');
        });
      } else omit('/id', 'Monitor has no linked alert workflow');
    }
  } catch (error) {
    if (kind === 'rules' && (!Array.isArray(data.conditions) || !Array.isArray(data.filters) || !Array.isArray(data.actions))) throw error;
    omit('/id', error instanceof Error ? error.message : 'Unsupported rule settings');
  }
  if (sourceDisabled) omit('/enabled', 'Rule is disabled in the source');
  if (!settings && !omissions.length) omit('/id', 'Rule has no supported trigger');
  const config = settings?.config;
  const waiting = config?.metric === 'users' || config?.metric === 'aggregate' && config.aggregate === 'users'
    ? waitingForUser : config?.metric === 'aggregate' && config.dataset === 'sessions' ? waitingForSession : null;
  return { name, location, sourceKind: kind, ...(detector ? {monitorLocation:detector.location} : {}), destinations, omissions, settings, waiting, enabled: false };
}
