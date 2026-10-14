import { rejectedResponse } from '../base/rejected-response';

/** Read only the accepted native JSON budget. Rejected chunked uploads finish
 * through Base's same bounded discard as declared-size/auth refusals. */
export async function nativeBody(request: Request): Promise<{value: unknown} | {rejected: number}> {
 const limit = 32768;
 if (Number(request.headers.get('content-length') ?? 0) > limit) return {rejected:400};
 const reader = request.body?.getReader();
 if (!reader) throw new Error('Missing body');
 let size = 0; const chunks: Uint8Array[] = [];
 try {
  for (;;) {
   const {done,value} = await reader.read();
   if (done) break;
   size += value.byteLength; chunks.push(value);
   if (size > limit) {
    // Include the consumed prefix in discard accounting; the total rejected
    // upload retains the 64 KiB/2 second bounds, even without Content-Length.
    const remaining = new ReadableStream<Uint8Array>({
     start(controller) { for (const chunk of chunks) controller.enqueue(chunk); },
     async pull(controller) { const part=await reader.read(); if(part.done)controller.close();else controller.enqueue(part.value); },
     cancel(reason) { return reader.cancel(reason); },
    });
    const discard = new Request(request.url,{method:'POST',body:remaining});
    const response = await rejectedResponse(discard,new Response(null,{status:400}));
    return {rejected:response.status};
   }
  }
  const bytes = new Uint8Array(size); let position = 0;
  for (const chunk of chunks) { bytes.set(chunk,position); position += chunk.length; }
  return {value:JSON.parse(new TextDecoder().decode(bytes))};
 } finally { reader.releaseLock(); }
}
