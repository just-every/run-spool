import { Band, DrawingCard } from './Band';
// An issue title as Spool stores it after scrubbing (src/domain/privacy.ts).
export function Privacy() {
  return <Band id="private" drawingOrnaments={['thimble']} title="Your data stays yours." body="Emails, tokens and passwords are scrubbed before anything is saved. Your source maps stay private.">
    <DrawingCard title="Issues"><p className="inner-box scrubbed-title"><code>Error: Login failed for [email] <span className="nowrap">token=<span className="mark">[redacted]</span></span></code></p></DrawingCard>
  </Band>;
}
