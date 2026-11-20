//! Chrome Native Messaging 二进制线协议分帧模块
//!
//! 遵循 Chromium / Firefox Native Messaging 工业级标准：
//! 采用 4 字节小端序 uint32_le 长度标头 + UTF-8 / 二进制有效负载。
//! 内置 1MB (1,048,576 字节) 缓冲区溢出保护。

use std::io::{Read, Write};

/// 单个消息帧允许的最大安全长度 (1MB = 1,048,576 字节)
pub const MAX_FRAME_SIZE: usize = 1024 * 1024;

/// 从输入流读取单个 Chrome Native Messaging 消息帧
///
/// 4 字节小端序 uint32 长度前缀；
/// 若输入流在读取前缀起始时已到达 EOF，则返回空的 `Vec<u8>`；
/// 若长度前缀超过 1MB，则拒绝读取并返回 `ErrorKind::InvalidData`。
pub fn read_frame<R: Read>(reader: &mut R) -> std::io::Result<Vec<u8>> {
    let mut len_buf = [0u8; 4];
    let mut total_read = 0;

    while total_read < 4 {
        let n = reader.read(&mut len_buf[total_read..])?;
        if n == 0 {
            if total_read == 0 {
                // 流已正常处于 EOF 终止状态，返回空 Vec，不 panic
                return Ok(Vec::new());
            } else {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::UnexpectedEof,
                    "读取 4 字节小端序长度前缀时发生非预期流截断",
                ));
            }
        }
        total_read += n;
    }

    let len = u32::from_le_bytes(len_buf) as usize;

    if len > MAX_FRAME_SIZE {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("帧长度 {} 字节超出 1MB 安全上限", len),
        ));
    }

    if len == 0 {
        return Ok(Vec::new());
    }

    let mut payload = vec![0u8; len];
    reader.read_exact(&mut payload)?;
    Ok(payload)
}

