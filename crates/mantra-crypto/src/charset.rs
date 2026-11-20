//! 字符集定义与消除模偏差的拒绝采样算法

/// 字符集掩码：字母（包含大写与小写）
pub const CHARSET_ALPHA: u8 = 0b0000_0001;

/// 字符集掩码：数字
pub const CHARSET_DIGIT: u8 = 0b0000_0010;

/// 字符集掩码：特殊符号
pub const CHARSET_SYMBOL: u8 = 0b0000_0100;

/// 综合掩码：字母 + 数字 + 特殊符号
pub const CHARSET_ALPHA_NUM_SYMBOL: u8 = CHARSET_ALPHA | CHARSET_DIGIT | CHARSET_SYMBOL;

/// 大写字母字符集（排除易混淆字符 I、O）
pub const UPPERCASE: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ";

/// 小写字母字符集（排除易混淆字符 l）
pub const LOWERCASE: &[u8] = b"abcdefghijkmnopqrstuvwxyz";

/// 数字字符集（排除易混淆数字 0、1）
pub const DIGITS: &[u8] = b"23456789";

/// 安全特殊符号集合
pub const SYMBOLS: &[u8] = b"!@#$%^&*()-_=+[]{}|;:,.<>?";

/// 拒绝采样算法：从伪随机字节流中抽取无偏字符
///
/// 针对普通取模 (byte % alphabet_len) 会导致前面字符概率偏高的问题，
/// 通过丢弃超过 `(256 / len) * len` 的多余区间字节，确保每个字符被选中的概率绝对均等。
pub fn rejection_sampling(entropy: &[u8], alphabet: &[u8], target_len: usize) -> String {
    if alphabet.is_empty() || target_len == 0 || entropy.is_empty() {
        return String::new();
    }

    let alphabet_len = alphabet.len() as u32;
    let limit = (256 / alphabet_len) * alphabet_len;
    let mut result = Vec::with_capacity(target_len);

    let mut idx = 0;
    while result.len() < target_len && idx < entropy.len() {
        let b = entropy[idx] as u32;
        idx += 1;
        if b < limit {
            result.push(alphabet[(b % alphabet_len) as usize]);
        }
    }

    // 极端情况下若首轮熵不足以填满目标长度，循环回绕保护
    if result.len() < target_len {
        // 先检查是否存在至少一个有效无偏字节，杜绝全拒绝输入导致死循环 DoS
        let has_valid_byte = entropy.iter().any(|&b| (b as u32) < limit);
        if !has_valid_byte {
            return String::new();
        }

        for &b in entropy.iter().cycle() {
            let b32 = b as u32;
            if b32 < limit {
                result.push(alphabet[(b32 % alphabet_len) as usize]);
                if result.len() == target_len {
                    break;
                }
            }
        }
    }

    String::from_utf8(result).unwrap_or_default()
}
