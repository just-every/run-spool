import { useEffect, useState } from 'react';
import './AgentHandoff.css';

export function shellQuote(value: string) {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

export function useAgentSetup() {
  const [runtime, setRuntime] = useState<{ node: string; cli: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [policy, setPolicy] = useState<boolean | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const options = { credentials: 'same-origin' as const, signal: controller.signal };
    void fetch('/api/agent-runtime', options).then(async response => {
      if (response.ok) setRuntime(await response.json());
    }).catch(() => {}).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    const refreshPolicy = () => {
      void fetch('/agents/api/state', options).then(async response => {
        if (response.ok) setPolicy(((await response.json()) as { policy: { complete: boolean } }).policy.complete === true);
      }).catch(() => {});
    };
    const visible = () => { if (document.visibilityState === 'visible') refreshPolicy(); };
    refreshPolicy();
    window.addEventListener('focus', refreshPolicy);
    document.addEventListener('visibilitychange', visible);
    return () => { controller.abort(); window.removeEventListener('focus', refreshPolicy); document.removeEventListener('visibilitychange', visible); };
  }, []);
  return { runtime, loading, policy };
}

type Setup = ReturnType<typeof useAgentSetup>;

export function AgentPolicyNotice({ policy }: { policy: Setup['policy'] }) {
  return <p className="agent-policy-notice">{policy === false
    ? <>Before running a command, the owner must <a className="inline-link" href="/agents" target="_blank" rel="noreferrer">answer all six agent policy questions and save the policy</a>. No policy is saved yet. Opens in a new tab so your setup stays here.</>
    : policy === true
      ? <>Agent policy is saved. Review your choices in <a className="inline-link" href="/agents">Agents</a>.</>
      : <>Check that the owner has <a className="inline-link" href="/agents" target="_blank" rel="noreferrer">answered all six agent policy questions and saved the policy</a> before running a command. Opens in a new tab.</>}</p>;
}

export function AgentCommandFields({ project, issue, setup }: { project: string; issue?: string; setup: Setup }) {
  const [node, setNode] = useState(''), [checkout, setCheckout] = useState('');
  const [status, setStatus] = useState('');
  const local = location.hostname === 'localhost' || location.hostname === '[::1]' || location.hostname.startsWith('127.');
  const paths = setup.runtime ?? (node.trim() && checkout.trim() ? { node: node.trim(), cli: `${checkout.trim().replace(/\/$/, '')}/packages/agent/bin/spool-agent.mjs` } : null);
  const command = paths ? `${shellQuote(paths.node)} ${shellQuote(paths.cli)} packet ${issue ? shellQuote(issue) : '"$SPOOL_ISSUE"'} --format markdown` : '';
  const lines = [
    `export SPOOL_URL=${shellQuote(`${location.origin}/api/projects/${encodeURIComponent(project)}`)}`,
    "read -r -s -p 'Agent key: ' SPOOL_AGENT_KEY; printf '\\n'",
    'export SPOOL_AGENT_KEY',
    ...(local ? ["read -r -s -p 'Private rer-dev fragment value: ' SPOOL_DEV_KEY; printf '\\n'", 'export SPOOL_DEV_KEY'] : []),
    ...(!issue ? ["read -r -p 'Issue short ID (shown on the issue page): ' SPOOL_ISSUE"] : []),
    command,
  ].join('\n');
  async function copy() {
    try { await navigator.clipboard.writeText(lines); setStatus('Setup lines copied.'); }
    catch { setStatus('Could not copy setup lines. Select and copy them manually.'); }
  }
  return <div className="agent-command">
    <h3>Setup and packet command</h3>
    <p>Run these lines in Bash from any repository. Use the issue’s short ID shown at the top of its issue page{issue ? <>: <code>{issue}</code></> : <> (for example, <code>{project.toUpperCase()}-1</code>)</>}. Enter credentials only at the hidden prompts.</p>
    {setup.loading ? <p role="status">Finding this installation’s Node and Spool paths…</p> : <>
      {!setup.runtime && <><p>Enter absolute paths on the computer where your agent runs. If you installed with rer, its private Node is under <code>$HOME/.rer/node</code>. Opening local Spool with <code>rer dev</code> fills the exact executable and checkout paths automatically.</p>
        <label className="form-field">Node executable (absolute path)<input value={node} onChange={event => setNode(event.target.value)} /></label>
        <label className="form-field">Spool checkout (absolute path)<input value={checkout} onChange={event => setCheckout(event.target.value)} /></label></>}
      {paths && <><p>Node to use: <code>{paths.node}</code>. This is the Node executable{setup.runtime ? ' running Spool, including rer’s private runtime when used' : ' on your agent’s computer'}; Node does not need to be on PATH.</p>
        <pre data-agent-command>{lines}</pre>
        <button className="text-button" onClick={() => void copy()}>Copy setup lines</button></>}
    </>}
    {local && <p className="agent-handoff-guidance">Local <code>rer dev</code> agent keys also need this checkout’s private gate. From the printed <code>RER_OPEN</code> link, privately copy only the fragment value after <code>rer-dev=</code> and before any <code>&amp;</code> at the hidden prompt. The CLI sends it only to loopback. The gate can also open the owner persona: keep it out of browser apps and shared configuration. <a className="inline-link" href="/docs/agents#local-agent-access">Private input instructions</a>.</p>}
    <p className="agent-handoff-status" role="status" aria-live="polite">{status}</p>
  </div>;
}

export function AgentPacketCommand({ project, issue }: { project: string; issue: string }) {
  const setup = useAgentSetup();
  return <div className="agent-handoff"><AgentPolicyNotice policy={setup.policy} /><AgentCommandFields {...{ project, issue, setup }} /><p>Create an agent key for this project in <a className="inline-link" href={`/projects/${encodeURIComponent(project)}/settings`}>Settings</a>.</p></div>;
}
