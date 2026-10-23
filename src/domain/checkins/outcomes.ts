// Bounded per-check-in outcomes, counted in project outcomes beside the other capture receipts.
export const checkInOutcomes = ['check_in_routed', 'check_in_unrouted', 'check_in_disabled', 'check_in_egress_unconfigured', 'check_in_forward_failed', 'check_in_refused', 'check_in_item_too_large', 'check_in_invalid'] as const;
export type CheckInOutcome = typeof checkInOutcomes[number];
export const isCheckInOutcome = (reason: unknown): reason is CheckInOutcome => (checkInOutcomes as readonly unknown[]).includes(reason);
