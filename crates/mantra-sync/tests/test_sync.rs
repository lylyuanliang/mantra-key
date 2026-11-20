use mantra_sync::{
    pack_envelope, unpack_envelope, AccountEntry, DomainEntry, MantraManifest, SyncError,
};
use std::collections::HashMap;

#[test]
fn test_envelope_encrypt_decrypt_roundtrip() {
    let key = [0x42u8; 32];
    let secret_payload = br#"{"domains":{"github.com":{"version":1}}}"#;

    let encrypted_blob = pack_envelope(secret_payload, &key).expect("封包打包失败");

    // 检查 Header 魔数 "MKEY" (4 字节)
    assert_eq!(&encrypted_blob[0..4], b"MKEY");
    // 检查 Version (1 字节)
    assert_eq!(encrypted_blob[4], 0x01);
    // 检查最小长度: 4(Magic) + 1(Ver) + 12(Nonce) + payload.len() + 16(Tag)
    assert_eq!(encrypted_blob.len(), 4 + 1 + 12 + secret_payload.len() + 16);

    let decrypted = unpack_envelope(&encrypted_blob, &key).expect("封包解包失败");
    assert_eq!(decrypted, secret_payload);
}

#[test]
fn test_envelope_nonce_randomness() {
    let key = [0x55u8; 32];
    let payload = b"sensitive manifest data";

    let blob1 = pack_envelope(payload, &key).expect("第一次封包失败");
    let blob2 = pack_envelope(payload, &key).expect("第二次封包失败");

    // 每次封包必须采用独立的密码学随机 Nonce，即使明文和密钥完全相同，密文也必须不同
    assert_ne!(
        blob1, blob2,
        "两次加密产生的信封不应相同（Nonce 必须随机生成）"
    );

    // 提取 Nonce 部分 (offset 5..17)
    assert_ne!(&blob1[5..17], &blob2[5..17], "Nonce 必须不同");

    // 两者解包后数据必须一致
    let dec1 = unpack_envelope(&blob1, &key).expect("解密 blob1 失败");
    let dec2 = unpack_envelope(&blob2, &key).expect("解密 blob2 失败");
    assert_eq!(dec1, payload);
    assert_eq!(dec2, payload);
}

#[test]
fn test_envelope_tamper_detection() {
    let key = [0x7au8; 32];
    let payload = b"confidential account manifest payload";
    let valid_blob = pack_envelope(payload, &key).expect("封包打包失败");

    // 1. 篡改魔数头部 (前 4 字节)
    let mut tampered_magic = valid_blob.clone();
    tampered_magic[0] ^= 0x01;
    let err_magic = unpack_envelope(&tampered_magic, &key).unwrap_err();
    match err_magic {
        SyncError::MagicMismatch => {}
        other => panic!("期望 MagicMismatch，但得到: {:?}", other),
    }

    // 2. 篡改版本号
    let mut tampered_version = valid_blob.clone();
    tampered_version[4] = 0x99;
    let err_ver = unpack_envelope(&tampered_version, &key).unwrap_err();
    match err_ver {
        SyncError::InvalidEnvelopeFormat => {}
        other => panic!("期望 InvalidEnvelopeFormat，但得到: {:?}", other),
    }

    // 3. 篡改 Nonce (字节 5..17)
    let mut tampered_nonce = valid_blob.clone();
    tampered_nonce[5] ^= 0x01;
    let err_nonce = unpack_envelope(&tampered_nonce, &key).unwrap_err();
    match err_nonce {
        SyncError::DecryptionFailed => {}
        other => panic!("期望 DecryptionFailed，但得到: {:?}", other),
    }

    // 4. 单比特篡改密文区
    let mut tampered_ciphertext = valid_blob.clone();
    tampered_ciphertext[20] ^= 0x80;
    let err_cipher = unpack_envelope(&tampered_ciphertext, &key).unwrap_err();
    match err_cipher {
        SyncError::DecryptionFailed => {}
        other => panic!("期望 DecryptionFailed，但得到: {:?}", other),
    }

    // 5. 篡改末尾 GCM Tag
    let mut tampered_tag = valid_blob.clone();
    let last_idx = tampered_tag.len() - 1;
    tampered_tag[last_idx] ^= 0x01;
    let err_tag = unpack_envelope(&tampered_tag, &key).unwrap_err();
    match err_tag {
        SyncError::DecryptionFailed => {}
        other => panic!("期望 DecryptionFailed，但得到: {:?}", other),
    }

    // 6. 截断数据 (长度不足 33 字节)
    let truncated_blob = &valid_blob[0..20];
    let err_trunc = unpack_envelope(truncated_blob, &key).unwrap_err();
    match err_trunc {
        SyncError::InvalidEnvelopeFormat => {}
        other => panic!("期望 InvalidEnvelopeFormat，但得到: {:?}", other),
    }

    // 7. 错误密钥解密
    let wrong_key = [0x99u8; 32];
    let err_key = unpack_envelope(&valid_blob, &wrong_key).unwrap_err();
    match err_key {
        SyncError::DecryptionFailed => {}
        other => panic!("期望 DecryptionFailed，但得到: {:?}", other),
    }
}

