import { list, object, OtlpError } from './wire';
const alternatives=['stringValue','boolValue','intValue','doubleValue','arrayValue','kvlistValue','bytesValue','stringValueStrindex'];
export function integer(value:any,unsigned=false):bigint{
  if(typeof value==='number'&&!Number.isSafeInteger(value)||typeof value!=='number'&&typeof value!=='string'||!/^[-]?\d{1,20}$/.test(String(value)))throw new OtlpError('invalid_integer');
  const result=BigInt(value);
  if(result<(unsigned?0n:-(1n<<63n))||result>(unsigned?(1n<<64n)-1n:(1n<<63n)-1n))throw new OtlpError('invalid_integer');
  return result;
}
export function anyValue(value:any,depth=0):void{
  object(value);if(depth>8)throw new OtlpError('attribute_depth_limit');
  const fields=alternatives.filter(key=>Object.hasOwn(value,key));if(fields.length>1)throw new OtlpError('conflicting_value');
  const key=fields[0],v=value[key];
  switch(key){
    case undefined:break;
    case 'stringValue':if(typeof v!=='string')throw new OtlpError('invalid_value');break;
    case 'boolValue':if(typeof v!=='boolean')throw new OtlpError('invalid_value');break;
    case 'intValue':integer(v);break;
    case 'doubleValue':if(!(typeof v==='number'&&Number.isFinite(v))&&!['NaN','Infinity','-Infinity'].includes(v))throw new OtlpError('invalid_value');break;
    case 'bytesValue':if(typeof v!=='string'||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v))throw new OtlpError('invalid_value');break;
    case 'arrayValue':for(const item of list(object(v).values,64))anyValue(item,depth+1);break;
    case 'kvlistValue':attributes(object(v).values,depth+1);break;
    // Profiling-only dictionary references carry no log meaning.
    case 'stringValueStrindex':break;
  }
}
export function attributes(value:any,depth=0):Map<string,any>{
  const result=new Map<string,any>();
  for(const row of list(value,64)){
    object(row);if(typeof row.key!=='string'||!row.key.length||row.key.length>256||result.has(row.key))throw new OtlpError('invalid_attributes');
    anyValue(row.value,depth);result.set(row.key,row.value);
  }
  return result;
}
export function textAttribute(attrs:Map<string,any>,key:string):string{
  const value=attrs.get(key)?.stringValue;if(typeof value!=='string')throw new OtlpError('missing_profile_attribute');return value;
}
export function uint32(value:any):void{if(!Number.isInteger(value)||value<0||value>4294967295)throw new OtlpError('invalid_integer')}
