//! 密诀 (MantraKey) 跨端插件沙箱 Hook ABI 与元数据契约定义

use serde::{Deserialize, Serialize};
use thiserror::Error;

/// 插件沙箱运行时与 Hook 执行错误定义
#[derive(Error, Debug, PartialEq, Eq)]
pub enum PluginError {
    #[error("沙箱执行受限: {0}")]
    SandboxRestricted(String),

    #[error("网络访问越权")]
    NetworkAccessDenied,

    #[error("Hook 执行失败: {0}")]
    HookExecutionFailed(String),
}

/// 插件能力与 RBAC 权限声明清单
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PluginPermissions {
    /// 允许访问的网络主机名/域名白名单
    pub network_whitelist: Vec<String>,
}

/// 插件核心元数据清单 (`plugin.json`)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PluginManifest {
    /// 插件唯一标识符 (反向域名格式，如 "org.mantrakey.totp")
    pub id: String,

    /// 插件人类可读名称
    pub name: String,

    /// 语义化版本号
    pub version: String,

    /// 入口文件路径 (如 "index.js" 或 "index.wasm")
    pub entry: String,

    /// 权限声明
    pub permissions: PluginPermissions,
}

impl PluginManifest {
    /// 检查指定网络主机是否在白名单内
    pub fn is_network_allowed(&self, host: &str) -> bool {
        let clean_host = host.trim().to_lowercase();
        self.permissions
            .network_whitelist
            .iter()
            .any(|allowed| allowed.trim().to_lowercase() == clean_host)
    }
}

/// 密码学派生 Hook 上下文（严禁携带 MasterMantra，仅包含非敏感业务元数据）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CryptoDeriveContext {
    /// 归一化规范域名
    pub domain: String,

    /// 账户标识
    pub username: String,

    /// 世代版本号
    pub version: u32,

    /// 派生规则标识
    pub rule_id: String,
}

/// 工具面板 Hook 元数据定义
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ToolMetadata {
    /// 工具唯一标识
    pub tool_id: String,

    /// 显示名称
    pub display_name: String,

    /// 矢量图标内容
    pub icon_svg: String,

    /// 类别标签
    pub category: String,
}

/// 工具面板交互按钮定义
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ToolActionButton {
    /// 动作标识
    pub action_id: String,

    /// 按钮文案
    pub label: String,

    /// 按钮视觉样式 (primary / ghost / danger)
    pub style: String,
}

/// 工具面板卡片统一渲染 ViewModel（遵循 Obsidian Cipher 设计规范）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ToolCardViewModel {
    /// 主文本（例如 TOTP 6 位验证码、强度评分等）
    pub primary_text: String,

    /// 副文本提示
    pub sub_text: Option<String>,

    /// 进度比例（0.0 ~ 1.0）
    pub progress_ratio: Option<f32>,

    /// 动作按钮列表
    pub action_buttons: Vec<ToolActionButton>,
}

/// 工具面板交互触发结果
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ToolActionResult {
    /// 吐司提示文本
    pub toast_message: Option<String>,

    /// 宿主需要自动写入剪贴板的脱敏文本
    pub should_copy_text: Option<String>,
}

/// 存储适配器网络连接测试结果
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StorageConnectionTestResult {
    /// 是否连接成功
    pub success: bool,

    /// 响应往返延迟 (毫秒)
    pub latency_ms: u64,

    /// 失败时的错误信息
    pub error_message: Option<String>,
}

/// 存储适配器密文封包（插件沙箱永远只能接触 AES-256-GCM 密文封包，无权解密）
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EncryptedManifestPayload {
    /// 密文数据流（以 MKEY 开头，包含 Nonce 与 GCM Tag）
    pub encrypted_blob: Vec<u8>,

    /// 远程实体标签 (ETag)
    pub etag: Option<String>,

    /// 最后修改时间
    pub last_modified: Option<String>,
}

/// 存储适配器推送同步结果
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StoragePushResult {
    /// 是否推送成功
    pub success: bool,

    /// 更新后的新 ETag
    pub new_etag: Option<String>,

    /// 是否检测到并发写冲突
    pub conflict_detected: bool,
}
