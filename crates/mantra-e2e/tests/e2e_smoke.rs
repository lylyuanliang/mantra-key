//! 密诀 (MantraKey) 全链路冒烟集成测试 (E2E Smoke Test)

use mantra_crypto::{derive_master_seed, derive_site_password, CHARSET_ALPHA_NUM_SYMBOL};
use mantra_identity::normalize_url;

#[test]
fn test_cross_crate_pipeline_smoke() {
    let raw_url = "https://login.github.com/session?return_to=repo";
    let canonical = normalize_url(raw_url).expect("URL 规范化洗涤失败");
    assert_eq!(canonical, "github.com");

    let seed = derive_master_seed("MasterMantra123!", "salt").expect("主种子派生失败");
    let pwd = derive_site_password(&seed, &canonical, "alice", 1, 16, CHARSET_ALPHA_NUM_SYMBOL)
        .expect("密码派生失败");

    assert_eq!(pwd.len(), 16);
}
