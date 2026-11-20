//! 安全内存管理与零化保护数据结构

use std::ops::Deref;
use subtle::ConstantTimeEq;
use zeroize::{Zeroize, ZeroizeOnDrop};

/// 受物理清零保护的安全字符串包装
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SecureString(String);

impl SecureString {
    /// 从标准字符串创建安全字符串实例
    pub fn new(s: String) -> Self {
        Self(s)
    }

    /// 获取底层只读字符串切片
    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// 获取字符串字节长度
    pub fn len(&self) -> usize {
        self.0.len()
    }

    /// 判断字符串是否为空
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl Deref for SecureString {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl AsRef<str> for SecureString {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

/// 32 字节主根种子包装（离开作用域自动清零物理内存）
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct MasterSeed(pub [u8; 32]);

impl MasterSeed {
    /// 构造新的主种子实例
    pub fn new(seed: [u8; 32]) -> Self {
        Self(seed)
    }

    /// 借用主种子字节切片
    pub fn as_slice(&self) -> &[u8] {
        &self.0
    }
}

impl Deref for MasterSeed {
    type Target = [u8; 32];

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl AsRef<[u8]> for MasterSeed {
    fn as_ref(&self) -> &[u8] {
        &self.0
    }
}

/// 金丝雀防时序攻击校验器
pub struct CanaryValidator {
    stored_hash: [u8; 32],
}

impl CanaryValidator {
    /// 构造新的金丝雀校验器
    pub fn new(hash: [u8; 32]) -> Self {
        Self { stored_hash: hash }
    }

    /// 使用常数时间比对候选哈希，彻底杜绝侧信道时序推断
    pub fn verify_constant_time(&self, candidate_hash: &[u8; 32]) -> bool {
        self.stored_hash.ct_eq(candidate_hash).into()
    }
}
