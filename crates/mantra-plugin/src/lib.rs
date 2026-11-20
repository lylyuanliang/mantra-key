//! 密诀 (MantraKey) 跨端插件沙箱运行时与 Hook ABI 核心库

pub mod abi;
pub mod sandbox;

pub use abi::*;
pub use sandbox::*;

/// 顶层便捷 Hook 执行函数：委派给沙箱引擎执行密码学派生扩展
pub fn execute_crypto_hook(
    engine: &PluginEngine,
    intermediate_entropy: &[u8],
    ctx: &CryptoDeriveContext,
) -> Result<Vec<u8>, PluginError> {
    engine.execute_crypto_hook(intermediate_entropy, ctx)
}
