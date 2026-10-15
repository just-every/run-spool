import { parse, type ParserPlugin } from '@babel/parser';

type Position = { line: number; column: number };
type Scope = { start: Position; end: Position; size: number; name: string };
export type FunctionScopes = (line: number, column: number) => string | null;
const functions = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod', 'ClassMethod', 'ClassPrivateMethod']);
const before = (a: Position, b: Position) => a.line < b.line || (a.line === b.line && a.column < b.column);

function keyName(node: any): string | null {
  if (!node) return null;
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'PrivateName') return '#' + node.id.name;
  if (node.type === 'StringLiteral' || node.type === 'NumericLiteral') return String(node.value);
  return null;
}

// ECMAScript's syntactically inferred names, without evaluating computed keys.
function functionName(node: any, parent: any): string {
  if (node.id?.name) return node.id.name;
  if (node.type.endsWith('Method')) return (!node.computed || node.key.type.endsWith('Literal') ? keyName(node.key) : null) ?? '<anonymous>';
  if (parent?.type === 'VariableDeclarator' && parent.init === node && parent.id.type === 'Identifier') return parent.id.name;
  if (parent?.type === 'AssignmentExpression' && parent.right === node && parent.left.type === 'Identifier') return parent.left.name;
  if (['ObjectProperty', 'ClassProperty', 'ClassPrivateProperty'].includes(parent?.type) && parent.value === node) {
    return (!parent.computed || parent.key.type.endsWith('Literal') ? keyName(parent.key) : null) ?? '<anonymous>';
  }
  if (parent?.type === 'ExportDefaultDeclaration') return 'default';
  return '<anonymous>';
}

// Input is private source text from the already bounded flat map. Retain only
// function ranges/names, never the AST, source text or a global parser cache.
export function functionScopes(source: string, filename: string): FunctionScopes {
  const scopes: Scope[] = [];
  try {
    const plugins: ParserPlugin[] = [];
    if (/\.[cm]?tsx?$/i.test(filename)) plugins.push('typescript');
    if (/\.[jt]sx$/i.test(filename)) plugins.push('jsx');
    const ast = parse(source, { sourceType: 'unambiguous', plugins, attachComment: false, allowReturnOutsideFunction: true, allowAwaitOutsideFunction: true });
    const pending: { node: any; parent: any }[] = [{ node: ast.program, parent: null }];
    while (pending.length) {
      const { node, parent } = pending.pop()!;
      if (functions.has(node.type) && node.body && node.loc) scopes.push({ start: node.loc.start, end: node.loc.end, size: node.end - node.start, name: functionName(node, parent) });
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) {
          for (const child of value) if (child && typeof child.type === 'string') pending.push({ node: child, parent: node });
        } else if (value && typeof value === 'object' && 'type' in value && typeof value.type === 'string') pending.push({ node: value, parent: node });
      }
    }
  } catch {
    // Unsupported source syntax cannot justify replacing a reported name.
    return () => null;
  }
  scopes.sort((a, b) => a.size - b.size);
  return (line, column) => {
    const point = { line, column };
    return scopes.find(scope => !before(point, scope.start) && before(point, scope.end))?.name ?? null;
  };
}
