//! 桌面宿主会话状态管理器
//!
//! 负责维护 15 分钟 TTL 自动超时锁定、解锁生命周期、线程安全访问与安全物理清零。

use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};
use mantra_crypto::MasterSeed;

/// 桌面安全会话管理器
#[derive(Clone)]
pub struct SessionManager {
    inner: Arc<RwLock<SessionInner>>,
}

struct SessionInner {
    cached_seed: Option<MasterSeed>,
    last_active: Instant,
    ttl: Duration,
}

impl SessionManager {
    /// 构造指定 TTL 的会话管理器
    pub fn new(ttl: Duration) -> Self {
        Self {
            inner: Arc::new(RwLock::new(SessionInner {
                cached_seed: None,
                last_active: Instant::now(),
                ttl,
            })),
        }
    }

    /// 解锁会话并缓存主种子
    pub fn unlock(&self, seed: MasterSeed) {
        let mut inner = self.inner.write().expect("获取会话写锁失败");
        inner.cached_seed = Some(seed);
        inner.last_active = Instant::now();
    }

    /// 显式注销并清空会话内存
    pub fn lock(&self) {
        let mut inner = self.inner.write().expect("获取会话写锁失败");
        // 显式丢弃 Option 内部数据，触发 ZeroizeOnDrop 物理抹除
        inner.cached_seed = None;
    }

    /// 查询会话是否仍处于解锁有效状态（若超时则就地触发锁定抹除）
    pub fn is_unlocked(&self) -> bool {
        self.get_seed().is_some()
    }

    /// 获取剩余 TTL 时间
    pub fn ttl_remaining(&self) -> Duration {
        let mut inner = self.inner.write().expect("获取会话写锁失败");
        if inner.cached_seed.is_some() {
            let elapsed = inner.last_active.elapsed();
            if elapsed < inner.ttl {
                inner.ttl - elapsed
            } else {
                // 超时自动抹除
                inner.cached_seed = None;
                Duration::ZERO
            }
        } else {
            Duration::ZERO
        }
    }

    /// 刷新会话活跃时间（延长超时期限）
    pub fn refresh(&self) {
        let mut inner = self.inner.write().expect("获取会话写锁失败");
        if inner.cached_seed.is_some() {
            if inner.last_active.elapsed() < inner.ttl {
                inner.last_active = Instant::now();
            } else {
                inner.cached_seed = None;
            }
        }
    }

    /// 安全借用主种子副本（若超时则自动触发清零锁定并返回 None）
    pub fn get_seed(&self) -> Option<MasterSeed> {
        let mut inner = self.inner.write().expect("获取会话写锁失败");
        if let Some(seed) = &inner.cached_seed {
            if inner.last_active.elapsed() < inner.ttl {
                Some(seed.clone())
            } else {
                // 超时清空内存
                inner.cached_seed = None;
                None
            }
        } else {
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn test_session_lifecycle_unlock_and_timeout() {
        let session = SessionManager::new(Duration::from_millis(50));
        assert!(!session.is_unlocked());

        let seed = MasterSeed::new([7u8; 32]);
        session.unlock(seed);
        assert!(session.is_unlocked());
        assert!(session.get_seed().is_some());
        assert_eq!(session.get_seed().unwrap().as_slice(), &[7u8; 32]);

        // 等待超时 (60ms > 50ms TTL)
        thread::sleep(Duration::from_millis(60));
        assert!(!session.is_unlocked());
        assert!(session.get_seed().is_none());
    }

    #[test]
    fn test_session_explicit_lock_and_zeroize() {
        let session = SessionManager::new(Duration::from_secs(900));
        let seed = MasterSeed::new([42u8; 32]);
        session.unlock(seed);
        assert!(session.is_unlocked());

        // 显式即刻注销
        session.lock();
        assert!(!session.is_unlocked());
        assert!(session.get_seed().is_none());
    }

    #[test]
    fn test_session_refresh_extends_ttl() {
        let session = SessionManager::new(Duration::from_millis(80));
        let seed = MasterSeed::new([99u8; 32]);
        session.unlock(seed);

        // 在 40ms 时刷新
        thread::sleep(Duration::from_millis(40));
        session.refresh();

        // 再过 50ms（距离最初已过去 90ms，但距离刷新仅 50ms < 80ms TTL）
        thread::sleep(Duration::from_millis(50));
        assert!(session.is_unlocked());
        assert!(session.get_seed().is_some());

        // 再过 90ms 彻底超时
        thread::sleep(Duration::from_millis(90));
        assert!(!session.is_unlocked());
        assert!(session.get_seed().is_none());
    }

    #[test]
    fn test_session_thread_safe_concurrent_access() {
        let session = SessionManager::new(Duration::from_secs(5));
        let seed = MasterSeed::new([0xAA; 32]);
        session.unlock(seed);

        let mut handles = Vec::new();
        for _ in 0..10 {
            let session_clone = session.clone();
            let handle = thread::spawn(move || {
                for _ in 0..100 {
                    let seed_opt = session_clone.get_seed();
                    assert!(seed_opt.is_some());
                    assert_eq!(seed_opt.unwrap().as_slice(), &[0xAA; 32]);
                }
            });
            handles.push(handle);
        }

        for handle in handles {
            handle.join().unwrap();
        }
    }
}
