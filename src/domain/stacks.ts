import { pythonStack } from './stacks-python.ts';
import { goStack } from './stacks-go.ts';
export { goFunction } from './stacks-go.ts';
// Parse only bounded textual grammars. Source lines, locals and Go arguments
// never enter the normalized envelope. Coordinates remain one-based lines.
export function parseStack(language: 'python' | 'go', value: unknown) {
 if (typeof value !== 'string' || value.length > 32768 || new TextEncoder().encode(value).length > 32768) throw new Error('Stack exceeds 32 KiB');
 const lines = value.replace(/\r\n/g, '\n').split('\n');
 if (lines.length > 1000 || lines.some(line => line.length > 4096)) throw new Error('Stack parser budget');
 return language === 'python' ? pythonStack(lines) : goStack(lines);
}
