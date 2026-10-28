/** Validate retained attribution separately from each native action's fields.
 * Restore keeps the original rows; only the legacy validators receive a view. */
export function attributionValidationRows(rows:Record<string,any[]>) {
 const shape=(value:any,keys:string[])=>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join()!==keys.sort().join())throw new Error('Invalid archive actor');};
 const text=(value:any,max=200)=>{if(typeof value!=='string'||!value.length||value.length>max||/[\x00-\x1f\x7f]/.test(value))throw new Error('Invalid archive actor');};
 const person=(value:any)=>{shape(value,['id','name']);text(value.id);text(value.name);};
 return {...rows,audit:rows.audit.map(row=>{
  const {preparedBy,approvers,performedBy,...detail}=JSON.parse(row.detail);
  if(preparedBy!==undefined||approvers!==undefined){
   if(performedBy!==undefined)throw new Error('Conflicting archive actors');
   shape(preparedBy,['agent','for','label']);person(preparedBy.agent);person(preparedBy.for);text(preparedBy.label,1000);
   if(!Array.isArray(approvers)||approvers.length>100)throw new Error('Invalid archive approvers');
   approvers.forEach(person);
  }
  if(performedBy!==undefined){shape(performedBy,['id','name','label']);text(performedBy.id);text(performedBy.name);text(performedBy.label,1000);}
  return {...row,detail:JSON.stringify(detail)};
 })};
}
