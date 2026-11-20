/**
 * 密诀 MantraKey 域名规范化提取与国际化域名 (Punycode) 解码工具
 */

/**
 * RFC 3492 Punycode 解码器，用于将 xn-- 开头的国际化域名还原为人类可读的 Unicode
 */
function decodePunycodePart(input: string): string {
  const maxInt = 2147483647;
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  const initialBias = 72;
  const initialN = 128;
  const delimiter = '-';

  function adapt(delta: number, numPoints: number, firstTime: boolean): number {
    let k = 0;
    delta = firstTime ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) {
      delta = Math.floor(delta / (base - tMin));
    }
    return Math.floor(k + ((base - tMin + 1) * delta) / (delta + skew));
  }

  function decodeDigit(cp: number): number {
    return cp - 48 < 10 ? cp - 22 : cp - 65 < 26 ? cp - 65 : cp - 97 < 26 ? cp - 97 : base;
  }

  const output: number[] = [];
  const basic = input.lastIndexOf(delimiter);
  let n = initialN;
  let i = 0;
  let bias = initialBias;

  if (basic > 0) {
    for (let j = 0; j < basic; ++j) {
      output.push(input.charCodeAt(j));
    }
  }

  let index = basic > 0 ? basic + 1 : 0;
  while (index < input.length) {
    const oldi = i;
    let w = 1;
    for (let k = base; ; k += base) {
      if (index >= input.length) return input;
      const digit = decodeDigit(input.charCodeAt(index++));
      if (digit >= base) return input;
      if (digit > Math.floor((maxInt - i) / w)) return input;
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      if (w > Math.floor(maxInt / (base - t))) return input;
      w *= base - t;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    if (Math.floor(i / out) > maxInt - n) return input;
    n += Math.floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

/**
 * 将可能包含 xn-- 的 punycode 域名转化为友好的 Unicode 中文字符串
 * 例如: xn--ehqx7tcnnope.com -> 三毛机场.com
 */
export function toUnicodeDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') return '';
  return domain
    .split('.')
    .map((part) => (part.startsWith('xn--') ? decodePunycodePart(part.slice(4)) : part))
    .join('.');
}

/**
 * 从完整 URL 中提取主机名/规范域名
 */
export function extractDomain(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return '';
  }

  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();
    return hostname;
  } catch {
    // 兼容可能传入的单纯主机名或无效 URL
    const cleaned = rawUrl.trim().toLowerCase();
    if (/^[a-z0-9.-]+\.[a-z]{2,}$/.test(cleaned) || cleaned.startsWith('xn--')) {
      return cleaned;
    }
    return '';
  }
}

/**
 * 提取主域名/根域名 (eTLD+1)，用于子域名自动继承匹配父站点凭据
 * 例如: gw-1.三毛机场.com -> 三毛机场.com
 *      gw-1.xn--ehqx7tcnnope.com -> xn--ehqx7tcnnope.com
 *      login.cleanip.io -> cleanip.io
 */
export function getRootDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') return '';
  const d = domain.trim().toLowerCase();
  const parts = d.split('.');
  if (parts.length <= 2) return d;

  const doubleTlds = ['com.cn', 'org.cn', 'net.cn', 'gov.cn', 'edu.cn', 'co.uk', 'com.hk'];
  const lastTwo = parts.slice(-2).join('.');
  if (doubleTlds.includes(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join('.');
  }
  return parts.slice(-2).join('.');
}
