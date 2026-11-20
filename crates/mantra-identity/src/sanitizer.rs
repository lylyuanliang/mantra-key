//! Web 域名规范化清洗与 eTLD+1 提取流水线

use std::net::IpAddr;
use thiserror::Error;

/// 标识解析与归一化错误
#[derive(Error, Debug, PartialEq, Eq)]
pub enum IdentityError {
    #[error("无效 URL 格式: {0}")]
    InvalidUrl(String),
}

/// 剥离协议、认证凭据、端口、路径与查询参数，提取规范 eTLD+1
pub fn normalize_url(raw_url: &str) -> Result<String, IdentityError> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() {
        return Err(IdentityError::InvalidUrl(raw_url.to_string()));
    }

    // 1. 剥离协议头 (例如: https://, http://, ftp://)
    let without_scheme = if let Some(idx) = trimmed.find("://") {
        &trimmed[idx + 3..]
    } else {
        trimmed
    };

    // 2. 剥离路径、查询参数与锚点 (#, ?, /)
    let path_stripped = without_scheme
        .split('/')
        .next()
        .unwrap_or("")
        .split('?')
        .next()
        .unwrap_or("")
        .split('#')
        .next()
        .unwrap_or("");

    // 3. 剥离认证凭据 (例如: user:pass@host)
    let host_with_port = path_stripped
        .rsplit('@')
        .next()
        .unwrap_or("");

    // 4. 处理 IPv6 方括号与端口号剥离
    let host_raw = if host_with_port.starts_with('[') {
        if let Some(end_bracket) = host_with_port.find(']') {
            &host_with_port[1..end_bracket]
        } else {
            host_with_port
        }
    } else {
        host_with_port
            .split(':')
            .next()
            .unwrap_or("")
    };

    // 5. 剔除 DNS 根域前后点并转为小写
    let host = host_raw
        .trim_matches('.')
        .to_lowercase();

    if host.is_empty() {
        return Err(IdentityError::InvalidUrl(raw_url.to_string()));
    }

    // 6. 局域网 IP、回环地址或 localhost 直接穿透，不走 PSL
    if host == "localhost" || host.parse::<IpAddr>().is_ok() {
        return Ok(host);
    }

    // 7. 私有托管公共后缀（防止不同租户共享派生密钥）
    let private_suffixes = [
        "github.io",
        "gitlab.io",
        "vercel.app",
        "netlify.app",
        "pages.dev",
        "herokuapp.com",
        "azurewebsites.net",
    ];

    for suffix in &private_suffixes {
        if host.ends_with(suffix) && host.len() > suffix.len() {
            let sep_idx = host.len() - suffix.len() - 1;
            if host.as_bytes()[sep_idx] == b'.' {
                let prefix = &host[..sep_idx];
                let sub = prefix
                    .split('.')
                    .next_back()
                    .unwrap_or("");
                if !sub.is_empty() {
                    return Ok(format!("{}.{}", sub, suffix));
                }
            }
        }
    }

    // 8. 常见多段国家与地区复合公共后缀 (ccTLD)
    let special_suffixes = [
        "co.uk",
        "gov.uk",
        "ac.uk",
        "org.uk",
        "net.uk",
        "com.cn",
        "net.cn",
        "org.cn",
        "gov.cn",
        "edu.cn",
        "com.hk",
        "org.hk",
        "edu.hk",
        "gov.hk",
        "net.hk",
        "com.tw",
        "org.tw",
        "edu.tw",
        "gov.tw",
        "net.tw",
        "co.jp",
        "ne.jp",
        "or.jp",
        "ac.jp",
        "go.jp",
        "com.au",
        "net.au",
        "org.au",
        "edu.au",
        "gov.au",
    ];

    for suffix in &special_suffixes {
        if host.ends_with(suffix) {
            if host.len() == suffix.len() {
                return Ok(host);
            }
            let sep_idx = host.len() - suffix.len() - 1;
            if host.as_bytes()[sep_idx] == b'.' {
                let prefix = &host[..sep_idx];
                let sub = prefix
                    .split('.')
                    .next_back()
                    .unwrap_or("");
                if !sub.is_empty() {
                    return Ok(format!("{}.{}", sub, suffix));
                }
            }
        }
    }

    // 9. 通用顶级域 eTLD+1 提取（保留最后两级）
    let parts: Vec<&str> = host
        .split('.')
        .collect();

    if parts.len() <= 2 {
        Ok(host)
    } else {
        let last_two = format!(
            "{}.{}",
            parts[parts.len() - 2],
            parts[parts.len() - 1]
        );
        Ok(last_two)
    }
}
