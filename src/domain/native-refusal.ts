/** Native business refusals use one code on the person and agent doors.
 * Human-readable error text remains available to the person who made the call.
 * Missing and inaccessible records deliberately share one code. */
export function nativeRefusalCode(status: number, value: {code?: unknown; error?: unknown}): string {
 if ([401,403,404].includes(status)) return 'not_found';
 for (const candidate of [value.code,value.error]) {
  if (typeof candidate==='string' && /^[a-z][a-z0-9_]{0,99}$/.test(candidate)) return candidate;
 }
 if (status===400) return 'invalid_arguments';
 if (status===409) return 'revision_conflict';
 if (status===413) return 'body_limit';
 if (status===429) return 'rate_limited';
 if (status===503) return 'native_unavailable';
 return 'native_refused';
}

export async function nativeRefusalResponse(response: Response): Promise<Response> {
 if (response.status<400 || !response.headers.get('content-type')?.includes('application/json')) return response;
 let value;
 try { value=await response.clone().json() as Record<string,unknown>; } catch { return response; }
 if (!value || typeof value.error!=='string' || value.code!==undefined) return response;
 const headers=new Headers(response.headers);headers.delete('content-length');
 return Response.json({...value,code:nativeRefusalCode(response.status,value)}, {status:response.status,headers});
}
