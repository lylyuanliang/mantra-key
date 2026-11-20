//! 密诀 (MantraKey) 跨端轻量沙箱引擎执行环境封装

use crate::abi::{
    CryptoDeriveContext,
    EncryptedManifestPayload,
    PluginError,
    PluginManifest,
    StorageConnectionTestResult,
    StoragePushResult,
    ToolActionButton,
    ToolActionResult,
    ToolCardViewModel,
};

/// 轻量沙箱引擎执行环境宿主封装
#[derive(Debug, Default, Clone)]
pub struct PluginEngine;

impl PluginEngine {
    /// 构造新的沙箱引擎实例
    pub fn new() -> Self {
        Self
    }

    /// 执行插件 Hook 测试桩（单向字节线性变换，保证无内存越界与数据完整）
    pub fn mock_execute_hook(&self, input: &[u8]) -> Result<Vec<u8>, PluginError> {
        let transformed = input
            .iter()
            .map(|b| b.wrapping_add(1))
            .collect();
        Ok(transformed)
    }

    /// 宿主网络安全网关拦截审计：核对插件权限清单的 network_whitelist
    pub fn verify_network_access(
        &self,
        manifest: &PluginManifest,
        host: &str,
    ) -> Result<(), PluginError> {
        if manifest.is_network_allowed(host) {
            Ok(())
        } else {
            Err(PluginError::NetworkAccessDenied)
        }
    }

    /// 密码学扩展 Hook 执行（严格入参脱敏：仅传递不可逆中间随机熵切片与元数据上下文）
    pub fn execute_crypto_hook(
        &self,
        intermediate_entropy: &[u8],
        ctx: &CryptoDeriveContext,
    ) -> Result<Vec<u8>, PluginError> {
        if intermediate_entropy.is_empty() {
            return Err(PluginError::HookExecutionFailed(
                "中间熵数据切片不能为空".to_string(),
            ));
        }

        // 模拟沙箱内部派生扩展运算：结合上下文盐值单向哈希混合
        let mut transformed = Vec::with_capacity(intermediate_entropy.len());
        let domain_bytes = ctx.domain.as_bytes();
        let domain_salt = domain_bytes.first().copied().unwrap_or(0x42);

        for (i, &byte) in intermediate_entropy.iter().enumerate() {
            let offset = (i as u8).wrapping_mul(7);
            let mixed = byte ^ domain_salt ^ offset;
            transformed.push(mixed);
        }

        Ok(transformed)
    }

    /// 实用工具面板 Hook：渲染卡片 ViewModel
    pub fn render_tool_card(
        &self,
        _domain: &str,
        _username: &str,
    ) -> Result<ToolCardViewModel, PluginError> {
        Ok(ToolCardViewModel {
            primary_text: "123 456".to_string(),
            sub_text: Some("30s 有效期".to_string()),
            progress_ratio: Some(0.75),
            action_buttons: vec![ToolActionButton {
                action_id: "copy_code".to_string(),
                label: "复制".to_string(),
                style: "primary".to_string(),
            }],
        })
    }

    /// 实用工具面板 Hook：执行卡片动作交互
    pub fn handle_tool_action(
        &self,
        action_id: &str,
        _payload: &[u8],
    ) -> Result<ToolActionResult, PluginError> {
        match action_id {
            "copy_code" => Ok(ToolActionResult {
                toast_message: Some("动态验证码已复制".to_string()),
                should_copy_text: Some("123456".to_string()),
            }),
            _ => Err(PluginError::HookExecutionFailed(format!(
                "未知的工具动作标识: {}",
                action_id
            ))),
        }
    }

    /// 存储适配器 Hook：连通性测试
    pub fn test_storage_connection(&self, endpoint: &str) -> StorageConnectionTestResult {
        if endpoint.is_empty() {
            StorageConnectionTestResult {
                success: false,
                latency_ms: 0,
                error_message: Some("端点 URL 不能为空".to_string()),
            }
        } else {
            StorageConnectionTestResult {
                success: true,
                latency_ms: 18,
                error_message: None,
            }
        }
    }

    /// 存储适配器 Hook：拉取密文清单封包（插件无权解密，仅透明搬运）
    pub fn fetch_encrypted_manifest(&self) -> Result<EncryptedManifestPayload, PluginError> {
        // 构造标准 MKEY 二进制信封模拟密文流
        let mut mock_blob = Vec::new();
        mock_blob.extend_from_slice(b"MKEY\x01");
        // 12-byte Nonce
        mock_blob.extend_from_slice(&[0xaa; 12]);
        // Mock 密文载荷 + Tag
        mock_blob.extend_from_slice(b"OPAQUE_ENCRYPTED_CIPHERTEXT_STREAM_AND_TAG");

        Ok(EncryptedManifestPayload {
            encrypted_blob: mock_blob,
            etag: Some("etag-v1-test".to_string()),
            last_modified: Some("2026-11-17T12:00:00Z".to_string()),
        })
    }

    /// 存储适配器 Hook：推送密文清单封包
    pub fn push_encrypted_manifest(
        &self,
        blob: &[u8],
        _etag: Option<&str>,
    ) -> Result<StoragePushResult, PluginError> {
        if !blob.starts_with(b"MKEY") {
            return Err(PluginError::SandboxRestricted(
                "非法封包格式：存储适配器仅允许推送合法 MKEY 密文封包".to_string(),
            ));
        }

        Ok(StoragePushResult {
            success: true,
            new_etag: Some("etag-v2-updated".to_string()),
            conflict_detected: false,
        })
    }
}
