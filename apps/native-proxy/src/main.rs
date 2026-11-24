//! 密诀 Chrome 原生消息中继桩主入口
//!
//! 在浏览器扩展标准输入输出与 Windows 命名管道服务端之间中继二进制帧。
//! 遵循 Chromium / Firefox Native Messaging 协议（4 字节 uint32_le 长度前缀与 1MB 溢出保护）。
//! 支持 --register 与 --unregister 命令行自注册。

mod framing;

use framing::{read_frame, write_frame};
use serde_json::{json, Value};
use std::env;
use std::fs;
use std::io::{stdin, stdout};
use std::path::{Path, PathBuf};
use std::process::Command;

const HOST_NAME: &str = "org.mantrakey.native_proxy";

fn copy_dir_all(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dest_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dest_path)?;
        } else {
            fs::copy(entry.path(), dest_path)?;
        }
    }
    Ok(())
}

fn find_all_extension_unpacked_paths(extension_id: Option<&str>) -> Vec<PathBuf> {
    let mut targets = Vec::new();

    if let Ok(local_app_data) = env::var("LOCALAPPDATA") {
        let base = PathBuf::from(local_app_data);
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
                        // 1. 检查 Preferences 与 Secure Preferences
                        let pref_files = [path.join("Preferences"), path.join("Secure Preferences")];
                        for pf in &pref_files {
                            if pf.exists() {
                                if let Ok(content) = fs::read_to_string(pf) {
                                    if let Ok(val) = serde_json::from_str::<Value>(&content) {
                                        if let Some(settings) = val.get("extensions").and_then(|e| e.get("settings")).and_then(Value::as_object) {
                                            // 精准匹配
                                            if let Some(eid) = extension_id {
                                                if let Some(info) = settings.get(eid) {
                                                    if let Some(p_str) = info.get("path").and_then(Value::as_str) {
                                                        let p = PathBuf::from(p_str);
                                                        if p.exists() && !targets.contains(&p) {
                                                            eprintln!("[MantraNativeProxy] 精准匹配扩展路径: {}", p.display());
                                                            targets.push(p);
                                                        }
                                                    }
                                                }
                                            }
                                            // 启发式扫描
                                            for (_, info) in settings {
                                                if let Some(p_str) = info.get("path").and_then(Value::as_str) {
                                                    let p_lower = p_str.to_lowercase();
                                                    if p_lower.contains("mantra-key") || p_lower.contains("chrome-mv3") {
                                                        let p = PathBuf::from(p_str);
                                                        if p.join("manifest.json").exists() && !targets.contains(&p) {
                                                            eprintln!("[MantraNativeProxy] 启发式扫描扩展路径: {}", p.display());
                                                            targets.push(p);
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // 2. 检查 UnpackedExtensions 缓存目录
                        let unpacked_dir = path.join("UnpackedExtensions");
                        if unpacked_dir.exists() {
                            if let Ok(sub_entries) = fs::read_dir(&unpacked_dir) {
                                for sub in sub_entries.flatten() {
                                    let sp = sub.path();
                                    if sp.is_dir() && sp.join("manifest.json").exists() {
                                        let name_lower = sp.file_name().and_then(|n| n.to_str()).unwrap_or("").to_lowercase();
                                        if name_lower.contains("mantra") || name_lower.contains("chrome-mv3") {
                                            if !targets.contains(&sp) {
                                                eprintln!("[MantraNativeProxy] UnpackedExtensions 匹配: {}", sp.display());
                                                targets.push(sp);
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. 常见工作区与部署路径兜底
    let candidates = [
        r"D:\file_save\extension\chrome-mv3",
        r"D:\file_save\workspace\github\mantra-key\apps\extension\.output\chrome-mv3",
    ];
    for c in candidates {
        let p = PathBuf::from(c);
        if p.join("manifest.json").exists() && !targets.contains(&p) {
            eprintln!("[MantraNativeProxy] 兜底匹配路径: {}", p.display());
            targets.push(p);
        }
    }

    targets
}

fn handle_auto_update_extension(req_id: &str, payload: &Value) -> Value {
    let extension_id = payload.get("extensionId").and_then(Value::as_str);
    let explicit_dir = payload.get("targetDir").and_then(Value::as_str).map(PathBuf::from);

    let target_dirs = if let Some(d) = explicit_dir {
        if d.exists() {
            vec![d]
        } else {
            find_all_extension_unpacked_paths(extension_id)
        }
    } else {
        find_all_extension_unpacked_paths(extension_id)
    };

    if target_dirs.is_empty() {
        return json!({
            "id": req_id,
            "action": "AUTO_UPDATE_EXTENSION",
            "status": "error",
            "message": "未能在本地定位到扩展解压安装目录，请先在 Chrome 扩展管理页确认路径"
        });
    }

    let download_url = payload.get("downloadUrl").and_then(Value::as_str).unwrap_or("");
    let direct_url = payload.get("directDownloadUrl").and_then(Value::as_str).unwrap_or("");

    let mut candidates = Vec::new();
    if !download_url.is_empty() {
        candidates.push(download_url.to_string());
    }
    if !direct_url.is_empty() && !candidates.contains(&direct_url.to_string()) {
        candidates.push(direct_url.to_string());
    }

    let raw_github = if !direct_url.is_empty() {
        direct_url
    } else if download_url.contains("github.com/") {
        download_url
    } else {
        ""
    };

    if raw_github.contains("github.com/") {
        let tail = raw_github.split("github.com/").nth(1).unwrap_or("");
        for prefix in [
            "https://ghproxy.net/https://github.com/",
            "https://gh-proxy.com/https://github.com/",
            "https://mirror.ghproxy.com/https://github.com/",
        ] {
            let m_url = format!("{}{}", prefix, tail);
            if !candidates.contains(&m_url) {
                candidates.push(m_url);
            }
        }
        let raw_clean = format!("https://github.com/{}", tail);
        if !candidates.contains(&raw_clean) {
            candidates.push(raw_clean);
        }
    }

    let now_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let temp_dir = std::env::temp_dir().join(format!("mantra_update_{}", now_ts));
    let _ = fs::create_dir_all(&temp_dir);
    let zip_file = temp_dir.join("update.zip");
    let extract_dir = temp_dir.join("extracted");
    let _ = fs::create_dir_all(&extract_dir);

    let mut downloaded = false;
    let mut last_err = String::new();

    for candidate in &candidates {
        eprintln!("[MantraNativeProxy] 尝试从节点下载: {}", candidate);
        let status = Command::new("curl.exe")
            .args([
                "-fL",
                "--connect-timeout",
                "10",
                "--max-time",
                "60",
                "-s",
                "-o",
                &zip_file.display().to_string(),
                candidate,
            ])
            .output();

        if let Ok(out) = status {
            if out.status.success()
                && zip_file.exists()
                && fs::metadata(&zip_file).map(|m| m.len()).unwrap_or(0) > 10240
            {
                downloaded = true;
                eprintln!(
                    "[MantraNativeProxy] 下载成功 ({} 字节)",
                    fs::metadata(&zip_file).map(|m| m.len()).unwrap_or(0)
                );
                break;
            }
        }
        last_err = format!("节点 {} 下载未成功", candidate);
    }

    if !downloaded {
        let _ = fs::remove_dir_all(&temp_dir);
        return json!({
            "id": req_id,
            "action": "AUTO_UPDATE_EXTENSION",
            "status": "error",
            "message": format!("所有镜像节点下载均未完成: {}", last_err)
        });
    }

    // 优先使用 Windows 内置 tar.exe 解压
    let tar_res = Command::new("tar.exe")
        .args([
            "-xf",
            &zip_file.display().to_string(),
            "-C",
            &extract_dir.display().to_string(),
        ])
        .output();

    let extract_success = match tar_res {
        Ok(out) if out.status.success() => true,
        _ => {
            let ps_cmd = format!(
                "Expand-Archive -Path '{}' -DestinationPath '{}' -Force",
                zip_file.display(),
                extract_dir.display()
            );
            let ps_res = Command::new("powershell.exe")
                .args(["-NoProfile", "-Command", &ps_cmd])
                .output();
            matches!(ps_res, Ok(out) if out.status.success())
        }
    };

    if !extract_success {
        let _ = fs::remove_dir_all(&temp_dir);
        return json!({
            "id": req_id,
            "action": "AUTO_UPDATE_EXTENSION",
            "status": "error",
            "message": "解压更新包失败"
        });
    }

    // 定位解压内容中的根目录 (判断 manifest.json 是否在根目录或在子目录)
    let source_dir = if extract_dir.join("manifest.json").exists() {
        extract_dir.clone()
    } else {
        let mut sub = extract_dir.clone();
        if let Ok(entries) = fs::read_dir(&extract_dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_dir() && p.join("manifest.json").exists() {
                    sub = p;
                    break;
                }
            }
        }
        sub
    };

    // 执行原地覆盖拷贝 (对所有定位到的扩展目录同步更新)
    let mut updated_paths = Vec::new();
    for target_dir in &target_dirs {
        if let Err(e) = copy_dir_all(&source_dir, target_dir) {
            eprintln!("[MantraNativeProxy] 覆写目录 {} 失败: {}", target_dir.display(), e);
        } else {
            eprintln!("[MantraNativeProxy] 扩展目录覆写完成: {}", target_dir.display());
            updated_paths.push(target_dir.display().to_string());
        }
    }

    let _ = fs::remove_dir_all(&temp_dir);

    if updated_paths.is_empty() {
        return json!({
            "id": req_id,
            "action": "AUTO_UPDATE_EXTENSION",
            "status": "error",
            "message": "所有目标扩展目录覆写均失败"
        });
    }

    json!({
        "id": req_id,
        "action": "AUTO_UPDATE_EXTENSION",
        "status": "ok",
        "code": 200,
        "message": "原生静默更新完成，正在热重载扩展",
        "data": {
            "targetDirs": updated_paths
        }
    })
}

fn handle_message(msg_bytes: &[u8]) -> Vec<u8> {
    let req: Value = match serde_json::from_slice(msg_bytes) {
        Ok(v) => v,
        Err(_) => return msg_bytes.to_vec(),
    };

    let req_id = req.get("id").and_then(Value::as_str).unwrap_or("").to_string();
    let action = req.get("action").and_then(Value::as_str).unwrap_or("").to_string();
    let payload = req.get("payload").cloned().unwrap_or(json!({}));

    match action.as_str() {
        "PING" => {
            let res = json!({
                "id": req_id,
                "action": "PONG",
                "status": "ok",
                "message": "PONG"
            });
            serde_json::to_vec(&res).unwrap_or_else(|_| msg_bytes.to_vec())
        }
        "AUTO_UPDATE_EXTENSION" => {
            let res = handle_auto_update_extension(&req_id, &payload);
            serde_json::to_vec(&res).unwrap_or_else(|_| msg_bytes.to_vec())
        }
        _ => {
            let res = json!({
                "id": req_id,
                "action": action,
                "status": "ok",
                "data": payload
            });
            serde_json::to_vec(&res).unwrap_or_else(|_| msg_bytes.to_vec())
        }
    }
}

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
                let resp_bytes = handle_message(&msg_bytes);
                if let Err(e) = write_frame(&mut output, &resp_bytes) {
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
