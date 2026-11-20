use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 账号级别同步实体项
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccountEntry {
    /// 账号名
    pub username: String,

    /// 改密版本计数器 (单调递增)
    pub version: u32,

    /// 账号更新时间戳 (UTC 毫秒)
    pub updated_at: u64,

    /// 软删除墓碑标记
    pub is_deleted: bool,
}

/// 域名站点级别同步实体项
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DomainEntry {
    /// 规范化主域名 (如 github.com)
    pub canonical_domain: String,

    /// 用户自定义显示名称 (如 GitHub)
    pub display_name: String,

    /// 密码生成规则 ID 或规则标识
    pub rule: String,

    /// 关联账号字典 (Key 为 username)
    pub accounts: HashMap<String, AccountEntry>,

    /// 站点元数据更新时间戳 (UTC 毫秒)
    pub updated_at: u64,
}

/// 全局同步元数据清单 (CvRDT 根状态对象)
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MantraManifest {
    /// 清单结构 Schema 版本号
    pub schema_version: u32,

    /// 主口令金丝雀哈希
    pub canary_hash: String,

    /// 站点域名配置字典 (Key 为 canonical_domain)
    pub domains: HashMap<String, DomainEntry>,

    /// 清单全局最后更新时间戳 (UTC 毫秒)
    pub updated_at: u64,
}

impl MantraManifest {
    /// 状态型 CRDT (CvRDT) 合并算子: 将远程清单增量自愈合并至本地
    pub fn merge(&mut self, remote: MantraManifest) {
        // 1. 金丝雀哈希与清单根时间戳: LWW (Last-Write-Wins)
        if remote.updated_at > self.updated_at {
            self.canary_hash = remote.canary_hash;
            self.updated_at = remote.updated_at;
        }

        // 2. 域名站点集合合并: G-Set 全量并集
        for (domain, remote_entry) in remote.domains {
            match self.domains.get_mut(&domain) {
                Some(local_entry) => {
                    // 站点已存在，执行字段级深度自愈合并
                    local_entry.merge(remote_entry);
                }
                None => {
                    // 站点不存在，直接吸收远程新增
                    self.domains.insert(domain, remote_entry);
                }
            }
        }
    }
}

impl DomainEntry {
    /// 站点字段级合并算子
    pub fn merge(&mut self, remote: DomainEntry) {
        // 站点元数据 (显示别名、规则配置): LWW (Last-Write-Wins)
        if remote.updated_at > self.updated_at {
            self.display_name = remote.display_name;
            self.rule = remote.rule;
            self.updated_at = remote.updated_at;
        }

        // 账号字典集合合并: 逐个账号字段合并
        for (username, remote_acc) in remote.accounts {
            match self.accounts.get_mut(&username) {
                Some(local_acc) => {
                    // 规则 A: 改密版本计数器单调取大 (Max-Register)
                    local_acc.version = local_acc.version.max(remote_acc.version);

                    // 规则 B: 墓碑删除状态与时间戳依最新时间胜出 (LWW)
                    if remote_acc.updated_at > local_acc.updated_at {
                        local_acc.is_deleted = remote_acc.is_deleted;
                        local_acc.updated_at = remote_acc.updated_at;
                    }
                }
                None => {
                    // 本地不存在该账号，吸收远程账号
                    self.accounts.insert(username, remote_acc);
                }
            }
        }
    }
}

/// 兼容函数级调用的清单合并接口
pub fn merge_manifest(local: &mut MantraManifest, remote: MantraManifest) {
    local.merge(remote);
}
