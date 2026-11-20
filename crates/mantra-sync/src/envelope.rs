use aes_gcm::{
    aead::{
        rand_core::{OsRng, RngCore},
        Aead, KeyInit, Payload,
    },
    Aes256Gcm, Nonce,
};
use thiserror::Error;

/// 魔数头部标识 ("MKEY")
const MAGIC_HEADER: &[u8; 4] = b"MKEY";

/// 封包协议主版本号 (0x01)
const PROTOCOL_VERSION: u8 = 0x01;

/// 最小信封长度: Magic(4) + Version(1) + Nonce(12) + Tag(16) = 33 字节
const MIN_ENVELOPE_LEN: usize = 4 + 1 + 12 + 16;

/// 同步信封与解密异常枚举
#[derive(Error, Debug, PartialEq, Eq)]
pub enum SyncError {
    #[error("封包格式非法或长度不足")]
    InvalidEnvelopeFormat,

    #[error("Magic 头部不匹配: 期望 MKEY")]
    MagicMismatch,

    #[error("AES-GCM 解密或认证校验失败 (MAC Tag 损坏)")]
    DecryptionFailed,

    #[error("AES-GCM 加密失败")]
    EncryptionFailed,
}

/// 将明文 Payload 打包为 E2EE 二进制信封
///
/// 信封内存布局:
/// `[Magic 4B] + [Version 1B] + [Nonce 12B] + [Ciphertext NB] + [Tag 16B]`
///
/// AAD: `b"MKEY" || 0x01` (前 5 字节)
pub fn pack_envelope(payload_json: &[u8], sync_key: &[u8; 32]) -> Result<Vec<u8>, SyncError> {
    let cipher = Aes256Gcm::new_from_slice(sync_key).map_err(|_| SyncError::EncryptionFailed)?;

    // 使用系统 CSPRNG (OsRng) 采样 96-bit (12 字节) 安全随机 Nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // 构造 AAD 关联认证数据 (Magic + Version)
    let mut aad = Vec::with_capacity(5);
    aad.extend_from_slice(MAGIC_HEADER);
    aad.push(PROTOCOL_VERSION);

    // 执行 AES-256-GCM 认证加密 (返回 ciphertext || tag)
    let ciphertext = cipher
        .encrypt(
            nonce,
            Payload {
                msg: payload_json,
                aad: &aad,
            },
        )
        .map_err(|_| SyncError::EncryptionFailed)?;

    // 拼装二进制信封
    let mut blob = Vec::with_capacity(5 + 12 + ciphertext.len());
    blob.extend_from_slice(MAGIC_HEADER);
    blob.push(PROTOCOL_VERSION);
    blob.extend_from_slice(&nonce_bytes);
    blob.extend_from_slice(&ciphertext);

    Ok(blob)
}

/// 解析与校验 E2EE 二进制信封并解密出明文 Payload
pub fn unpack_envelope(blob: &[u8], sync_key: &[u8; 32]) -> Result<Vec<u8>, SyncError> {
    if blob.len() < MIN_ENVELOPE_LEN {
        return Err(SyncError::InvalidEnvelopeFormat);
    }

    // 验证 Magic 魔数
    if &blob[0..4] != MAGIC_HEADER {
        return Err(SyncError::MagicMismatch);
    }

    // 验证协议版本
    let version = blob[4];
    if version != PROTOCOL_VERSION {
        return Err(SyncError::InvalidEnvelopeFormat);
    }

    let nonce_bytes = &blob[5..17];
    let ciphertext = &blob[17..];

    let cipher = Aes256Gcm::new_from_slice(sync_key).map_err(|_| SyncError::DecryptionFailed)?;
    let nonce = Nonce::from_slice(nonce_bytes);

    // 组装关联认证数据 AAD
    let mut aad = Vec::with_capacity(5);
    aad.extend_from_slice(MAGIC_HEADER);
    aad.push(version);

    // 解密并校验认证标签
    let plaintext = cipher
        .decrypt(
            nonce,
            Payload {
                msg: ciphertext,
                aad: &aad,
            },
        )
        .map_err(|_| SyncError::DecryptionFailed)?;

    Ok(plaintext)
}
