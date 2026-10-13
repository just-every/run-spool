/** Official Cloudflare destination ranges, retrieved 2026-10-12.
 * https://www.cloudflare.com/ips-v4 and https://www.cloudflare.com/ips-v6
 * A dated availability classifier, not a public-address or ownership allowlist. */
const cidrs = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
  '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
  '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

/** Strict numeric address parsing: no URL normalization, hostnames, zone IDs or shorthand IPv4. */
function numeric(raw: string): { value: bigint; bits: number } | null {
  const address = raw.toLowerCase();
  if (!address.includes(':')) {
    const words = address.split('.');
    if (words.length !== 4 || words.some(word => !/^(0|[1-9]\d{0,2})$/.test(word) || Number(word) > 255)) return null;
    return { value: words.reduce((value, word) => (value << 8n) | BigInt(word), 0n), bits: 32 };
  }
  const sides = address.split('::');
  if (sides.length > 2) return null;
  const left = sides[0] ? sides[0].split(':') : [], right = sides[1] ? sides[1].split(':') : [];
  if ([...left, ...right].some(word => !/^[0-9a-f]{1,4}$/.test(word))) return null;
  const missing = 8 - left.length - right.length;
  if (sides.length === 1 ? missing !== 0 : missing < 1) return null;
  const words = [...left, ...Array(sides.length === 2 ? missing : 0).fill('0'), ...right];
  return { value: words.reduce((value: bigint, word: string) => (value << 16n) | BigInt(parseInt(word, 16)), 0n), bits: 128 };
}
const ranges = cidrs.map(cidr => {
  const [base, prefix] = cidr.split('/'), address = numeric(base!)!;
  return { ...address, shift: BigInt(address.bits - Number(prefix)) };
});

export function isCloudflareAddress(address: string): boolean {
  const parsed = numeric(address);
  return parsed !== null && ranges.some(range => parsed.bits === range.bits && parsed.value >> range.shift === range.value >> range.shift);
}
