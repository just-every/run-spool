export type ScrubbingRule = {
  id: string;
  selector: string;
  pattern: 'credit_card' | 'ip_address' | 'email' | 'password' | 'auth_token' | 'us_ssn' | 'regex';
  regex?: string;
  method: 'remove' | 'mask' | 'hash' | 'replace';
  replacement?: string;
};

export type ScrubbingPolicy = {
  version: 1;
  sensitiveFields: string[];
  safeFields: string[];
  rules: ScrubbingRule[];
};

const patterns: [ScrubbingRule['pattern'], string][] = [
  ['credit_card', 'Credit card'], ['ip_address', 'IP address'], ['email', 'Email'],
  ['password', 'Password'], ['auth_token', 'Authentication token'],
  ['us_ssn', 'US Social Security number'], ['regex', 'Custom regular expression'],
];
const methods: [ScrubbingRule['method'], string][] = [
  ['remove', 'Remove'], ['mask', 'Mask'], ['hash', 'Hash'], ['replace', 'Replace'],
];

export function ScrubbingRuleRow({rule, index, disabled, onChange, onRemove, refusal}: {
  rule: ScrubbingRule; index: number; disabled: boolean; refusal?:string;
  onChange: (rule: ScrubbingRule) => void; onRemove: () => void;
}) {
  return <div className="callout" role="group" aria-label={`Scrubbing rule ${index + 1}`}>
    <h3>Rule {index + 1}</h3>
    <div className="form-grid">
      <label className="form-field">Rule selector
        <input aria-label="Rule selector" placeholder="$frame.vars.order_note" value={rule.selector} disabled={disabled}
          onChange={event => onChange({...rule, selector: event.target.value})}/>
      </label>
      <label className="form-field">Rule pattern
        <select aria-label="Rule pattern" value={rule.pattern} disabled={disabled} onChange={event => {
          const {regex, ...rest} = rule;
          const pattern = event.target.value as ScrubbingRule['pattern'];
          onChange({...rest, pattern, ...(pattern === 'regex' ? {regex: regex ?? ''} : {})});
        }}>{patterns.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </label>
      {rule.pattern === 'regex' && <label className="form-field">Custom regular expression
        <input aria-label="Custom regular expression" value={rule.regex ?? ''} disabled={disabled}
          autoCapitalize="none" spellCheck={false}
          onChange={event => onChange({...rule, regex: event.target.value})}/>
      </label>}
      <label className="form-field">Scrubbing method
        <select aria-label="Scrubbing method" value={rule.method} disabled={disabled} onChange={event => {
          const {replacement, ...rest} = rule;
          const method = event.target.value as ScrubbingRule['method'];
          onChange({...rest, method, ...(method === 'replace' ? {replacement: replacement ?? ''} : {})});
        }}>{methods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      </label>
      {rule.method === 'replace' && <label className="form-field">Replacement text
        <input aria-label="Replacement text" value={rule.replacement ?? ''} disabled={disabled}
          onChange={event => onChange({...rule, replacement: event.target.value})}/>
      </label>}
    </div>
    {refusal&&<p role="alert">{refusal}</p>}
    <div className="button-row"><button className="text-button" disabled={disabled} onClick={onRemove}>Remove rule {index + 1}</button></div>
  </div>;
}
