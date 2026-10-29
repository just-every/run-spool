// Keep the shared implementation in application source so the dev Worker can resolve it.
// The SDK build bundles these helpers into the published tunnel entries.
export { decodeBounded, limit, readBounded, TooLarge } from '../../../src/domain/sentry/transport.ts';
