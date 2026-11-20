//! 密诀 (MantraKey) E2EE 二进制信封与 CRDT 冲突合并引擎
//!
//! 负责多端同步时数据的高强度 AES-256-GCM 二进制封包以及无锁状态自愈合并。

pub mod crdt;
pub mod envelope;

pub use crdt::{merge_manifest, AccountEntry, DomainEntry, MantraManifest};
pub use envelope::{pack_envelope, unpack_envelope, SyncError};
