//! 密诀 Chrome 原生消息中继桩主入口
//!
//! 在浏览器扩展标准输入输出与 Windows 命名管道服务端之间中继二进制帧。
//! 遵循 Chromium / Firefox Native Messaging 协议（4 字节 uint32_le 长度前缀与 1MB 溢出保护）。

mod framing;

use framing::{read_frame, write_frame};
use std::io::{stdin, stdout};

fn main() -> std::io::Result<()> {
    let mut input = stdin();
    let mut output = stdout();

    loop {
        match read_frame(&mut input) {
            Ok(msg_bytes) => {
                if msg_bytes.is_empty() {
                    // 对端关闭或遇到空帧，优雅退出中继循环
                    break;
                }
                // 当前阶段为代理桩回显与转发协议脚手架
                if let Err(e) = write_frame(&mut output, &msg_bytes) {
                    eprintln!("代理桩回写消息帧失败: {}", e);
                    break;
                }
            }
            Err(e) => {
                if e.kind() == std::io::ErrorKind::UnexpectedEof {
                    // 输入流正常终止
                    break;
                }
                eprintln!("读取 Chrome Native Messaging 消息帧异常: {}", e);
                return Err(e);
            }
        }
    }

    Ok(())
}