/// 向输出流写入单个 Chrome Native Messaging 消息帧
///
/// 写入 4 字节小端序长度标头与 payload 数据，并强制 `writer.flush()?`。
pub fn write_frame<W: Write>(writer: &mut W, data: &[u8]) -> std::io::Result<()> {
    if data.len() > MAX_FRAME_SIZE {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            format!("写入帧长度 {} 字节超出 1MB 安全上限", data.len()),
        ));
    }

    let len = data.len() as u32;
    writer.write_all(&len.to_le_bytes())?;
    writer.write_all(data)?;
    writer.flush()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_framing_roundtrip() {
        let mut buffer = Vec::new();
        let payload = br#"{"id":"test-1","action":"PING"}"#;

        write_frame(&mut buffer, payload).expect("写入帧失败");
        assert_eq!(buffer.len(), 4 + payload.len());

        let mut cursor = Cursor::new(buffer);
        let read_back = read_frame(&mut cursor).expect("读取帧失败");
        assert_eq!(read_back, payload);
    }

    #[test]
    fn test_framing_roundtrip_multiple() {
        let mut buffer = Vec::new();
        let payload_1 = br#"{"action":"HANDSHAKE"}"#;
        let payload_2 = br#"{"action":"QUERY_SESSION"}"#;
        let payload_3 = br#"{"action":"LOCK_NOW"}"#;

        write_frame(&mut buffer, payload_1).expect("写入第 1 帧失败");
        write_frame(&mut buffer, payload_2).expect("写入第 2 帧失败");
        write_frame(&mut buffer, payload_3).expect("写入第 3 帧失败");

        let mut cursor = Cursor::new(buffer);
        assert_eq!(read_frame(&mut cursor).unwrap(), payload_1);
        assert_eq!(read_frame(&mut cursor).unwrap(), payload_2);
        assert_eq!(read_frame(&mut cursor).unwrap(), payload_3);
    }

    #[test]
    fn test_read_frame_eof_graceful() {
        let mut cursor = Cursor::new(Vec::<u8>::new());
        let result = read_frame(&mut cursor).expect("读取空流应当优雅返回");
        assert!(result.is_empty(), "EOF 时应返回空向量");
    }

    #[test]
    fn test_read_frame_empty_payload() {
        let mut buffer = Vec::new();
        let empty_payload = b"";

        write_frame(&mut buffer, empty_payload).expect("写入空有效负载失败");
        assert_eq!(buffer.len(), 4);
        assert_eq!(&buffer[..4], &[0, 0, 0, 0]);

        let mut cursor = Cursor::new(buffer);
        let read_back = read_frame(&mut cursor).expect("读取空有效负载失败");
        assert!(read_back.is_empty());
    }

    #[test]
    fn test_read_frame_1mb_overflow_rejection() {
        // 构造 1MB + 1 字节 (1,048,577 字节) 的非法标头
        let overflow_len: u32 = (1024 * 1024 + 1) as u32;
        let header = overflow_len.to_le_bytes();

        let mut cursor = Cursor::new(header);
        let err = read_frame(&mut cursor).expect_err("超过 1MB 必须被拦截");
        assert_eq!(err.kind(), std::io::ErrorKind::InvalidData);
        assert!(
            err.to_string().contains("1MB"),
            "错误信息应当提及 1MB 安全上限"
        );
    }

    #[test]
    fn test_read_frame_huge_overflow_rejection() {
        // 构造 u32::MAX (约 4GB) 的极大标头，防止 OOM DoS 堆分配崩溃
        let huge_len: u32 = u32::MAX;
        let header = huge_len.to_le_bytes();

        let mut cursor = Cursor::new(header);
        let err = read_frame(&mut cursor).expect_err("超大长度必须立即拒绝");
        assert_eq!(err.kind(), std::io::ErrorKind::InvalidData);
    }

    #[test]
    fn test_read_frame_exact_1mb_boundary() {
        // 构造刚好 1MB (1,048,576 字节) 的边界有效报文
        let exact_1mb = vec![0x42u8; 1024 * 1024];
        let mut buffer = Vec::new();

        write_frame(&mut buffer, &exact_1mb).expect("写入 1MB 边界报文应当成功");
        assert_eq!(buffer.len(), 4 + 1024 * 1024);

        let mut cursor = Cursor::new(buffer);
        let read_back = read_frame(&mut cursor).expect("读取 1MB 边界报文应当成功");
        assert_eq!(read_back.len(), 1024 * 1024);
        assert_eq!(read_back, exact_1mb);
    }

    #[test]
    fn test_read_frame_incomplete_prefix() {
        // 只有 2 字节前缀，发生非预期中断
        let truncated_prefix = [0x05u8, 0x00];
        let mut cursor = Cursor::new(truncated_prefix);

        let err = read_frame(&mut cursor).expect_err("不完整前缀必须报错");
        assert_eq!(err.kind(), std::io::ErrorKind::UnexpectedEof);
    }

    #[test]
    fn test_read_frame_incomplete_payload() {
        // 标头声明 10 字节，但流中只有 3 字节有效负载
        let mut buffer = Vec::new();
        let len: u32 = 10;
        buffer.extend_from_slice(&len.to_le_bytes());
        buffer.extend_from_slice(&[1, 2, 3]);

        let mut cursor = Cursor::new(buffer);
        let err = read_frame(&mut cursor).expect_err("负载长度不足必须报错");
        assert_eq!(err.kind(), std::io::ErrorKind::UnexpectedEof);
    }

    #[test]
    fn test_write_frame_overflow_rejection() {
        // 写入端同样防御超大报文
        let mut buffer = Vec::new();
        let oversized = vec![0u8; 1024 * 1024 + 1];

        let err = write_frame(&mut buffer, &oversized).expect_err("写入超过 1MB 必须被拒绝");
        assert_eq!(err.kind(), std::io::ErrorKind::InvalidData);
    }
}