#[test]
fn test_crdt_field_level_merge_monotonicity() {
    // 本地状态：包含 github.com (admin v1, user_local v5)
    let mut local = MantraManifest {
        schema_version: 1,
        canary_hash: "canary_v1".to_string(),
        domains: HashMap::new(),
        updated_at: 1000,
    };
    let mut local_accounts = HashMap::new();
    local_accounts.insert(
        "admin".to_string(),
        AccountEntry {
            username: "admin".to_string(),
            version: 1,
            updated_at: 1000,
            is_deleted: false,
        },
    );
    local_accounts.insert(
        "user_local".to_string(),
        AccountEntry {
            username: "user_local".to_string(),
            version: 5,
            updated_at: 1000,
            is_deleted: false,
        },
    );
    local.domains.insert(
        "github.com".to_string(),
        DomainEntry {
            canonical_domain: "github.com".to_string(),
            display_name: "GitHub Old".to_string(),
            rule: "default".to_string(),
            accounts: local_accounts,
            updated_at: 1000,
        },
    );

    // 远程状态：包含 github.com (admin v3 更高, user_local v2 较低, user_remote v1 新增)
    // 另外包含 gitlab.com 新域名
    let mut remote = MantraManifest {
        schema_version: 1,
        canary_hash: "canary_v2".to_string(),
        domains: HashMap::new(),
        updated_at: 2000,
    };
    let mut remote_accounts = HashMap::new();
    remote_accounts.insert(
        "admin".to_string(),
        AccountEntry {
            username: "admin".to_string(),
            version: 3,
            updated_at: 2000,
            is_deleted: false,
        },
    );
    remote_accounts.insert(
        "user_local".to_string(),
        AccountEntry {
            username: "user_local".to_string(),
            version: 2,
            updated_at: 2000,
            is_deleted: false,
        },
    );
    remote_accounts.insert(
        "user_remote".to_string(),
        AccountEntry {
            username: "user_remote".to_string(),
            version: 1,
            updated_at: 2000,
            is_deleted: false,
        },
    );
    remote.domains.insert(
        "github.com".to_string(),
        DomainEntry {
            canonical_domain: "github.com".to_string(),
            display_name: "GitHub New".to_string(),
            rule: "custom".to_string(),
            accounts: remote_accounts,
            updated_at: 2000,
        },
    );

    let mut gitlab_accounts = HashMap::new();
    gitlab_accounts.insert(
        "developer".to_string(),
        AccountEntry {
            username: "developer".to_string(),
            version: 1,
            updated_at: 2000,
            is_deleted: false,
        },
    );
    remote.domains.insert(
        "gitlab.com".to_string(),
        DomainEntry {
            canonical_domain: "gitlab.com".to_string(),
            display_name: "GitLab Enterprise".to_string(),
            rule: "gitlab_rule".to_string(),
            accounts: gitlab_accounts,
            updated_at: 2000,
        },
    );

    // 执行 CRDT 合并
    local.merge(remote);

    // 1. 顶层金丝雀与时间戳：最新胜出 (remote updated_at 2000 > local 1000)
    assert_eq!(local.canary_hash, "canary_v2");
    assert_eq!(local.updated_at, 2000);

    // 2. 域名全量并集：同时保留 github.com 与 gitlab.com
    assert_eq!(local.domains.len(), 2);
    assert!(local.domains.contains_key("github.com"));
    assert!(local.domains.contains_key("gitlab.com"));

    // 3. github.com 字段级验证
    let gh = local.domains.get("github.com").unwrap();
    // display_name 与 rule 遵循 LWW (remote 胜出)
    assert_eq!(gh.display_name, "GitHub New");
    assert_eq!(gh.rule, "custom");
    assert_eq!(gh.updated_at, 2000);

    // 账号全量并集: admin, user_local, user_remote
    assert_eq!(gh.accounts.len(), 3);

    // 版本号单调取大验证:
    // admin: local(1) vs remote(3) => 3
    assert_eq!(gh.accounts.get("admin").unwrap().version, 3);
    // user_local: local(5) vs remote(2) => 5 (单调取大，即使 remote 时间戳更新)
    assert_eq!(gh.accounts.get("user_local").unwrap().version, 5);
    // user_remote: 新增
    assert_eq!(gh.accounts.get("user_remote").unwrap().version, 1);
}

