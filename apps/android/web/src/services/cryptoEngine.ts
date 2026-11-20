/**
 * 密诀 MantraKey - 纯端侧原生 WebCrypto 确定性密钥派生引擎
 *
 * 100% 本地纯计算，与桌面端/扩展端核心保持一致：
 * 1. PBKDF2-SHA256 (100,000 次迭代) 派生 256-bit 主根种子
 * 2. HKDF-Expand-SHA256 展开 512-bit 站点专用伪随机熵
 * 3. 严格无偏拒绝采样 (Rejection Sampling) 杜绝模偏差
 */

export const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // 24 字符（剔除易混淆 I, O）
export const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz'; // 25 字符（剔除易混淆 l）
export const DIGITS = '23456789';                     // 8 字符（剔除易混淆 0, 1）
export const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';   // 27 字符

export const CHARSET_STANDARD = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;
export const CHARSET_ALPHANUMERIC = UPPERCASE + LOWERCASE + DIGITS;
export const CHARSET_PIN = '0123456789';

export const UNIVERSAL_SALT = 'mantra_key_salt_universal_2026';

export type RulePreset = 'standard-16' | 'secure-20' | 'super-32' | 'alphanumeric-16' | 'pin-6';

export interface RuleConfig {
  name: string;
  length: number;
  charset: string;
  description: string;
}

export const RULE_PRESETS: Record<RulePreset, RuleConfig> = {
  'standard-16': {
    name: '16位标准',
    length: 16,
    charset: CHARSET_STANDARD,
    description: '字母+数字+特殊符号 (16位)',
  },
  'secure-20': {
    name: '20位高强',
    length: 20,
    charset: CHARSET_STANDARD,
    description: '字母+数字+特殊符号 (20位)',
  },
  'super-32': {
    name: '32位极高安全',
    length: 32,
    charset: CHARSET_STANDARD,
    description: '特权/高密凭据 (32位)',
  },
  'alphanumeric-16': {
    name: '16位无符号',
    length: 16,
    charset: CHARSET_ALPHANUMERIC,
    description: '仅字母与数字，适配限制特殊符号的旧网站',
  },
  'pin-6': {
    name: '6位PIN',
    length: 6,
    charset: CHARSET_PIN,
    description: '纯数字 6 位 PIN 码',
  },
};

/**
 * 计算主口令的金丝雀防手抖校验码 (Canary Checksum)
 */
export async function computeCanary(mantra: string): Promise<string> {
  if (!mantra) return '';
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(mantra));
  const hashHex = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex.slice(0, 8).toUpperCase();
}

/**
 * 第一阶段：PBKDF2-SHA256 派生主根种子
 */
export async function deriveMasterSeed(
  mantra: string,
  salt: string = UNIVERSAL_SALT
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(mantra),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256 // 256 bits = 32 bytes
  );

  return new Uint8Array(derivedBuffer);
}

/**
 * 无偏拒绝采样算法 (Rejection Sampling)
 */
export function rejectionSampling(
  entropy: Uint8Array,
  alphabet: string,
  targetLen: number
): string {
  if (!alphabet || targetLen <= 0 || entropy.length === 0) {
    return '';
  }

  const alphabetLen = alphabet.length;
  const limit = Math.floor(256 / alphabetLen) * alphabetLen;
  let result = '';
  let idx = 0;

  while (result.length < targetLen && idx < entropy.length) {
    const b = entropy[idx++];
    if (b < limit) {
      result += alphabet[b % alphabetLen];
    }
  }

  if (result.length < targetLen) {
    let loopIdx = 0;
    while (result.length < targetLen) {
      const b = entropy[loopIdx % entropy.length];
      loopIdx++;
      if (b < limit) {
        result += alphabet[b % alphabetLen];
      }
    }
  }

  return result;
}

/**
 * 第二阶段：HKDF-Expand 极速派生目标站点强密码
 */
export async function deriveSitePassword(
  masterMantra: string,
  canonicalDomain: string,
  username: string = '',
  version: number = 1,
  preset: RulePreset = 'standard-16'
): Promise<string> {
  if (!masterMantra.trim() || !canonicalDomain.trim()) {
    return '';
  }

  const seed = await deriveMasterSeed(masterMantra);
  const enc = new TextEncoder();

  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    seed as unknown as BufferSource,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const infoStr = `mantra_v1:${canonicalDomain.toLowerCase().trim()}:${username.trim()}:${version}`;
  const infoBytes = enc.encode(infoStr);

  const okmBuffer = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(),
      info: infoBytes,
    },
    hkdfKey,
    512 // 64 bytes
  );

  const okmBytes = new Uint8Array(okmBuffer);
  const rule = RULE_PRESETS[preset] || RULE_PRESETS['standard-16'];

  return rejectionSampling(okmBytes, rule.charset, rule.length);
}
