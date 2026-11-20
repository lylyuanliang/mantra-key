//! mantra-crypto 密码学派生引擎与安全内存隔离测试套件

use mantra_crypto::{
    derive_master_seed,
    derive_site_password,
    derive_sync_key,
    rejection_sampling,
    CanaryValidator,
    MasterSeed,
    SecureString,
    CHARSET_ALPHA,
    CHARSET_ALPHA_NUM_SYMBOL,
    CHARSET_DIGIT,
    CHARSET_SYMBOL,
    DIGITS,
};

#[test]
fn test_deterministic_site_password_derivation() {
    let mantra = "CorrectHorseBatteryStaple2026!";
    let salt = "mantra_key_salt_universal_2026";
    let seed = derive_master_seed(mantra, salt).expect("MasterSeed derive failed");

    // 验证派生的一致性：相同输入必须生成完全相同的密码
    let pwd_1 = derive_site_password(
        &seed,
        "github.com",
        "octocat",
        1,
        16,
        CHARSET_ALPHA_NUM_SYMBOL,
    )
    .expect("Derive failed");

    let pwd_2 = derive_site_password(
        &seed,
        "github.com",
        "octocat",
        1,
        16,
        CHARSET_ALPHA_NUM_SYMBOL,
    )
    .expect("Derive failed");

    assert_eq!(pwd_1.as_str(), pwd_2.as_str());
    assert_eq!(pwd_1.len(), 16);

    // 验证版本号单调性隔离：版本号递增时输出完全不同
    let pwd_v2 = derive_site_password(
        &seed,
        "github.com",
        "octocat",
        2,
        16,
        CHARSET_ALPHA_NUM_SYMBOL,
    )
    .expect("Derive failed");

    assert_ne!(pwd_1.as_str(), pwd_v2.as_str());

    // 验证账号隔离：不同用户名生成的密码完全不同
    let pwd_diff_user = derive_site_password(
        &seed,
        "github.com",
        "admin",
        1,
        16,
        CHARSET_ALPHA_NUM_SYMBOL,
    )
    .expect("Derive failed");

    assert_ne!(pwd_1.as_str(), pwd_diff_user.as_str());

    // 验证域名隔离：不同域名生成的密码完全不同
    let pwd_diff_domain = derive_site_password(
        &seed,
        "gitlab.com",
        "octocat",
        1,
        16,
        CHARSET_ALPHA_NUM_SYMBOL,
    )
    .expect("Derive failed");

    assert_ne!(pwd_1.as_str(), pwd_diff_domain.as_str());
}

#[test]
fn test_sync_key_derivation_isolation() {
    let mantra = "TestMantra123!";
    let salt = "salt";
    let seed = derive_master_seed(mantra, salt).expect("Seed fail");
    let sync_key = derive_sync_key(&seed).expect("Sync key fail");

    assert_eq!(sync_key.len(), 32);
    // 派生出来的同步子密钥与主种子必须相互隔离、互不泄露
    assert_ne!(sync_key.as_slice(), seed.as_slice());
}

#[test]
fn test_secure_string_and_master_seed_deref() {
    let raw = "SecretPassword123".to_string();
    let sec = SecureString::new(raw);
    assert_eq!(sec.as_str(), "SecretPassword123");
    assert_eq!(&*sec, "SecretPassword123");
    assert_eq!(sec.len(), 17);
    assert!(!sec.is_empty());

    let seed_raw = [42u8; 32];
    let master_seed = MasterSeed::new(seed_raw);
    assert_eq!(master_seed.as_slice(), &[42u8; 32]);
    assert_eq!(&*master_seed, &[42u8; 32]);
}

#[test]
fn test_canary_constant_time_verification() {
    let original = [0x5au8; 32];
    let validator = CanaryValidator::new(original);

    // 完全匹配返回 true
    assert!(validator.verify_constant_time(&[0x5au8; 32]));

    // 仅单字节不匹配返回 false
    let mut modified = original;
    modified[31] = 0x5b;
    assert!(!validator.verify_constant_time(&modified));
}

#[test]
fn test_rejection_sampling_edge_cases() {
    let empty_entropy: [u8; 0] = [];
    assert_eq!(rejection_sampling(&empty_entropy, DIGITS, 6), "");

    // 验证数字集合采样输出全在 DIGITS 范围内
    let fake_entropy = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    let sampled = rejection_sampling(&fake_entropy, DIGITS, 6);
    assert_eq!(sampled.len(), 6);
    for ch in sampled.chars() {
        assert!(DIGITS.contains(&(ch as u8)));
    }
}

#[test]
fn test_charset_mask_filtering() {
    let mantra = "CharsetMaskTesting2026!";
    let salt = "test_salt_universal_2026";
    let seed = derive_master_seed(mantra, salt).expect("Seed fail");

    // 纯数字 PIN
    let pin = derive_site_password(&seed, "bank.com", "user", 1, 6, CHARSET_DIGIT)
        .expect("PIN derive failed");
    assert_eq!(pin.len(), 6);
    for ch in pin.chars() {
        assert!(DIGITS.contains(&(ch as u8)));
    }

    // 字母 + 数字 + 符号
    let alpha_num_symbol = derive_site_password(
        &seed,
        "bank.com",
        "user",
        1,
        14,
        CHARSET_ALPHA | CHARSET_DIGIT | CHARSET_SYMBOL,
    )
    .expect("AlphaNumSymbol derive failed");
    assert_eq!(alpha_num_symbol.len(), 14);
}

#[test]
fn test_rejection_sampling_all_rejected_does_not_hang() {
    let alphabet = b"ABCDEFG"; // 长度 7, limit = 252
    let bad_entropy = [252u8, 253, 254, 255]; // 所有字节 >= limit
    let result = rejection_sampling(&bad_entropy, alphabet, 10);
    assert_eq!(result, "");
}

#[test]
fn test_derive_site_password_invalid_mask_fallback() {
    let mantra = "FallbackMantra2026!";
    let salt = "fallback_salt_2026";
    let seed = derive_master_seed(mantra, salt).expect("Seed fail");

    // 传入未定义掩码 (0b1000_0000)，必须自动兜底为全字符集并成功派生
    let pwd = derive_site_password(&seed, "example.com", "alice", 1, 16, 0b1000_0000)
        .expect("Derive with fallback failed");
    assert_eq!(pwd.len(), 16);
}
