//! 密诀 (MantraKey) 标识归一化与进程智能匹配引擎单元测试

use mantra_identity::{
    normalize_identity,
    normalize_process_name,
    normalize_to_canonical,
    normalize_url,
    resolve_sso_canonical,
    CanonicalIdentity,
    IdentityError,
};

#[test]
fn test_url_sanitization_and_etld_plus_one() {
    // 基础 URL 剥离：协议、路径与查询参数
    assert_eq!(
        normalize_url("https://auth.github.com/login?redirect=1").unwrap(),
        "github.com"
    );

    // 带端口号与多级子路径
    assert_eq!(
        normalize_url("http://sub.domain.co.uk:8080/path").unwrap(),
        "domain.co.uk"
    );

    // 常用复合公共后缀（双段后缀识别）
    assert_eq!(
        normalize_url("http://news.bbc.co.uk.").unwrap(),
        "bbc.co.uk"
    );
    assert_eq!(
        normalize_url("https://mail.tsinghua.edu.cn/coremail/").unwrap(),
        "tsinghua.edu.cn"
    );
    assert_eq!(
        normalize_url("http://sub.company.com.cn:80").unwrap(),
        "company.com.cn"
    );
    assert_eq!(
        normalize_url("https://www.cityu.edu.hk/").unwrap(),
        "cityu.edu.hk"
    );

    // 无协议直接域名输入
    assert_eq!(
        normalize_url("login.taobao.com").unwrap(),
        "taobao.com"
    );

    // 自身已为 eTLD+1
    assert_eq!(
        normalize_url("github.com").unwrap(),
        "github.com"
    );

    // 带认证凭据的 URL 格式
    assert_eq!(
        normalize_url("https://user:pwd@login.auth.github.com:8443/oauth/v2").unwrap(),
        "github.com"
    );

    // 私有托管域名隔离（防止不同租户共享密码）
    assert_eq!(
        normalize_url("https://user1.github.io/blog").unwrap(),
        "user1.github.io"
    );

    // 局域网 IP 与 本地回环直通穿透
    assert_eq!(
        normalize_url("http://192.168.1.100:8080/admin").unwrap(),
        "192.168.1.100"
    );
    assert_eq!(
        normalize_url("http://localhost:3000").unwrap(),
        "localhost"
    );

    // 带嵌套查询参数 URL
    assert_eq!(
        normalize_url("https://login.example.com/oauth?redirect=https://other.com").unwrap(),
        "example.com"
    );

    // 仿冒伪公共后缀隔离（非公共后缀二级域名）
    assert_eq!(
        normalize_url("https://my-github.io").unwrap(),
        "my-github.io"
    );
    assert_eq!(
        normalize_url("http://fakeco.uk").unwrap(),
        "fakeco.uk"
    );
    assert_eq!(
        normalize_url("https://notgithub.io/path").unwrap(),
        "notgithub.io"
    );

    // 前置与后置点清洗
    assert_eq!(
        normalize_url("...example.com...").unwrap(),
        "example.com"
    );

    // 非标手抖输入清洗防呆
    assert_eq!(
        normalize_url("https://oa.corp.net/login/").unwrap(),
        "corp.net"
    );

    // 非法空输入报错
    assert!(matches!(
        normalize_url(""),
        Err(IdentityError::InvalidUrl(_))
    ));
    assert!(matches!(
        normalize_url("   "),
        Err(IdentityError::InvalidUrl(_))
    ));
}

#[test]
fn test_sso_equivalence_mapping() {
    // 阿里系等价组
    assert_eq!(resolve_sso_canonical("alipay.com"), "taobao.com");
    assert_eq!(resolve_sso_canonical("tmall.com"), "taobao.com");
    assert_eq!(resolve_sso_canonical("aliyun.com"), "taobao.com");
    assert_eq!(resolve_sso_canonical("1688.com"), "taobao.com");

    // 谷歌系等价组
    assert_eq!(resolve_sso_canonical("youtube.com"), "google.com");
    assert_eq!(resolve_sso_canonical("gmail.com"), "google.com");
    assert_eq!(resolve_sso_canonical("blogger.com"), "google.com");

    // 微软系等价组
    assert_eq!(resolve_sso_canonical("live.com"), "microsoft.com");
    assert_eq!(resolve_sso_canonical("office.com"), "microsoft.com");
    assert_eq!(resolve_sso_canonical("outlook.com"), "microsoft.com");
    assert_eq!(resolve_sso_canonical("xbox.com"), "microsoft.com");
    assert_eq!(resolve_sso_canonical("msn.com"), "microsoft.com");

    // 苹果系等价组
    assert_eq!(resolve_sso_canonical("icloud.com"), "apple.com");
    assert_eq!(resolve_sso_canonical("appleid.apple.com"), "apple.com");

    // 未登记独立站点保持原样
    assert_eq!(resolve_sso_canonical("github.com"), "github.com");

    // 大小写不敏感验证
    assert_eq!(resolve_sso_canonical("YOUTUBE.COM"), "google.com");
    assert_eq!(resolve_sso_canonical("Alipay.com"), "taobao.com");
}

