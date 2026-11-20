//! 密诀 (MantraKey) 桌面宿主托盘守护进程主入口
//!
//! 提供基于 Tauri v2 架构的托盘常驻守护、15 分钟会话安全管理、
//! IPC 命名管道服务分发以及 Windows SendInput 按键仿真注入。

pub mod injector;
pub mod ipc_server;
pub mod session;

use std::time::Duration;
use session::SessionManager;
use ipc_server::IpcDispatcher;
use injector::WindowsSendInputInjector;

#[tokio::main]
async fn main() {
    println!("MantraKey Desktop Daemon 正在初始化...");

    // 初始化 15 分钟 (900s) TTL 安全会话管理器
    let session = SessionManager::new(Duration::from_secs(900));

    // 初始化 IPC 指令分发器与 SendInput 仿真器
    let _dispatcher = IpcDispatcher::new(session.clone());
    let _injector = WindowsSendInputInjector::new();

    println!("MantraKey Desktop Daemon 启动就绪 [TTL: 15min, IPC Pipeline Ready]");
}
