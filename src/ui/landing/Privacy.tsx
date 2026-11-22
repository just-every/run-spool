import { Band, DrawingCard } from './Band';
// An issue title as Spool stores it after scrubbing (src/domain/privacy.ts).
export function Privacy() {
  return <Band id="private" drawingOrnaments={['thimble']} title="Your data stays yours." body="Spool scrubs emails, tokens and passwords from error text before saving it. New projects keep separate user IDs, emails, usernames and IP addresses sent by Sentry clients. Source maps stay private.">
    <DrawingCard title="Issues"><p className="inner-box scrubbed-title"><code>Error: Login failed for [email] <span className="nowrap">token=<span className="mark">[redacted]</span></span></code></p></DrawingCard>
  </Band>;
}