#[test]
fn test_crdt_tombstone_preservation() {
    let mut local = MantraManifest {
        schema_version: 1,
        canary_hash: "canary_initial".to_string(),
        domains: HashMap::new(),
        updated_at: 1000,
    };
    let mut local_accounts = HashMap::new();
    local_accounts.insert(
        "admin".to_string(),
        AccountEntry {
            username: "admin".to_string(),
            version: 2,
            updated_at: 1000,
            is_deleted: false,
        },
    );
    local_accounts.insert(
        "old_user".to_string(),
        AccountEntry {
            username: "old_user".to_string(),
            version: 1,
            updated_at: 3000, // 本地在 3000 重新激活
            is_deleted: false,
        },
    );
    local.domains.insert(
        "example.com".to_string(),
        DomainEntry {
            canonical_domain: "example.com".to_string(),
            display_name: "Example".to_string(),
            rule: "standard".to_string(),
            accounts: local_accounts,
            updated_at: 3000,
        },
    );

    let mut remote = MantraManifest {
        schema_version: 1,
        canary_hash: "canary_initial".to_string(),
        domains: HashMap::new(),
        updated_at: 2000,
    };
    let mut remote_accounts = HashMap::new();
    // remote 在 2000 删除了 admin
    remote_accounts.insert(
        "admin".to_string(),
        AccountEntry {
            username: "admin".to_string(),
            version: 2,
            updated_at: 2000,
            is_deleted: true,
        },
    );
    // remote 在 2000 删除了 old_user，但本地在 3000 已重新激活
    remote_accounts.insert(
        "old_user".to_string(),
        AccountEntry {
            username: "old_user".to_string(),
            version: 1,
            updated_at: 2000,
            is_deleted: true,
        },
    );
    remote.domains.insert(
        "example.com".to_string(),
        DomainEntry {
            canonical_domain: "example.com".to_string(),
            display_name: "Example".to_string(),
            rule: "standard".to_string(),
            accounts: remote_accounts,
            updated_at: 2000,
        },
    );

    local.merge(remote);

    let domain = local.domains.get("example.com").unwrap();
    // admin 在 remote 2000 删除，较 local 1000 新，因此 is_deleted 为 true
    let admin_acc = domain.accounts.get("admin").unwrap();
    assert!(admin_acc.is_deleted, "admin 墓碑状态应被保留");
    assert_eq!(admin_acc.updated_at, 2000);

    // old_user 本地时间戳 3000 > 远程 2000，因此保留本地激活状态 is_deleted == false
    let old_user_acc = domain.accounts.get("old_user").unwrap();
    assert!(!old_user_acc.is_deleted, "本地更新的激活状态应胜出");
    assert_eq!(old_user_acc.updated_at, 3000);
}
