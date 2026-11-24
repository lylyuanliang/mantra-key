//! 密诀 Chrome 原生消息中继桩主入口
//!
//! 在浏览器扩展标准输入输出与 Windows 命名管道服务端之间中继二进制帧。
//! 遵循 Chromium / Firefox Native Messaging 协议（4 字节 uint32_le 长度前缀与 1MB 溢出保护）。
//! 支持 --register 与 --unregister 命令行自注册。

mod framing;

use framing::{read_frame, write_frame};
use std::env;
use std::fs;
use std::io::{stdin, stdout};
use std::process::Command;

const HOST_NAME: &str = "org.mantrakey.native_proxy";

fn detect_installed_extension_ids() -> Vec<String> {
    let mut ids = std::collections::BTreeSet::new();
    // 永久固定扩展 ID 与历史已知环境 ID
    ids.insert("hejmkhaefdlhkhebpjnijplphhabkbgh".to_string());
    ids.insert("maocgdjdlppoipddolffccjbnniijbne".to_string());
    ids.insert("bggcaoiaeleahlgnglcglifibgolhief".to_string());
    ids.insert("fpceefangimjbfppoomcngkcdekfnloi".to_string());

    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        let base = std::path::PathBuf::from(local_app_data);
        let browser_dirs = [
            base.join("Google").join("Chrome").join("User Data"),
            base.join("Microsoft").join("Edge").join("User Data"),
        ];

        for udata in &browser_dirs {
            if !udata.exists() {
                continue;
            }
            if let Ok(entries) = fs::read_dir(udata) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let pref_files = [path.join("Preferences"), path.join("Secure Preferences")];
                        for pf in &pref_files {
                            if pf.exists() {
                                if let Ok(content) = fs::read_to_string(pf) {
                                    scan_preferences_content(&content, &mut ids);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    ids.into_iter().collect()
}

fn scan_preferences_content(content: &str, ids: &mut std::collections::BTreeSet<String>) {
    let lower = content.to_lowercase();
    let keywords = ["mantra-key", "chrome-mv3"];
    for kw in &keywords {
        let mut start = 0;
        while let Some(pos) = lower[start..].find(kw) {
            let abs_pos = start + pos;
            let window_start = abs_pos.saturating_sub(4096);
            let snippet = &content[window_start..abs_pos];
            for part in snippet.split('"') {
                if part.len() == 32 && part.chars().all(|c| c >= 'a' && c <= 'p') {
                    ids.insert(part.to_string());
                }
            }
            start = abs_pos + kw.len();
        }
    }
}

fn handle_register() -> std::io::Result<()> {
    println!("========================================================");
    println!("  MantraKey - Native Messaging Host Setup");
    println!("========================================================");
    println!();

    let exe_path = env::current_exe()?;
    let exe_dir = exe_path.parent().unwrap_or_else(|| std::path::Path::new("."));
    let manifest_path = exe_dir.join(format!("{}.json", HOST_NAME));

    let detected_ids = detect_installed_extension_ids();
    let allowed_origins: Vec<String> = detected_ids
        .iter()
        .map(|id| format!("chrome-extension://{}/", id))
        .collect();

    let manifest_content = format!(
        "{{\n  \"name\": \"{}\",\n  \"description\": \"MantraKey Native Messaging Host for Chrome & Edge\",\n  \"path\": \"{}\",\n  \"type\": \"stdio\",\n  \"allowed_origins\": [\n{}\n  ]\n}}",
        HOST_NAME,
        exe_path.display().to_string().replace('\\', "\\\\"),
        allowed_origins
            .iter()
            .map(|o| format!("    \"{}\"", o))
            .collect::<Vec<_>>()
            .join(",\n")
    );

    fs::write(&manifest_path, manifest_content)?;
    println!("[OK] Generated manifest: {}", manifest_path.display());
    for id in &detected_ids {
        println!("     + Origin whitelisted: chrome-extension://{}/", id);
    }

    let chrome_key = format!(r"HKCU\Software\Google\Chrome\NativeMessagingHosts\{}", HOST_NAME);
    let edge_key = format!(r"HKCU\Software\Microsoft\Edge\NativeMessagingHosts\{}", HOST_NAME);

    let status_chrome = Command::new("reg")
        .args(["add", &chrome_key, "/ve", "/t", "REG_SZ", "/d", &manifest_path.display().to_string(), "/f"])
        .output();
    match status_chrome {
        Ok(out) if out.status.success() => println!("[OK] Registered Chrome host: {}", chrome_key),
        _ => eprintln!("[!] Failed to register Chrome host"),
    }

    let status_edge = Command::new("reg")
        .args(["add", &edge_key, "/ve", "/t", "REG_SZ", "/d", &manifest_path.display().to_string(), "/f"])
        .output();
    match status_edge {
        Ok(out) if out.status.success() => println!("[OK] Registered Edge host: {}", edge_key),
        _ => eprintln!("[!] Failed to register Edge host"),
    }

    println!();
    println!("[DONE] MantraKey native host registered successfully!");
    Ok(())
}

fn handle_unregister() -> std::io::Result<()> {
    println!("========================================================");
    println!("  MantraKey - Uninstall Native Host");
    println!("========================================================");
    println!();

    let chrome_key = format!(r"HKCU\Software\Google\Chrome\NativeMessagingHosts\{}", HOST_NAME);
    let edge_key = format!(r"HKCU\Software\Microsoft\Edge\NativeMessagingHosts\{}", HOST_NAME);

    let _ = Command::new("reg").args(["delete", &chrome_key, "/f"]).output();
    let _ = Command::new("reg").args(["delete", &edge_key, "/f"]).output();

    println!("[OK] Native host registry entries removed.");
    Ok(())
}

fn main() -> std::io::Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.iter().any(|arg| arg == "--register") {
        return handle_register();
    }
    if args.iter().any(|arg| arg == "--unregister") {
        return handle_unregister();
    }

    let mut input = stdin();
    let mut output = stdout();

    loop {
        match read_frame(&mut input) {
            Ok(msg_bytes) => {
                if msg_bytes.is_empty() {
                    break;
                }
                if let Err(e) = write_frame(&mut output, &msg_bytes) {
                    eprintln!("代理桩回写消息帧失败: {}", e);
                    break;
                }
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::UnexpectedEof {
                    break;
                }
                eprintln!("读取 Chrome Native Messaging 消息帧异常: {}", e);
                return Err(e);
            }
        }
    }

    Ok(())
}
