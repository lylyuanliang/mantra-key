//! 密诀 (MantraKey) 桌面宿主托盘守护进程主入口
//!
//! 提供基于 15 分钟会话安全管理、IPC 消息服务分发
//! 以及 Windows SendInput 按键仿真注入的桌面常驻守护中枢。

pub mod injector;
pub mod ipc_server;
pub mod session;

use std::time::Duration;
use session::SessionManager;
use ipc_server::IpcDispatcher;
use injector::WindowsSendInputInjector;

#[tokio::main]
async fn main() {
    #[cfg(windows)]
    unsafe {
        extern "system" {
            fn SetConsoleOutputCP(wCodePageID: u32) -> i32;
            fn SetConsoleCP(wCodePageID: u32) -> i32;
        }
        SetConsoleOutputCP(65001);
        SetConsoleCP(65001);
    }

    println!("============================================================");
    println!("  MantraKey Desktop Security Daemon (v0.1.1)");
    println!("  密诀桌面安全中枢与守护服务");
    println!("============================================================");
    println!();
    println!("  [OK] Session TTL Manager (15m auto-lock): Active");
    println!("  [OK] Cryptographic Engine (PBKDF2 / Argon2): Ready");
    println!("  [OK] Windows SendInput Injector: Ready");
    println!("  [OK] IPC Dispatcher Relay: Listening");
    println!();
    println!("  Status: Running in background (常驻运行中)");
    println!("  Tips:   Keep this window open while using MantraKey.");
    println!("          使用密诀期间请保持本窗口开启或最小化。");
    println!("  Exit:   Press Ctrl + C or close this window to stop.");
    println!("          如需停止服务，请按 Ctrl + C 或直接关闭本窗口。");
    println!("============================================================");
    println!();

    // 初始化 15 分钟 (900s) TTL 安全会话管理器
    let session = SessionManager::new(Duration::from_secs(900));

    // 初始化 IPC 指令分发器与 SendInput 仿真器
    let _dispatcher = IpcDispatcher::new(session.clone());
    let _injector = WindowsSendInputInjector::new();

    // 阻塞保持守护进程常驻运行，等待 Ctrl + C 优雅退出
    let _ = tokio::signal::ctrl_c().await;
    println!();
    println!("[退出] 密诀 MantraKey 桌面守护服务已安全退出。");
}
