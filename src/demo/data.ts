import { normalize, type Envelope } from '../domain/privacy';

export const groups = [
 { type: 'TypeError', message: "Cannot read properties of undefined (reading 'price')", file: '/src/cart/totals.ts', fn: 'calculateTotal', line: 42, count: 84, state: 'open' },
 { type: 'TimeoutError', message: 'Inventory reservation exceeded its deadline', file: '/src/checkout/reserve.ts', fn: 'reserveInventory', line: 68, count: 66, state: 'acknowledged' },
 { type: 'NetworkError', message: 'Product search request failed', file: '/src/search/client.ts', fn: 'searchProducts', line: 31, count: 51, state: 'open' },
 { type: 'RangeError', message: 'Invalid delivery date', file: '/src/shipping/dates.ts', fn: 'formatDeliveryDate', line: 19, count: 39, state: 'resolved' },
 { type: 'TypeError', message: 'Saved address is missing a postal code', file: '/src/account/address.ts', fn: 'validateAddress', line: 57, count: 30, state: 'open' },
 { type: 'Error', message: 'Image decoder could not read the thumbnail', file: '/src/catalog/images.ts', fn: 'loadThumbnail', line: 24, count: 18, state: 'suppressed' },
] as const;

export const releases = [
 { name: 'storefront@2.8.0', build: 'cedar-280' },
 { name: 'storefront@2.8.1', build: 'cedar-281' },
 { name: 'storefront@2.9.0', build: 'cedar-290' },
] as const;

export function sampleEvent(group: typeof groups[number], groupIndex: number, index: number): Envelope {
 const release = releases[Math.min(2, Math.floor(index * 3 / group.count))];
 return normalize({ version: 1, eventId: `cedar-demo-${groupIndex + 1}-${index + 1}`,
  release: release.name, build: release.build, environment: index % 13 === 0 ? 'staging' : 'production',
  type: group.type, message: group.message,
  frames: [{ file: group.file, function: group.fn, line: group.line, column: 12 },
   { file: '/src/app.ts', function: 'handleAction', line: 112, column: 8 }],
  breadcrumbs: ['Opened storefront', 'Viewed seasonal collection', `Action: ${group.fn}`],
  client: `cedar-demo-client-${String(index % 23).padStart(3, '0')}`,
 });
}
