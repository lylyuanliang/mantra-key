//! 核心两阶段密钥派生流水线 (Two-Stage KDF Pipeline)

use argon2::{Algorithm, Argon2, Params, Version};
use hkdf::Hkdf;
use sha2::{Digest, Sha256};
use thiserror::Error;
use zeroize::Zeroizing;

use crate::charset::{
    rejection_sampling,
    CHARSET_ALPHA,
    CHARSET_DIGIT,
    CHARSET_SYMBOL,
    DIGITS,
    LOWERCASE,
    SYMBOLS,
    UPPERCASE,
};
use crate::memory::{MasterSeed, SecureString};

/// 密码学运算错误类型
#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Argon2 计算错误: {0}")]
    Argon2Error(String),

    #[error("HKDF 展开错误: {0}")]
    HkdfError(String),
}

/// 第一阶段：Argon2id 强算力派生 256-bit 主根种子 (MasterSeed)
///
/// 架构硬性冻结参数：m=65536 (64MiB), t=3, p=1 (强制锁死单车道，确保跨平台比特级绝对一致)
pub fn derive_master_seed(mantra: &str, salt: &str) -> Result<MasterSeed, CryptoError> {
    let params = Params::new(65536, 3, 1, Some(32))
        .map_err(|e| CryptoError::Argon2Error(e.to_string()))?;

    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

    // Argon2 规范要求 salt 至少 8 字节。若输入盐值小于 8 字节，则通过确定性 SHA-256 扩展为 16 字节安全盐
    let salt_bytes = salt.as_bytes();
    let effective_salt: Vec<u8> = if salt_bytes.len() < 8 {
        let mut hasher = Sha256::new();
        hasher.update(b"mantra_salt_pad:");
        hasher.update(salt_bytes);
        let hash = hasher.finalize();
        hash[0..16].to_vec()
    } else {
        salt_bytes.to_vec()
    };

    let mut seed = [0u8; 32];
    argon2
        .hash_password_into(mantra.as_bytes(), &effective_salt, &mut seed)
        .map_err(|e| CryptoError::Argon2Error(e.to_string()))?;

    Ok(MasterSeed(seed))
}

/// 第二阶段：HKDF-Expand 极速派生目标站点强密码 (<0.1ms)
///
/// 采用拒绝采样消除模偏差，并支持基于掩码的字符集动态筛选。
pub fn derive_site_password(
    seed: &MasterSeed,
    canonical_domain: &str,
    username: &str,
    version: u32,
    length: usize,
    charset_mask: u8,
) -> Result<SecureString, CryptoError> {
    let hk = Hkdf::<Sha256>::new(None, seed.as_slice());
    let info = format!("mantra_v1:{}:{}:{}", canonical_domain, username, version);

    let mut okm = Zeroizing::new(vec![0u8; 64]);
    hk.expand(info.as_bytes(), &mut okm)
        .map_err(|e| CryptoError::HkdfError(e.to_string()))?;

    let mut combined_alphabet = Vec::new();
    if charset_mask == 0 || (charset_mask & CHARSET_ALPHA) != 0 {
        combined_alphabet.extend_from_slice(UPPERCASE);
        combined_alphabet.extend_from_slice(LOWERCASE);
    }
    if charset_mask == 0 || (charset_mask & CHARSET_DIGIT) != 0 {
        combined_alphabet.extend_from_slice(DIGITS);
    }
    if charset_mask == 0 || (charset_mask & CHARSET_SYMBOL) != 0 {
        combined_alphabet.extend_from_slice(SYMBOLS);
    }

    // 若掩码非法或未命中任何预设字符集，自动安全兜底为全字符集
    if combined_alphabet.is_empty() {
        combined_alphabet.extend_from_slice(UPPERCASE);
        combined_alphabet.extend_from_slice(LOWERCASE);
        combined_alphabet.extend_from_slice(DIGITS);
        combined_alphabet.extend_from_slice(SYMBOLS);
    }

    let pwd = rejection_sampling(&okm, &combined_alphabet, length);
    Ok(SecureString::new(pwd))
}

/// 端到端加密同步子密钥派生
///
/// 从主种子隔离展开出专用于云同步信封加解密的 256 位子密钥。
pub fn derive_sync_key(seed: &MasterSeed) -> Result<Zeroizing<[u8; 32]>, CryptoError> {
    let hk = Hkdf::<Sha256>::new(None, seed.as_slice());
    let mut okm = Zeroizing::new([0u8; 32]);
    hk.expand(b"mantra_e2ee_sync_envelope_v1", &mut *okm)
        .map_err(|e| CryptoError::HkdfError(e.to_string()))?;

    Ok(okm)
}
