import {parse} from '@babel/parser';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const tree=parse(await readFile('tests/alerts/follow-up.mjs','utf8'),{sourceType:'module'});
const assertions=[];
const omit=new Set(['start','end','loc','extra','comments','leadingComments','trailingComments','innerComments']);
function clean(value){if(Array.isArray(value))return value.map(clean);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!omit.has(k)).map(([k,v])=>[k,clean(v)]));return value;}
function walk(node){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&node.callee.object?.name==='assert')assertions.push(clean(node));for(const [key,value]of Object.entries(node)){if(omit.has(key))continue;if(Array.isArray(value))for(const child of value)walk(child);else if(value&&typeof value==='object')walk(value);}}
const fn=tree.program.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.id?.name==='slackFollowUp').declaration;
walk(fn.body);
const row={function:'slackFollowUp',assertion_count:assertions.length,assertions_sha256:createHash('sha256').update(JSON.stringify(assertions)).digest('hex')};
await writeFile(process.argv[2],JSON.stringify(row,null,2)+'\n');console.log(row);
