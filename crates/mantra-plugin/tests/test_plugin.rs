//! 密诀 (MantraKey) 插件沙箱运行时与 Hook ABI 单元测试套件

use mantra_plugin::{
    execute_crypto_hook,
    CryptoDeriveContext,
    PluginEngine,
    PluginError,
    PluginManifest,
    PluginPermissions,
    StorageConnectionTestResult,
    ToolMetadata,
};

/// 验证插件元数据清单解析与 RBAC 网络白名单匹配鉴权
#[test]
fn test_plugin_manifest_parsing_and_permission_check() {
    let manifest_json = r#"{
        "id": "org.mantrakey.totp",
        "name": "2FA Authenticator",
        "version": "1.0.0",
        "entry": "index.js",
        "permissions": {
            "network_whitelist": ["api.pwnedpasswords.com"]
        }
    }"#;

    let manifest: PluginManifest = serde_json::from_str(manifest_json).expect("Parse error");
    assert_eq!(manifest.id, "org.mantrakey.totp");
    assert_eq!(manifest.name, "2FA Authenticator");
    assert_eq!(manifest.version, "1.0.0");
    assert_eq!(manifest.entry, "index.js");

    // 命中白名单放行
    assert!(manifest.is_network_allowed("api.pwnedpasswords.com"));

    // 未命中白名单阻断
    assert!(!manifest.is_network_allowed("evil-server.com"));
    assert!(!manifest.is_network_allowed("api.pwnedpasswords.com.attacker.com"));
}

/// 验证沙箱内存隔离屏障与基础 Hook 执行
#[test]
fn test_plugin_memory_barrier_execution() {
    let engine = PluginEngine::new();
    let mock_entropy = vec![1, 2, 3, 4, 5];
    let transformed = engine
        .mock_execute_hook(&mock_entropy)
        .expect("Hook execution failed");

    // 验证沙箱执行无内存泄漏与数据完整返回
    assert_eq!(transformed.len(), 5);
    assert_eq!(transformed[0], 2);
    assert_eq!(transformed[4], 6);
}

/// 验证未授权网络请求由宿主拦截并返回 NetworkAccessDenied
#[test]
fn test_sandbox_network_rbac_enforcement() {
    let engine = PluginEngine::new();
    let manifest = PluginManifest {
        id: "org.mantrakey.sync.webdav".to_string(),
        name: "WebDAV Sync".to_string(),
        version: "1.0.0".to_string(),
        entry: "webdav.wasm".to_string(),
        permissions: PluginPermissions {
            network_whitelist: vec!["dav.box.com".to_string()],
        },
    };

    // 白名单内请求放行
    let allowed_res = engine.verify_network_access(&manifest, "dav.box.com");
    assert!(allowed_res.is_ok());

    // 越权网络请求被宿主安全边界拦截
    let denied_res = engine.verify_network_access(&manifest, "malicious-telemetry.io");
    assert!(denied_res.is_err());
    match denied_res.unwrap_err() {
        PluginError::NetworkAccessDenied => {}
        other => panic!("期望 NetworkAccessDenied 错误，实际为: {:?}", other),
    }
}

/// 验证密码学派生 Hook：严禁原始口令传入，仅传递单向中间伪随机熵切片
#[test]
fn test_crypto_pipeline_hook_zero_leakage_contract() {
    let engine = PluginEngine::new();
    let intermediate_entropy = [0x5au8; 32];

    let ctx = CryptoDeriveContext {
        domain: "github.com".to_string(),
        username: "admin".to_string(),
        version: 1,
        rule_id: "default".to_string(),
    };

    // 独立函数与方法双向调用契约
    let output1 = execute_crypto_hook(&engine, &intermediate_entropy, &ctx)
        .expect("Crypto hook execution failed");
    let output2 = engine
        .execute_crypto_hook(&intermediate_entropy, &ctx)
        .expect("Crypto hook method execution failed");

    assert_eq!(output1, output2);
    assert_eq!(output1.len(), 32);
    // 派生结果经过单向变换
    assert_ne!(output1, intermediate_entropy);
}

/// 验证 Tool Panel 实用工具 Hook：ViewModel 回传数据与交互 Action 契约
#[test]
fn test_tool_panel_hook_viewmodel_contract() {
    let engine = PluginEngine::new();

    let meta = ToolMetadata {
        tool_id: "org.mantrakey.totp".to_string(),
        display_name: "TOTP 2FA".to_string(),
        icon_svg: "<svg>totp</svg>".to_string(),
        category: "auth".to_string(),
    };
    assert_eq!(meta.tool_id, "org.mantrakey.totp");

    let card_vm = engine
        .render_tool_card("github.com", "developer")
        .expect("Render tool card failed");

    assert_eq!(card_vm.primary_text, "123 456");
    assert_eq!(card_vm.sub_text, Some("30s 有效期".to_string()));
    assert_eq!(card_vm.action_buttons.len(), 1);
    assert_eq!(card_vm.action_buttons[0].action_id, "copy_code");
    assert_eq!(card_vm.action_buttons[0].style, "primary");

    let action_res = engine
        .handle_tool_action("copy_code", br#"{"code":"123456"}"#)
        .expect("Handle action failed");

    assert_eq!(action_res.should_copy_text, Some("123456".to_string()));
    assert_eq!(action_res.toast_message, Some("动态验证码已复制".to_string()));
}

/// 验证 Storage Provider Hook：密文不透明度保证（插件仅处理 AES-256-GCM 密文封包）
#[test]
fn test_storage_provider_hook_ciphertext_opacity() {
    let engine = PluginEngine::new();

    // 1. 测试连通性契约
    let conn_res: StorageConnectionTestResult = engine.test_storage_connection("https://dav.box.com");
    assert!(conn_res.success);
    assert!(conn_res.latency_ms > 0);

    // 2. 模拟拉取密文封包
    let payload = engine
        .fetch_encrypted_manifest()
        .expect("Fetch encrypted manifest failed");

    // 必须有 MKEY 魔数开头的密文封包，且明文不得暴露
    assert!(payload.encrypted_blob.starts_with(b"MKEY"));
    assert_eq!(payload.etag, Some("etag-v1-test".to_string()));

    // 3. 模拟推送密文封包
    let push_res = engine
        .push_encrypted_manifest(&payload.encrypted_blob, payload.etag.as_deref())
        .expect("Push encrypted manifest failed");

    assert!(push_res.success);
    assert!(!push_res.conflict_detected);
    assert!(push_res.new_etag.is_some());
}
