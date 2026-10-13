/** The spool-of-thread mark and the product name; the mark asset is shared with server documents. */
export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={`wordmark ${className}`.trim()}><img src="/theme/spool-mark.svg" alt="" width="45" height="45" />Spool</span>;
}
