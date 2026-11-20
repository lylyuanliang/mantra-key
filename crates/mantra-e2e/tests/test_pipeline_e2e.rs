//! 全链路端到端四阶段联动集成测试
//!
//! 阶段 1：mantra-identity（输入标识清洗与 SSO 收敛）；
//! 阶段 2：mantra-crypto（两阶段 KDF：计算 MasterSeed、HKDF 派生各站点密码与 SyncKey）；
//! 阶段 3：mantra-sync（AES-256-GCM MKEY 封包加密、模拟多端传输解包、CRDT 字段级自愈合并）；
//! 阶段 4：mantra-plugin（沙箱安全网关派发中间随机熵、验证单向变换与主口令零泄露）。

use std::collections::HashMap;

use mantra_e2e::MantraFullPipeline;
use mantra_plugin::PluginEngine;
use mantra_sync::{AccountEntry, DomainEntry, MantraManifest};

#[test]
fn test_end_to_end_four_stage_integration() {
    let master_mantra = "DeterministicTestPassphrase2026!";
    let salt = "salt_for_integration_testing_pipeline";

    // 初始化全链路管线
    let pipeline = MantraFullPipeline::new(master_mantra, salt)
        .expect("初始化全链路集成管线失败");

    // ==========================================
    // 阶段 1 & 阶段 2：标识归一化与两阶段密码派生
    // ==========================================
    let web_input = "https://auth.github.com/login?service=git";
    let cred = pipeline
        .derive_for_target(web_input, "alice_engineer", 1, 16, 7)
        .expect("站点密码派生失败");

    assert_eq!(cred.canonical_domain, "github.com");
    assert_eq!(cred.username, "alice_engineer");
    assert_eq!(cred.password.len(), 16);

    // 验证第二次派生具有绝对比特级确定性
    let cred_repeat = pipeline
        .derive_for_target(web_input, "alice_engineer", 1, 16, 7)
        .expect("重复派生失败");
    assert_eq!(cred.password.as_str(), cred_repeat.password.as_str());

    // 进程名启发式派生测试
    let proc_input = "Steam.exe";
    let proc_cred = pipeline
        .derive_for_target(proc_input, "gamer_pro", 2, 20, 7)
        .expect("进程派生失败");
    assert_eq!(proc_cred.canonical_domain, "steampowered.com");
    assert_eq!(proc_cred.password.len(), 20);

    // ==========================================
    // 阶段 3：E2EE 二进制信封封包与 CRDT 多端自愈合并
    // ==========================================
    // 构造本地端清单
    let mut local_domains = HashMap::new();
    let mut github_accounts = HashMap::new();
    github_accounts.insert(
        "alice_engineer".to_string(),
        AccountEntry {
            username: "alice_engineer".to_string(),
            version: 1,
            updated_at: 1000,
            is_deleted: false,
        },
    );
    local_domains.insert(
        "github.com".to_string(),
        DomainEntry {
            canonical_domain: "github.com".to_string(),
            display_name: "GitHub".to_string(),
            rule: "alpha_num_sym_16".to_string(),
            accounts: github_accounts,
            updated_at: 1000,
        },
    );

    let mut local_manifest = MantraManifest {
        schema_version: 1,
        canary_hash: "canary_local_v1".to_string(),
        domains: local_domains,
        updated_at: 1000,
    };

    // 构造对端远程清单（包含版本更新与新站点）
    let mut remote_domains = HashMap::new();
    let mut remote_github_accounts = HashMap::new();
    remote_github_accounts.insert(
        "alice_engineer".to_string(),
        AccountEntry {
            username: "alice_engineer".to_string(),
            version: 2, // 远程端版本更新为 2
            updated_at: 2000,
            is_deleted: false,
        },
    );
    remote_domains.insert(
        "github.com".to_string(),
        DomainEntry {
            canonical_domain: "github.com".to_string(),
            display_name: "GitHub Global".to_string(),
            rule: "alpha_num_sym_16".to_string(),
            accounts: remote_github_accounts,
            updated_at: 2000,
        },
    );

    let remote_manifest = MantraManifest {
        schema_version: 1,
        canary_hash: "canary_remote_v2".to_string(),
        domains: remote_domains,
        updated_at: 2000,
    };

    // 模拟远端：加密打包为 MKEY 二进制信封
    let envelope_bytes = pipeline
        .create_sync_envelope(&remote_manifest)
        .expect("打包同步信封失败");

    // 验证信封魔数头为 MKEY
    assert!(envelope_bytes.len() >= 33);
    assert_eq!(&envelope_bytes[0..4], b"MKEY");

    // 模拟本地端：接收信封，解密并自愈合并进 local_manifest
    pipeline
        .unpack_and_merge_sync(&envelope_bytes, &mut local_manifest)
        .expect("解包并自愈合并失败");

    // 验证 CRDT 合并后 alice_engineer 版本已自愈升级为 2
    let updated_account = local_manifest
        .domains
        .get("github.com")
        .and_then(|d| d.accounts.get("alice_engineer"))
        .expect("未找到 alice_engineer 账号");
    assert_eq!(updated_account.version, 2);
    assert_eq!(local_manifest.canary_hash, "canary_remote_v2");

    // ==========================================
    // 阶段 4：沙箱安全网关与插件中间熵派发零泄露
    // ==========================================
    let plugin_engine = PluginEngine::new();
    let transformed_entropy = pipeline
        .execute_plugin_entropy_hook("github.com", "alice_engineer", 2, &plugin_engine)
        .expect("沙箱 Hook 派发失败");

    assert!(!transformed_entropy.is_empty());
    // 验证中间熵经过沙箱单向变换后与原始主口令字节绝不相等
    let master_bytes = master_mantra.as_bytes();
    assert_ne!(&transformed_entropy[..], &master_bytes[..master_bytes.len().min(transformed_entropy.len())]);
}
