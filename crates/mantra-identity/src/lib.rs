//! 密诀 (MantraKey) 标识归一化与进程智能匹配引擎
//!
//! 提供 Web URL 洗涤与 eTLD+1 提取、跨生态 SSO 等价组映射以及桌面/移动端进程映射能力。

use std::ops::Deref;

pub mod sanitizer;
pub mod sso;

pub use sanitizer::normalize_url;
pub use sanitizer::IdentityError;
pub use sso::normalize_process_name;
pub use sso::resolve_sso_canonical;

/// 规范化主标识 Newtype 包装
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct CanonicalIdentity(pub String);

impl CanonicalIdentity {
    pub fn new(identity: String) -> Self {
        Self(identity)
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

impl Deref for CanonicalIdentity {
    type Target = str;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl AsRef<str> for CanonicalIdentity {
    fn as_ref(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Display for CanonicalIdentity {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

/// 全流程一体化归一化管线：自动识别进程名或 Web 链接并经过 SSO 收敛
pub fn normalize_identity(input: &str) -> Result<String, IdentityError> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(IdentityError::InvalidUrl(input.to_string()));
    }

    let process_mapped = normalize_process_name(trimmed);
    if process_mapped != trimmed || trimmed.to_lowercase().ends_with(".exe") {
        return Ok(resolve_sso_canonical(&process_mapped));
    }

    let url_normalized = normalize_url(trimmed)?;
    Ok(resolve_sso_canonical(&url_normalized))
}

/// 归一化并封装为规范标识结构体
pub fn normalize_to_canonical(input: &str) -> Result<CanonicalIdentity, IdentityError> {
    normalize_identity(input).map(CanonicalIdentity)
}
