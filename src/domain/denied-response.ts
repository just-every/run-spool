// Cover the import route's entire accepted request envelope without buffering it.
const maximumDiscardBytes = 3 * 1024 * 1024;
const maximumDiscardMs = 2000;

/** Finish a denied upload so workerd can safely reuse its HTTP connection. */
export async function deniedResponse(request: Request, response: Response): Promise<Response> {
  if (!request.body || request.bodyUsed || request.body.locked) return response;
  const reader = request.body.getReader();
  let bytes = 0, completed = false, timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<null>(resolve => {
    timer = setTimeout(() => resolve(null), maximumDiscardMs);
  });
  try {
    for (;;) {
      const result = await Promise.race([reader.read(), deadline]);
      if (result === null) break;
      if (result.done) { completed = true; return response; }
      bytes += result.value.byteLength;
      if (bytes > maximumDiscardBytes) break;
    }
  } catch {
    // The request is already denied. Invalid or interrupted upload bytes cannot
    // replace that authorization decision with a parser or transport error.
  } finally {
    clearTimeout(timer);
    // Cancellation is cleanup, not an unbounded extension of the discard budget.
    if (!completed) void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  // Keep the original status, headers and body even when discarding hits a bound.
  return response;
}
