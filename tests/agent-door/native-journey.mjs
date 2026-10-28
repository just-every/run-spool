/** Independent specialist readback, after the normal policy phases. Native
 * reproduction and provider steps stay in the normal declared journey. */
export default async function({tool}){
 const answer=await tool('spool.packets.read',{project:'agent-door',issue:'not-a-retained-issue'});
 if(!answer.result?.isError)throw Error('Missing issue must be refused');
 const outcomes=await tool('spool.outcomes.read',{project:'agent-door'});
 if(outcomes.result?.isError||!String(outcomes.result?.structuredContent?.coverage).includes('unknown'))throw Error('Capture loss must retain unknown pre-transport loss');
}
