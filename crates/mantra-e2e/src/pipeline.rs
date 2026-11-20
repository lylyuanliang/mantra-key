//! 密诀 (MantraKey) 全链路四阶段集成流水线引擎
//!
//! 深度串联标识归一化、Argon2id/HKDF 两阶段派生、E2EE 信封与 CRDT 自愈、沙箱安全网关。

use zeroize::Zeroizing;

use mantra_crypto::{
    derive_master_seed,
    derive_site_password,
    derive_sync_key,
    CryptoError,
    MasterSeed,
    SecureString,
};
use mantra_identity::{
    normalize_identity,
    CanonicalIdentity,
    IdentityError,
};
use mantra_plugin::{
    execute_crypto_hook,
    CryptoDeriveContext,
    PluginEngine,
    PluginError,
};
use mantra_sync::{
    pack_envelope,
    unpack_envelope,
    MantraManifest,
    SyncError,
};

/// 流水线错误枚举
#[derive(Debug, thiserror::Error)]
pub enum PipelineError {
    #[error("标识归一化失败: {0}")]
    Identity(#[from] IdentityError),

    #[error("密码学核心计算失败: {0}")]
    Crypto(#[from] CryptoError),

    #[error("同步信封加解密失败: {0}")]
    Sync(#[from] SyncError),

    #[error("清单序列化/反序列化失败: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("插件沙箱执行失败: {0}")]
    Plugin(#[from] PluginError),
}

/// 派生凭据返回结果
pub struct DerivedCredential {
    /// 归一化规范主域
    pub canonical_domain: String,

    /// 账号名
    pub username: String,

    /// 密码版本号
    pub version: u32,

    /// 派生的目标密码（受保护安全内存存储）
    pub password: SecureString,
}

impl std::fmt::Debug for DerivedCredential {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("DerivedCredential")
            .field("canonical_domain", &self.canonical_domain)
            .field("username", &self.username)
            .field("version", &self.version)
            .field("password", &"[PROTECTED]")
            .finish()
    }
}

/// 密诀全链路端到端协同流水线宿主
pub struct MantraFullPipeline {
    /// 根主种子（Argon2id 单车道冻结派生）
    master_seed: MasterSeed,

    /// 同步子密钥（HKDF 隔离派生）
    sync_key: Zeroizing<[u8; 32]>,
}

impl MantraFullPipeline {
    /// 根据主口令与全局盐值初始化全链路流水线
    pub fn new(master_mantra: &str, salt: &str) -> Result<Self, PipelineError> {
        let master_seed = derive_master_seed(master_mantra, salt)?;
        let sync_key = derive_sync_key(&master_seed)?;

        Ok(Self {
            master_seed,
            sync_key,
        })
    }

    /// 获取主种子引用
    pub fn master_seed(&self) -> &MasterSeed {
        &self.master_seed
    }

    /// 获取同步子密钥切片
    pub fn sync_key(&self) -> &[u8; 32] {
        &self.sync_key
    }

    /// 阶段 1 & 阶段 2：输入标识清洗 ➜ 得到 CanonicalDomain ➜ 两阶段派生目标站点强密码
    pub fn derive_for_target(
        &self,
        raw_input: &str,
        username: &str,
        version: u32,
        length: usize,
        charset_mask: u8,
    ) -> Result<DerivedCredential, PipelineError> {
        // 阶段 1：标识洗涤与 SSO 收敛
        let canonical_str = normalize_identity(raw_input)?;
        let canonical_identity = CanonicalIdentity::new(canonical_str);

        // 阶段 2：HKDF-Expand 极速派生目标密码
        let password = derive_site_password(
            &self.master_seed,
            canonical_identity.as_str(),
            username,
            version,
            length,
            charset_mask,
        )?;

        Ok(DerivedCredential {
            canonical_domain: canonical_identity.0,
            username: username.to_string(),
            version,
            password,
        })
    }

    /// 阶段 3（打包）：将本地元数据清单加密打包为 `MKEY` AES-256-GCM 二进制信封
    pub fn create_sync_envelope(
        &self,
        manifest: &MantraManifest,
    ) -> Result<Vec<u8>, PipelineError> {
        let payload_json = serde_json::to_vec(manifest)?;
        let envelope = pack_envelope(&payload_json, &self.sync_key)?;
        Ok(envelope)
    }

    /// 阶段 3（解包与合并）：解密二进制信封并与本地清单执行状态型 CRDT (CvRDT) 无锁自愈合并
    pub fn unpack_and_merge_sync(
        &self,
        envelope_bytes: &[u8],
        local_manifest: &mut MantraManifest,
    ) -> Result<(), PipelineError> {
        let decrypted_json = unpack_envelope(envelope_bytes, &self.sync_key)?;
        let remote_manifest: MantraManifest = serde_json::from_slice(&decrypted_json)?;

        // CRDT 状态型合并算子
        local_manifest.merge(remote_manifest);
        Ok(())
    }

    /// 阶段 4：通过插件安全沙箱网关派发中间随机熵，并验证单向变换与主口令零泄露
    pub fn execute_plugin_entropy_hook(
        &self,
        canonical_domain: &str,
        username: &str,
        version: u32,
        engine: &PluginEngine,
    ) -> Result<Vec<u8>, PipelineError> {
        // 计算不可逆中间随机熵（采用 HKDF 展开独立命名空间，杜绝原始主口令直接暴露至沙箱）
        use hkdf::Hkdf;
        use sha2::Sha256;

        let hk = Hkdf::<Sha256>::new(None, self.master_seed.as_slice());
        let info = format!("mantra_plugin_entropy:{}:{}:{}", canonical_domain, username, version);

        let mut intermediate_entropy = vec![0u8; 32];
        hk.expand(info.as_bytes(), &mut intermediate_entropy)
            .map_err(|e| CryptoError::HkdfError(e.to_string()))?;

        let ctx = CryptoDeriveContext {
            domain: canonical_domain.to_string(),
            username: username.to_string(),
            version,
            rule_id: "default_v1".to_string(),
        };

        // 经沙箱网关派发执行
        let transformed = execute_crypto_hook(engine, &intermediate_entropy, &ctx)?;
        Ok(transformed)
    }
}