#[test]
fn test_windows_process_normalization() {
    // 微信客户端及小部件
    assert_eq!(normalize_process_name("WeChat.exe"), "weixin.qq.com");
    assert_eq!(normalize_process_name("WeChatAppEx.exe"), "weixin.qq.com");

    // Steam 游戏平台
    assert_eq!(normalize_process_name("steam.exe"), "steampowered.com");
    assert_eq!(normalize_process_name("steamwebhelper.exe"), "steampowered.com");

    // 社交协同软件
    assert_eq!(normalize_process_name("qq.exe"), "qq.com");
    assert_eq!(normalize_process_name("discord.exe"), "discord.com");
    assert_eq!(normalize_process_name("telegram.exe"), "telegram.org");
    assert_eq!(normalize_process_name("spotify.exe"), "spotify.com");
    assert_eq!(normalize_process_name("lark.exe"), "feishu.cn");
    assert_eq!(normalize_process_name("feishu.exe"), "feishu.cn");

    // 游戏平台
    assert_eq!(normalize_process_name("epicgameslauncher.exe"), "epicgames.com");
    assert_eq!(normalize_process_name("battle.net.exe"), "battle.net");

    // 开发者工具
    assert_eq!(normalize_process_name("code.exe"), "github.com");
    assert_eq!(normalize_process_name("git-credential-manager.exe"), "github.com");

    // 大写进程名容错
    assert_eq!(normalize_process_name("STEAM.EXE"), "steampowered.com");
    assert_eq!(normalize_process_name("WECHAT.EXE"), "weixin.qq.com");

    // 包含 Windows / Unix 绝对路径与相对路径的进程名称剥离
    assert_eq!(
        normalize_process_name(r"C:\Games\Steam\steam.exe"),
        "steampowered.com"
    );
    assert_eq!(
        normalize_process_name(r"D:\Tencent\WeChat\WeChat.exe"),
        "weixin.qq.com"
    );
    assert_eq!(
        normalize_process_name("/usr/bin/steam.exe"),
        "steampowered.com"
    );

    // 未登记自定义应用程序保留原名称
    assert_eq!(normalize_process_name("custom_app.exe"), "custom_app.exe");
    assert_eq!(normalize_process_name("oa_internal.exe"), "oa_internal.exe");

    // 移动端包名启发式映射兼容
    assert_eq!(normalize_process_name("com.zhihu.android"), "zhihu.com");
    assert_eq!(normalize_process_name("com.cmbchina.ccd.pluto"), "cmbchina.com");
}

#[test]
fn test_pipeline_and_canonical_identity() {
    // 经一体化管线处理 Web 链接与 SSO
    assert_eq!(
        normalize_identity("https://mail.google.com/mail/u/0").unwrap(),
        "google.com"
    );
    assert_eq!(
        normalize_identity("https://www.youtube.com/feed/subscriptions").unwrap(),
        "google.com"
    );
    assert_eq!(
        normalize_identity("https://auth.alipay.com/login").unwrap(),
        "taobao.com"
    );

    // 经一体化管线处理桌面可执行程序（含绝对路径）
    assert_eq!(
        normalize_identity("WeChat.exe").unwrap(),
        "weixin.qq.com"
    );
    assert_eq!(
        normalize_identity("steam.exe").unwrap(),
        "steampowered.com"
    );
    assert_eq!(
        normalize_identity(r"C:\Games\Steam\steam.exe").unwrap(),
        "steampowered.com"
    );

    // Android 包名在一体化管线中的收敛
    assert_eq!(
        normalize_identity("com.zhihu.android").unwrap(),
        "zhihu.com"
    );
    assert_eq!(
        normalize_identity("com.cmbchina.ccd.pluto").unwrap(),
        "cmbchina.com"
    );

    // CanonicalIdentity 类型包装验证
    let canonical = CanonicalIdentity::new("github.com".to_string());
    assert_eq!(canonical.as_str(), "github.com");
    assert_eq!(format!("{}", canonical), "github.com");

    // CanonicalIdentity Deref 与 normalize_to_canonical 测试
    let canonical_res = normalize_to_canonical("https://login.taobao.com")
        .expect("normalize_to_canonical 应当解析成功");
    let domain_deref: &str = &canonical_res;
    assert_eq!(domain_deref, "taobao.com");
    assert_eq!(canonical_res.as_ref(), "taobao.com");
    assert_eq!(canonical_res.len(), 10);
    assert!(canonical_res.starts_with("taobao"));
}
