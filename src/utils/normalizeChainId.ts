// Utility to normalize chainId from CAIP, hex, number, or string
export function normalizeChainId(chainIdRaw: unknown): number {
  if (!chainIdRaw) return 134;
  if (typeof chainIdRaw === 'number') return chainIdRaw;
  if (typeof chainIdRaw === 'string') {
    const caip = chainIdRaw.split(':');
    if (caip.length === 2 && /^\d+$/.test(caip[1])) return parseInt(caip[1], 10);
    if (/^0x[0-9a-fA-F]+$/.test(chainIdRaw)) return parseInt(chainIdRaw, 16);
    if (/^\d+$/.test(chainIdRaw)) return parseInt(chainIdRaw, 10);
  }
  return 134;
}

