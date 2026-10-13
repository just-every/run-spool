import { Band, DrawingCard } from './Band';
// package.json's own scripts for the README's install, setup and dev steps.
const commands = ['pnpm install', 'pnpm run setup', 'pnpm run dev'];
export function RunIt() {
  return <Band id="run" ornaments={['laptop', 'mug']} title="Running in three commands." body="Node 22 and pnpm are all you need. Setup asks for your email, then dev prints a link that opens Spool.">
    <DrawingCard className="terminal-card"><pre><code>{commands.map((command, index) => <span className="terminal-line" key={command}><span className="prompt" aria-hidden="true">$</span><span className={index ? undefined : 'mark'}>{command}</span>{'\n'}</span>)}</code></pre></DrawingCard>
  </Band>;
}
