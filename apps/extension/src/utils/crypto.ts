/**
 * 密诀 MantraKey - 纯浏览器原生 WebCrypto 确定性密钥派生引擎
 *
 * 100% 本地运算，基于浏览器原生 crypto.subtle：
 * 1. PBKDF2-SHA256 (100,000 次迭代) 派生 256-bit 主根种子
 * 2. HKDF-Expand-SHA256 极速展开 512-bit 站点专用伪随机熵 (<1ms)
 * 3. 严格无偏拒绝采样 (Rejection Sampling)，杜绝模偏差
 */

// 排除易混淆字符的字符集定义（与 Rust crates/mantra-crypto 完全保持规范一致）
export const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // 24 字符（剔除 I, O）
export const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz'; // 25 字符（剔除 l）
export const DIGITS = '23456789';                     // 8 字符（剔除 0, 1）
export const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';   // 27 字符

export const CHARSET_STANDARD = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS; // 84 字符
export const CHARSET_ALPHANUMERIC = UPPERCASE + LOWERCASE + DIGITS;       // 57 字符
export const CHARSET_PIN = '0123456789';                                  // 10 字符

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
    description: '高抗破解字母+数字+符号 (20位)',
  },
  'super-32': {
    name: '32位极高安全',
    length: 32,
    charset: CHARSET_STANDARD,
    description: '特权/服务凭据最大熵 (32位)',
  },
  'alphanumeric-16': {
    name: '16位无符号',
    length: 16,
    charset: CHARSET_ALPHANUMERIC,
    description: '仅字母与数字，适配限制特殊符号的旧网站',
  },
  'pin-6': {
    name: '6位数字PIN',
    length: 6,
    charset: CHARSET_PIN,
    description: '纯数字 PIN 码，适配二级交易支付验证',
  },
};

/**
 * 计算主口令的金丝雀防手抖校验码 (Canary Checksum)
 * 取 SHA-256 哈希值的前 8 位十六进制大写字符
 * 例如: A6FAA80B
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
 * 缓存的主根种子 (内存单例，关闭标签页或锁定即清空)
 */
let cachedMantra: string | null = null;
let cachedMasterSeed: Uint8Array | null = null;

/**
 * 清除内存主种子缓存
 */
export function clearMasterSeedCache(): void {
  cachedMantra = null;
  if (cachedMasterSeed) {
    cachedMasterSeed.fill(0);
    cachedMasterSeed = null;
  }
}

/**
 * 第一阶段：PBKDF2-SHA256 (100,000次迭代) 派生 32 字节主根种子
 */
export async function deriveMasterSeed(
  mantra: string,
  salt: string = UNIVERSAL_SALT
): Promise<Uint8Array> {
  if (cachedMantra === mantra && cachedMasterSeed) {
    return cachedMasterSeed;
  }

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

  const seed = new Uint8Array(derivedBuffer);
  cachedMantra = mantra;
  cachedMasterSeed = seed;
  return seed;
}

/**
 * 无偏拒绝采样算法 (Rejection Sampling)
 * 严格消除模偏差 (Modulo Bias)，确保字符集内每一个字符的抽样几率绝对相等
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

  // 首轮扫描
  while (result.length < targetLen && idx < entropy.length) {
    const b = entropy[idx++];
    if (b < limit) {
      result += alphabet[b % alphabetLen];
    }
  }

  // 极端情况下若首轮未填满（极罕见），进行循环保护回绕
  if (result.length < targetLen) {
    const hasValidByte = Array.from(entropy).some((b) => b < limit);
    if (!hasValidByte) {
      return '';
    }
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
 * 第二阶段：HKDF-Expand 极速派生目标站点强密码 (<1ms)
 */
export async function deriveSitePassword(
  masterMantra: string,
  canonicalDomain: string,
  username: string,
  version: number = 1,
  preset: RulePreset = 'standard-16'
): Promise<string> {
  const seed = await deriveMasterSeed(masterMantra);
  const enc = new TextEncoder();

  // 导入主种子为 HKDF Key
  const hkdfKey = await crypto.subtle.importKey(
    'raw',
    seed as unknown as BufferSource,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  // info 标签格式与规范一致
  const infoStr = `mantra_v1:${canonicalDomain.toLowerCase()}:${username.trim()}:${version}`;
  const infoBytes = enc.encode(infoStr);

  // 展开 512-bit (64 字节) OKM 伪随机熵
  const okmBuffer = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(), // HKDF-Expand with zero salt
      info: infoBytes,
    },
    hkdfKey,
    512
  );

  const okmBytes = new Uint8Array(okmBuffer);
  const rule = RULE_PRESETS[preset] || RULE_PRESETS['standard-16'];

  return rejectionSampling(okmBytes, rule.charset, rule.length);
}
