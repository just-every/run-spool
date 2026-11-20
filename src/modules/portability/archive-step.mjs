// Stage names are fixed by the implementation. Never send native messages,
// SQL, object keys, row values or filesystem paths to the CLI.
const steps=new Set(['export_object_inventory','export_snapshot','export_part']);
export async function archiveStep(step,operation) {
  try{return await operation();}
  catch(error){
    if(error && typeof error==='object' && !error.portabilityStep)error.portabilityStep=step;
    throw error;
  }
}
export const failureStep=error=>steps.has(error?.portabilityStep)?error.portabilityStep:undefined;
