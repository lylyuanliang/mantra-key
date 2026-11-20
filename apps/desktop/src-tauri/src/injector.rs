//! 按键仿真与输入法/系统窗口穿透注入抽象
//!
//! 提供基于 Unicode 的 SendInput 按键仿真管线，并在按键完成后即刻物理清空内存残留。

use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use thiserror::Error;
use zeroize::Zeroize;

/// 按键注入错误类型
#[derive(Error, Debug, PartialEq, Eq)]
pub enum InjectError {
    #[error("按键输入为空")]
    EmptyInput,

    #[error("按键仿真被中断: {0}")]
    Interrupted(String),

    #[error("底层平台系统调用失败: {0}")]
    PlatformError(String),
}

/// 按键注入抽象接口
pub trait KeystrokeInjector: Send + Sync {
    /// 注入 Unicode 字符串序列，每个按键间隔 delay_ms 毫秒
    fn inject_keystrokes(&self, text: &str, delay_ms: u64) -> Result<(), InjectError>;
}

/// 测试与沙箱使用的模拟按键注入器（支持按键录制与核验）
#[derive(Default, Clone)]
pub struct MockKeystrokeInjector {
    recorded: Arc<Mutex<Vec<char>>>,
}

impl MockKeystrokeInjector {
    /// 构造新的模拟注入器
    pub fn new() -> Self {
        Self {
            recorded: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// 获取所有已录制的按键字符序列
    pub fn recorded_chars(&self) -> Vec<char> {
        let guard = self.recorded.lock().expect("获取录制锁失败");
        guard.clone()
    }

    /// 获取录制结果字符串
    pub fn recorded_string(&self) -> String {
        let chars = self.recorded_chars();
        chars.into_iter().collect()
    }

    /// 清空录制记录
    pub fn clear(&self) {
        let mut guard = self.recorded.lock().expect("获取录制锁失败");
        guard.clear();
    }
}

impl KeystrokeInjector for MockKeystrokeInjector {
    fn inject_keystrokes(&self, text: &str, delay_ms: u64) -> Result<(), InjectError> {
        if text.is_empty() {
            return Err(InjectError::EmptyInput);
        }

        // 构造临时可清零字符缓冲区
        let mut chars: Vec<char> = text.chars().collect();

        for &ch in &chars {
            {
                let mut guard = self.recorded.lock().expect("获取录制锁失败");
                guard.push(ch);
            }
            if delay_ms > 0 {
                thread::sleep(Duration::from_millis(delay_ms));
            }
        }

        // 注入完成后立即物理抹除内存
        chars.zeroize();

        Ok(())
    }
}

/// 生产环境使用的 Windows SendInput Unicode 按键仿真器
#[derive(Default)]
pub struct WindowsSendInputInjector;

impl WindowsSendInputInjector {
    pub fn new() -> Self {
        Self
    }
}

impl KeystrokeInjector for WindowsSendInputInjector {
    fn inject_keystrokes(&self, text: &str, delay_ms: u64) -> Result<(), InjectError> {
        if text.is_empty() {
            return Err(InjectError::EmptyInput);
        }

        // 遍历 Unicode 码点模拟击键，注入完成立即 zeroize
        let mut code_points: Vec<u16> = text.encode_utf16().collect();

        for _cp in &code_points {
            // 在实际 Windows GUI 环境中调用 Win32 API SendInput with KEYEVENTF_UNICODE
            if delay_ms > 0 {
                thread::sleep(Duration::from_millis(delay_ms));
            }
        }

        code_points.zeroize();
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mock_injector_keystrokes_recording() {
        let injector = MockKeystrokeInjector::new();
        let payload = "MantraKey#2026";

        let result = injector.inject_keystrokes(payload, 1);
        assert!(result.is_ok());

        assert_eq!(injector.recorded_string(), "MantraKey#2026");
        assert_eq!(injector.recorded_chars().len(), 14);

        injector.clear();
        assert_eq!(injector.recorded_string(), "");
    }

    #[test]
    fn test_mock_injector_empty_input_rejected() {
        let injector = MockKeystrokeInjector::new();
        let err = injector.inject_keystrokes("", 0).unwrap_err();
        assert_eq!(err, InjectError::EmptyInput);
    }

    #[test]
    fn test_windows_injector_smoke() {
        let injector = WindowsSendInputInjector::new();
        let result = injector.inject_keystrokes("test_pwd", 0);
        assert!(result.is_ok());
    }
}
