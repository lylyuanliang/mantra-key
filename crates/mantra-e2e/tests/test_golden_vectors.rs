//! 跨平台金牌测试向量验证套件
//!
//! 验证 PC、Android、浏览器扩展以及 WASM 端在完全相同的输入下，
//! 输出比特级完全一致的确定性规范标识、站点强密码与同步子密钥。

use serde::Deserialize;
use std::fs;
use std::path::Path;

use mantra_crypto::{derive_master_seed, derive_site_password, derive_sync_key};
use mantra_identity::normalize_identity;

#[derive(Debug, Deserialize)]
struct TestCase {
    id: String,
    name: String,
    input_raw: String,
    expected_canonical_domain: String,
    username: String,
    version: u32,
    length: usize,
    charset_mask: u8,
    expected_password: String,
}

#[derive(Debug, Deserialize)]
struct GoldenVectorSuite {
    version: String,
    description: String,
    master_mantra: String,
    salt: String,
    expected_sync_key_hex: String,
    test_cases: Vec<TestCase>,
}

fn bytes_to_hex(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect()
}

#[test]
fn test_golden_vectors_deterministic_outputs() {
    // 定位向量库文件
    let vector_path = Path::new("../../tests/integration/test_vectors.json");
    let fallback_path = Path::new("tests/integration/test_vectors.json");

    let content = if vector_path.exists() {
        fs::read_to_string(vector_path).expect("读取金牌测试向量文件失败")
    } else if fallback_path.exists() {
        fs::read_to_string(fallback_path).expect("读取金牌测试向量文件失败")
    } else {
        panic!("未找到 tests/integration/test_vectors.json 文件");
    };

    let suite: GoldenVectorSuite =
        serde_json::from_str(&content).expect("反序列化金牌测试向量失败");

    println!("执行金牌测试向量套件版本: {}", suite.version);
    println!("描述: {}", suite.description);

    // 1. 验证 MasterSeed 与 SyncKey
    let master_seed = derive_master_seed(&suite.master_mantra, &suite.salt)
        .expect("主种子派生失败");
    let sync_key = derive_sync_key(&master_seed)
        .expect("SyncKey 派生失败");
    let actual_sync_key_hex = bytes_to_hex(&*sync_key);

    assert_eq!(
        actual_sync_key_hex, suite.expected_sync_key_hex,
        "SyncKey 派生结果与金牌期望值不匹配！"
    );

    // 2. 逐一验证各测试用例
    for case in suite.test_cases {
        println!(">>> 正在验证测试用例: {} ({})", case.name, case.id);

        // 验证标识归一化收敛
        let canonical_domain = normalize_identity(&case.input_raw)
            .unwrap_or_else(|e| panic!("标识归一化失败: {} -> {:?}", case.input_raw, e));

        assert_eq!(
            canonical_domain, case.expected_canonical_domain,
            "用例 {} 归一化规范主域不匹配！",
            case.id
        );

        // 验证站点密码确定性派生
        let derived_pwd = derive_site_password(
            &master_seed,
            &canonical_domain,
            &case.username,
            case.version,
            case.length,
            case.charset_mask,
        )
        .unwrap_or_else(|e| panic!("用例 {} 密码派生失败: {:?}", case.id, e));

        assert_eq!(
            derived_pwd.len(),
            case.length,
            "用例 {} 派生密码长度不匹配！",
            case.id
        );

        assert_eq!(
            derived_pwd.as_str(),
            case.expected_password,
            "用例 {} 派生密码字符串与金牌期望值不匹配！",
            case.id
        );
    }
}
