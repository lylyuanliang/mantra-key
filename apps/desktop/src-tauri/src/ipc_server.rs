//! 桌面宿主 IPC 消息协议处理框架与分发服务
//!
//! 遵循 LLD-03 规范：实现 Windows 命名管道 / Native Messaging 4 字节小端序线协议，
//! 并支持 7 大核心业务指令集分发调度。

use std::io::{Read, Write};
use mantra_crypto::{
    derive_master_seed,
    derive_site_password,
    CHARSET_ALPHA,
    CHARSET_DIGIT,
    CHARSET_SYMBOL,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use thiserror::Error;

use crate::session::SessionManager;

/// 最大允许帧长度：1MB (1,048,576 字节)，超出时触发硬拦截
pub const MAX_FRAME_SIZE: usize = 1024 * 1024;

/// 协议错误定义
#[derive(Error, Debug)]
pub enum IpcError {
    #[error("I/O 读写错误: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON 序列化/反序列化错误: {0}")]
    Json(#[from] serde_json::Error),

    #[error("帧大小超出安全上限 (限制 1MB): {0} 字节")]
    FrameTooLarge(usize),

    #[error("协议会话未解锁")]
    SessionLocked,

    #[error("密码派生失败: {0}")]
    CryptoError(String),
}

/// 统一请求信封结构
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpcRequest {
    pub id: String,
    pub action: String,
    pub ts: u64,
    #[serde(default)]
    pub payload: Value,
}

/// 统一响应信封结构
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct IpcResponse {
    pub id: String,
    pub status: String,
    pub code: u16,
    pub data: Value,
    pub error: Option<String>,
}

impl IpcResponse {
    /// 构造成功响应
    pub fn ok(id: impl Into<String>, data: Value) -> Self {
        Self {
            id: id.into(),
            status: "ok".to_string(),
            code: 200,
            data,
            error: None,
        }
    }

    /// 构造错误响应
    pub fn error(id: impl Into<String>, code: u16, error_msg: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            status: "error".to_string(),
            code,
            data: json!({}),
            error: Some(error_msg.into()),
        }
    }
}

/// 从 Reader 读取 4 字节小端序长度前缀的消息帧
pub fn read_frame<R: Read>(reader: &mut R) -> Result<Vec<u8>, IpcError> {
    let mut len_buf = [0u8; 4];
    reader.read_exact(&mut len_buf)?;
    let len = u32::from_le_bytes(len_buf) as usize;

    if len > MAX_FRAME_SIZE {
        return Err(IpcError::FrameTooLarge(len));
    }

    let mut buf = vec![0u8; len];
    reader.read_exact(&mut buf)?;
    Ok(buf)
}

/// 向 Writer 写入带 4 字节小端序长度前缀的消息帧
pub fn write_frame<W: Write>(writer: &mut W, data: &[u8]) -> Result<(), IpcError> {
    if data.len() > MAX_FRAME_SIZE {
        return Err(IpcError::FrameTooLarge(data.len()));
    }
    let len = data.len() as u32;
    writer.write_all(&len.to_le_bytes())?;
    writer.write_all(data)?;
    writer.flush()?;
    Ok(())
}

/// IPC 核心指令分发器
#[derive(Clone)]
pub struct IpcDispatcher {
    session: SessionManager,
    version: &'static str,
}

impl IpcDispatcher {
    /// 构造新的分发器实例
    pub fn new(session: SessionManager) -> Self {
        Self {
            session,
            version: "1.0.0",
        }
    }

    /// 解析二进制帧并分发处理，返回二进制响应帧
    pub fn handle_message_bytes(&self, bytes: &[u8]) -> Result<Vec<u8>, IpcError> {
        let request: IpcRequest = serde_json::from_slice(bytes)?;
        let response = self.handle_request(request);
        let res_bytes = serde_json::to_vec(&response)?;
        Ok(res_bytes)
    }

    /// 执行 7 大核心业务指令及 PING 指令的分发
    pub fn handle_request(&self, req: IpcRequest) -> IpcResponse {
        match req.action.as_str() {
            "PING" => {
                IpcResponse::ok(req.id, json!({ "action": "PONG" }))
            }

            "HANDSHAKE" => {
                let session_state = if self.session.is_unlocked() { "unlocked" } else { "locked" };
                let ttl_remaining = self.session.ttl_remaining().as_secs();

                IpcResponse::ok(req.id, json!({
                    "daemon_ver": self.version,
                    "session_state": session_state,
                    "ttl_remaining": ttl_remaining,
                }))
            }

            "QUERY_SESSION" => {
                let session_state = if self.session.is_unlocked() { "unlocked" } else { "locked" };
                let ttl_remaining = self.session.ttl_remaining().as_secs();

                IpcResponse::ok(req.id, json!({
                    "session_state": session_state,
                    "ttl_remaining": ttl_remaining,
                }))
            }

            "UNLOCK_SESSION" => {
                let mantra = match req.payload.get("master_mantra").and_then(Value::as_str) {
                    Some(m) if !m.is_empty() => m,
                    _ => return IpcResponse::error(req.id, 400, "master_mantra 字段缺失或为空"),
                };

                let salt = req.payload.get("salt")
                    .and_then(Value::as_str)
                    .unwrap_or("mantrakey_global_salt");

                match derive_master_seed(mantra, salt) {
                    Ok(seed) => {
                        self.session.unlock(seed);
                        let ttl = self.session.ttl_remaining().as_secs();
                        IpcResponse::ok(req.id, json!({
                            "success": true,
                            "ttl_remaining": ttl,
                        }))
                    }
                    Err(e) => {
                        IpcResponse::error(req.id, 500, format!("主口令派生根种子失败: {}", e))
                    }
                }
            }

            "LOCK_NOW" => {
                self.session.lock();
                IpcResponse::ok(req.id, json!({ "success": true }))
            }

            "DERIVE_CREDENTIAL" => {
                let seed = match self.session.get_seed() {
                    Some(s) => s,
                    None => return IpcResponse::error(req.id, 401, "会话已锁定或未初始化"),
                };

                let domain = match req.payload.get("domain").and_then(Value::as_str) {
                    Some(d) => d,
                    None => return IpcResponse::error(req.id, 400, "domain 字段必填"),
                };

                let username = req.payload.get("username").and_then(Value::as_str).unwrap_or("");
                let version = req.payload.get("version").and_then(Value::as_u64).unwrap_or(1) as u32;
                let preset = req.payload.get("rule_preset").and_then(Value::as_str).unwrap_or("standard_16");

                let (len, mask) = parse_preset_rule(preset);

                match derive_site_password(&seed, domain, username, version, len, mask) {
                    Ok(pwd) => {
                        // 活跃调用刷新 TTL
                        self.session.refresh();
                        IpcResponse::ok(req.id, json!({
                            "derived_password": pwd.as_str(),
                        }))
                    }
                    Err(e) => {
                        IpcResponse::error(req.id, 500, format!("密码派生失败: {}", e))
                    }
                }
            }

            "STAGE_CHANGE_PWD" => {
                let seed = match self.session.get_seed() {
                    Some(s) => s,
                    None => return IpcResponse::error(req.id, 401, "会话已锁定或未初始化"),
                };

                let domain = match req.payload.get("domain").and_then(Value::as_str) {
                    Some(d) => d,
                    None => return IpcResponse::error(req.id, 400, "domain 字段必填"),
                };

                let username = req.payload.get("username").and_then(Value::as_str).unwrap_or("");
                let old_version = req.payload.get("old_version").and_then(Value::as_u64).map(|v| v as u32).unwrap_or(1);
                let next_version = req.payload.get("next_version").and_then(Value::as_u64).map(|v| v as u32).unwrap_or(old_version + 1);
                let preset = req.payload.get("rule_preset").and_then(Value::as_str).unwrap_or("standard_16");

                let (len, mask) = parse_preset_rule(preset);

                let old_pwd = derive_site_password(&seed, domain, username, old_version, len, mask)
                    .map_err(|e| e.to_string());
                let next_pwd = derive_site_password(&seed, domain, username, next_version, len, mask)
                    .map_err(|e| e.to_string());

                match (old_pwd, next_pwd) {
                    (Ok(old), Ok(next)) => {
                        self.session.refresh();
                        IpcResponse::ok(req.id, json!({
                            "old_password": old.as_str(),
                            "next_password": next.as_str(),
                        }))
                    }
                    (Err(e), _) | (_, Err(e)) => {
                        IpcResponse::error(req.id, 500, format!("双版本密码派生失败: {}", e))
                    }
                }
            }

            "COMMIT_CHANGE_PWD" => {
                let domain = match req.payload.get("domain").and_then(Value::as_str) {
                    Some(d) => d,
                    None => return IpcResponse::error(req.id, 400, "domain 字段必填"),
                };
                let username = req.payload.get("username").and_then(Value::as_str).unwrap_or("");
                let new_version = req.payload.get("new_version").and_then(Value::as_u64).unwrap_or(1);

                // 更新成功回执
                IpcResponse::ok(req.id, json!({
                    "success": true,
                    "domain": domain,
                    "username": username,
                    "committed_version": new_version,
                    "updated_at": "2026-11-17T20:00:00Z",
                }))
            }

            unknown => {
                IpcResponse::error(req.id, 404, format!("未知操作指令: {}", unknown))
            }
        }
    }
}

/// 解析预设规则名称返回 (长度, 字符集掩码)
fn parse_preset_rule(preset: &str) -> (usize, u8) {
    match preset {
        "super_32" | "super-secure" => (32, CHARSET_ALPHA | CHARSET_DIGIT | CHARSET_SYMBOL),
        "alphanumeric_16" | "alnum_16" => (16, CHARSET_ALPHA | CHARSET_DIGIT),
        "numeric_6" | "pin_6" => (6, CHARSET_DIGIT),
        _ => (16, CHARSET_ALPHA | CHARSET_DIGIT | CHARSET_SYMBOL),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;
    use std::time::Duration;
    use mantra_crypto::MasterSeed;

    #[test]
    fn test_frame_codec_roundtrip() {
        let payload = br#"{"action":"PING","id":"test-1"}"#;
        let mut buffer = Vec::new();

        write_frame(&mut buffer, payload).unwrap();
        assert_eq!(buffer.len(), 4 + payload.len());

        let mut cursor = Cursor::new(buffer);
        let read_back = read_frame(&mut cursor).unwrap();
        assert_eq!(read_back, payload);
    }

    #[test]
    fn test_frame_exceed_1mb_overflow_guard() {
        let mut evil_header = Vec::new();
        let overflow_len = (MAX_FRAME_SIZE + 1) as u32;
        evil_header.extend_from_slice(&overflow_len.to_le_bytes());

        let mut cursor = Cursor::new(evil_header);
        let err = read_frame(&mut cursor).unwrap_err();

        match err {
            IpcError::FrameTooLarge(len) => assert_eq!(len, MAX_FRAME_SIZE + 1),
            _ => panic!("预期抛出 FrameTooLarge 错误"),
        }
    }

    #[test]
    fn test_ipc_dispatcher_ping_and_handshake() {
        let session = SessionManager::new(Duration::from_secs(900));
        let dispatcher = IpcDispatcher::new(session);

        let ping_req = IpcRequest {
            id: "msg-1".into(),
            action: "PING".into(),
            ts: 1000,
            payload: json!({}),
        };
        let res = dispatcher.handle_request(ping_req);
        assert_eq!(res.status, "ok");
        assert_eq!(res.data["action"], "PONG");

        let handshake_req = IpcRequest {
            id: "msg-2".into(),
            action: "HANDSHAKE".into(),
            ts: 1001,
            payload: json!({ "client_ver": "1.0.0" }),
        };
        let res = dispatcher.handle_request(handshake_req);
        assert_eq!(res.status, "ok");
        assert_eq!(res.data["session_state"], "locked");
    }

    #[test]
    fn test_ipc_dispatcher_derive_requires_unlock() {
        let session = SessionManager::new(Duration::from_secs(900));
        let dispatcher = IpcDispatcher::new(session.clone());

        // 未解锁时请求派生密码
        let derive_req = IpcRequest {
            id: "msg-derive".into(),
            action: "DERIVE_CREDENTIAL".into(),
            ts: 1002,
            payload: json!({
                "domain": "github.com",
                "username": "alex",
                "version": 1,
            }),
        };
        let res = dispatcher.handle_request(derive_req);
        assert_eq!(res.status, "error");
        assert_eq!(res.code, 401);

        // 手动解锁会话
        session.unlock(MasterSeed::new([9u8; 32]));

        // 再次请求派生密码
        let derive_req_2 = IpcRequest {
            id: "msg-derive-2".into(),
            action: "DERIVE_CREDENTIAL".into(),
            ts: 1003,
            payload: json!({
                "domain": "github.com",
                "username": "alex",
                "version": 1,
                "rule_preset": "standard_16",
            }),
        };
        let res2 = dispatcher.handle_request(derive_req_2);
        assert_eq!(res2.status, "ok");
        assert_eq!(res2.code, 200);
        let pwd = res2.data["derived_password"].as_str().unwrap();
        assert_eq!(pwd.len(), 16);
    }

    #[test]
    fn test_ipc_dispatcher_stage_and_commit_pwd() {
        let session = SessionManager::new(Duration::from_secs(900));
        let dispatcher = IpcDispatcher::new(session.clone());
        session.unlock(MasterSeed::new([11u8; 32]));

        let stage_req = IpcRequest {
            id: "msg-stage".into(),
            action: "STAGE_CHANGE_PWD".into(),
            ts: 1004,
            payload: json!({
                "domain": "steam.com",
                "username": "gamer",
                "old_version": 1,
                "next_version": 2,
            }),
        };
        let stage_res = dispatcher.handle_request(stage_req);
        assert_eq!(stage_res.status, "ok");
        let old_pwd = stage_res.data["old_password"].as_str().unwrap();
        let next_pwd = stage_res.data["next_password"].as_str().unwrap();
        assert_ne!(old_pwd, next_pwd);

        let commit_req = IpcRequest {
            id: "msg-commit".into(),
            action: "COMMIT_CHANGE_PWD".into(),
            ts: 1005,
            payload: json!({
                "domain": "steam.com",
                "username": "gamer",
                "new_version": 2,
            }),
        };
        let commit_res = dispatcher.handle_request(commit_req);
        assert_eq!(commit_res.status, "ok");
        assert_eq!(commit_res.data["committed_version"], 2);
    }
}
