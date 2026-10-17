interface Address { bits: 32 | 128; value: bigint }
function ipv4(value: string): bigint | null {
 const parts = value.split('.');
 if (parts.length !== 4 || parts.some(p => !/^(0|[1-9][0-9]{0,2})$/.test(p) || Number(p) > 255)) return null;
 return parts.reduce((n, p) => (n << 8n) | BigInt(p), 0n);
}
function address(input: string): Address | null {
 const v4 = ipv4(input); if (v4 !== null) return { bits: 32, value: v4 };
 if (!input.includes(':') || input.includes('%') || input.includes(':::')) return null;
 let value = input;
 if (value.includes('.')) {
  const last = value.lastIndexOf(':'), tail = ipv4(value.slice(last + 1)); if (tail === null) return null;
  value = value.slice(0, last + 1) + (tail >> 16n).toString(16) + ':' + (tail & 65535n).toString(16);
 }
 const sides = value.split('::'); if (sides.length > 2) return null;
 const left = sides[0] ? sides[0].split(':') : [], right = sides.length === 2 && sides[1] ? sides[1].split(':') : [];
 if ([...left, ...right].some(p => !/^[a-f0-9]{1,4}$/i.test(p))) return null;
 const missing = 8 - left.length - right.length;
 if ((sides.length === 1 && missing !== 0) || (sides.length === 2 && missing < 1)) return null;
 const parts = [...left, ...Array.from({ length: missing }, () => '0'), ...right];
 return { bits: 128, value: parts.reduce((n, p) => (n << 16n) | BigInt('0x' + p), 0n) };
}
export function validIpRange(value: string): boolean {
 if (value.length > 80) return false;
 const parts = value.split('/'), parsed = address(parts[0]);
 return !!parsed && parts.length <= 2 && (parts.length === 1 || /^(0|[1-9][0-9]{0,2})$/.test(parts[1]) && Number(parts[1]) <= parsed.bits);
}
export function ipInRange(ip: string, range: string): boolean {
 let parsed = address(ip); const [base, prefix] = range.split('/'), network = address(base);
 if (!parsed || !network || !validIpRange(range)) return false;
 // Treat IPv4-mapped client addresses as IPv4 when the configured range is IPv4.
 if (network.bits === 32 && parsed.bits === 128 && parsed.value >> 32n === 65535n) parsed = { bits: 32, value: parsed.value & 0xffffffffn };
 if (parsed.bits !== network.bits) return false;
 const bits = prefix === undefined ? network.bits : Number(prefix), shift = BigInt(network.bits - bits);
 return parsed.value >> shift === network.value >> shift;
}
export function loopbackHost(host: string): boolean {
 const name = host.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
 return name === 'localhost' || name.endsWith('.localhost') || ipInRange(name, '127.0.0.0/8') || ipInRange(name, '::1');
}
