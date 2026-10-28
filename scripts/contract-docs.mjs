// Regenerate named legacy clauses while ct owns the complete contract rewrite.
import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {parseContract, clauseIdSource} from '../src/base/seed-contract.mjs';

const [command,...ids]=process.argv.slice(2);
const idPattern=new RegExp(`^${clauseIdSource}$`);
if(!['write','check'].includes(command)||!ids.length||ids.some(id=>!idPattern.test(id))) {
 throw Error('Usage: node scripts/contract-docs.mjs write|check CLAUSE-ID...');
}
const read=name=>existsSync(name)?readFileSync(name,'utf8'):undefined;
const original=read('CONTRACT.md');
if(!original)throw Error('CONTRACT.md is missing.');
const cells=line=>line.trim().replace(/^\|/,'').replace(/(?<!\\)\|$/,'').split(/(?<!\\)\|/).map(cell=>cell.trim());
const summaryHeader='Clauses|Done|Partial|Missing|Total';
function summaryRange(lines) {
 const start=lines.findIndex(line=>cells(line).join('|')===summaryHeader);
 if(start<0)throw Error('The contract summary is missing.');
 let end=start+2;
 while(lines[end]?.startsWith('|'))end++;
 return {start,end};
}
const lines=original.split('\n'),range=summaryRange(lines);
const contract=parseContract([...lines.slice(0,range.start),...lines.slice(range.end)].join('\n'));
const tally=clauses=>['done','partial','missing'].map(status=>clauses.filter(clause=>clause.status===status).length);
const summary=(label,clauses)=>`| ${label} | ${[...tally(clauses),clauses.length].join(' | ')} |`;
const counts=[summary('Published',contract.clauses.filter(clause=>clause.kind==='published')),summary('Target and push further',contract.clauses.filter(clause=>clause.kind!=='published')),summary('All',contract.clauses)];
function updateSummary(text) {
 const content=text.split('\n'),{start,end}=summaryRange(content);
 content.splice(start+2,end-start-2,...counts);
 const [done,partial,missing]=tally(contract.clauses);
 return content.join('\n').replace(/\*\*Clause status: \d+ clauses — \d+ done, \d+ partial, \d+ missing\.\*\*/g,`**Clause status: ${contract.clauses.length} clauses — ${done} done, ${partial} partial, ${missing} missing.**`);
}
let acceptance=read('ACCEPTANCE.md');
if(!acceptance)throw Error('ACCEPTANCE.md is missing.');
for(const id of new Set(ids)) {
 const clause=contract.clauses.find(clause=>clause.id===id);
 if(!clause)throw Error(`Unknown clause ${id}.`);
 const source=lines[clause.line-1],definition=/^-\s+\*\*[^*]+\*\*/.exec(source);
 if(!definition)throw Error(`${id} needs the standard Base generator after its contract conversion.`);
 let end=clause.line;
 while(end<lines.length&&(!lines[end].trim()||/^\s/.test(lines[end])))end++;
 const body=[source.slice(definition[0].length).trim(),...lines.slice(clause.line,end).map(line=>line.replace(/^  /,''))].join('\n').trim();
 const row=cells(lines.find(line=>line.startsWith(`| \`${id}\` |`))),evidence=row[4],gap=row[5];
 const text=`- **${id} — ${clause.title}. Status: ${clause.status}.**\n\n${body.split('\n').map(line=>line?'  '+line:'').join('\n')}\n\n  Current evidence: ${evidence || 'None.'}\n\n  Gap: ${gap || 'None.'}\n`;
 const destination=acceptance.split('\n');
 const start=destination.findIndex(line=>line.startsWith(`- **${id} — `));
 if(start<0)throw Error(`ACCEPTANCE.md lacks ${id}; no clause can be silently omitted.`);
 let finish=start+1;
 while(finish<destination.length&&!/^(?:- \*\*[A-Z][A-Z0-9-]*[0-9]|#{1,6} )/.test(destination[finish]))finish++;
 destination.splice(start,finish-start,...(text+'\n').split('\n').slice(0,-1));
 acceptance=destination.join('\n');
}
const marker='<!-- Generated from CONTRACT.md by contract-docs. Edit CONTRACT.md, then regenerate. -->';
const claims=read('docs/CLAIMS.md');
if(claims&&!claims.startsWith(marker))throw Error('Existing claims need their own mapped generator; preserve their content.');
if(/^## Homepage claims/m.test(original))throw Error('Mapped homepage claims need the standard Base generator.');
const documents={
 'CONTRACT.md':updateSummary(original),
 'ACCEPTANCE.md':updateSummary(acceptance),
 'docs/CLAIMS.md':`${marker}\n\n# Spool homepage claims\n\nNo homepage claims are mapped yet.\n`,
};
const changed=Object.entries(documents).filter(([name,content])=>read(name)!==content);
if(command==='check'&&changed.length)throw Error(`Generated documents differ: ${changed.map(([name])=>name).join(', ')}. Run contract-docs write with the touched clause IDs.`);
if(command==='write')for(const [name,content] of changed){mkdirSync(dirname(name),{recursive:true});writeFileSync(name,content);}
console.log(command==='check'?'Contract documents are current.':`Generated ${changed.length} documents for ${ids.join(', ')}.`);
