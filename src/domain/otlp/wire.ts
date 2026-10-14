export class OtlpError extends Error {
  constructor(readonly reason:string,readonly status=400){super(reason)}
}
export function object(value:any):Record<string,any>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new OtlpError('invalid_structure');
  return value;
}
export function list(value:any,limit:number):any[]{
  if(value===undefined)return [];
  if(!Array.isArray(value))throw new OtlpError('invalid_structure');
  if(value.length>limit)throw new OtlpError('collection_limit',413);
  return value;
}
/** Bound the stream before decode/parse; nesting is checked before JSON.parse. */
export async function readOtlp(request:Request):Promise<Record<string,any>>{
  if(!/^application\/json(?:\s*;\s*charset=utf-8)?\s*$/i.test(request.headers.get('content-type')??''))throw new OtlpError('unsupported_content_type',415);
  if(!['','identity'].includes((request.headers.get('content-encoding')??'').toLowerCase()))throw new OtlpError('unsupported_content_encoding',415);
  const declared=request.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>32768))throw new OtlpError('body_limit',413);
  const reader=request.body?.getReader();if(!reader)throw new OtlpError('invalid_json');
  let size=0;const chunks:Uint8Array[]=[];
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>32768){await reader.cancel();throw new OtlpError('body_limit',413)}chunks.push(value)}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  let text:string;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{throw new OtlpError('invalid_json')}
  let depth=0,quoted=false,escaped=false,nodes=0;
  for(const char of text){
    if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue}
    if(char==='"')quoted=true;
    else if(char==='{'||char==='['){if(++depth>24||++nodes>4096)throw new OtlpError('structure_limit',413)}
    else if(char==='}'||char===']')depth--;
    else if(char===','&&++nodes>4096)throw new OtlpError('structure_limit',413);
  }
  try{const value=object(JSON.parse(text));if(!value.resourceLogs&&(value.resourceSpans!==undefined||value.resourceMetrics!==undefined))throw new OtlpError('unsupported_signal',422);return value}catch(error){if(error instanceof OtlpError)throw error;throw new OtlpError('invalid_json')}
}
