//! 密诀 (MantraKey) 端到端全链路集成验证库
//!
//! 将标识归一化、两阶段 KDF、E2EE 信封封包与 CRDT 合并、插件沙箱安全网关完整串联。

pub mod pipeline;

pub use pipeline::*;
