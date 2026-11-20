//! 跨生态单点登录 (SSO) 等价组图谱与桌面/移动端进程映射

/// SSO 等价组映射：统一收敛为集团主信任域规范标识
pub fn resolve_sso_canonical(domain: &str) -> String {
    let lower = domain
        .trim()
        .to_lowercase();

    match lower.as_str() {
        // 阿里巴巴生态群
        "alipay.com"
        | "tmall.com"
        | "aliyun.com"
        | "1688.com"
        | "taobao.com" => "taobao.com".to_string(),

        // 谷歌生态群
        "youtube.com"
        | "gmail.com"
        | "blogger.com"
        | "accounts.google.com"
        | "mail.google.com"
        | "google.com" => "google.com".to_string(),

        // 微软生态群
        "live.com"
        | "office.com"
        | "outlook.com"
        | "xbox.com"
        | "msn.com"
        | "microsoftonline.com"
        | "login.microsoftonline.com"
        | "microsoft.com" => "microsoft.com".to_string(),

        // 苹果生态群
        "icloud.com"
        | "appleid.apple.com"
        | "apple.com" => "apple.com".to_string(),

        // 腾讯生态群 (保持规范主域)
        "tenpay.com"
        | "qq.com" => "qq.com".to_string(),

        _ => lower,
    }
}

/// 桌面可执行文件与移动端包名启发式映射
pub fn normalize_process_name(exe_name: &str) -> String {
    let clean = exe_name.trim();
    let file_name = clean
        .rsplit(['/', '\\'])
        .next()
        .unwrap_or(clean);
    let lower = file_name.to_lowercase();

    match lower.as_str() {
        // 微信生态
        "wechat.exe"
        | "wechatappex.exe" => "weixin.qq.com".to_string(),

        // Steam 游戏平台
        "steam.exe"
        | "steamwebhelper.exe" => "steampowered.com".to_string(),

        // 腾讯 QQ
        "qq.exe" => "qq.com".to_string(),

        // Discord 协同软件
        "discord.exe" => "discord.com".to_string(),

        // Telegram 通讯软件
        "telegram.exe" => "telegram.org".to_string(),

        // Spotify 流媒体平台
        "spotify.exe" => "spotify.com".to_string(),

        // Epic Games 启动器
        "epicgameslauncher.exe" => "epicgames.com".to_string(),

        // 暴雪战网平台
        "battle.net.exe" => "battle.net".to_string(),

        // 开发者环境 (VS Code / Git 凭据管理器)
        "code.exe"
        | "git-credential-manager.exe" => "github.com".to_string(),

        // 飞书 / Lark 办公套件
        "lark.exe"
        | "feishu.exe" => "feishu.cn".to_string(),

        // Android 常用应用包名启发式映射
        "com.zhihu.android" => "zhihu.com".to_string(),
        "com.cmbchina.ccd.pluto" => "cmbchina.com".to_string(),

        // 未匹配则保留原名称（保持原始大小写）
        _ => clean.to_string(),
    }
}
