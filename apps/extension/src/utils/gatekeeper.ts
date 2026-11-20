/**
 * 密诀 MantraKey 改密两阶段门禁状态机 (Password Gatekeeper)
 */

export interface StagedPasswordChange {
  domain: string;
  username: string;
  oldVersion: number;
  newVersion: number;
  oldPasswordMask: string;
  newPasswordDerived: string;
  stagedAt?: number;
}

export interface CommitResult {
  success: boolean;
  committedVersion?: number;
  error?: string;
}

export interface RollbackResult {
  success: boolean;
  revertedVersion?: number;
  error?: string;
}

/**
 * 改密门禁管理器：负责两阶段提交、状态暂存与回滚追踪
 */
export class PasswordGatekeeper {
  private stagedMap = new Map<string, StagedPasswordChange>();

  private makeKey(domain: string, username: string): string {
    return `${domain.toLowerCase()}:::${username.toLowerCase()}`;
  }

  /**
   * 暂存改密待确认记录
   */
  public stage(change: StagedPasswordChange): void {
    const key = this.makeKey(change.domain, change.username);
    this.stagedMap.set(key, {
      ...change,
      stagedAt: Date.now(),
    });
  }

  /**
   * 获取指定域名与账号的待确认改密记录
   */
  public getStaged(domain: string, username: string): StagedPasswordChange | null {
    const key = this.makeKey(domain, username);
    return this.stagedMap.get(key) ?? null;
  }

  /**
   * 提交确认改密成功
   */
  public commit(domain: string, username: string): CommitResult {
    const key = this.makeKey(domain, username);
    const staged = this.stagedMap.get(key);
    if (!staged) {
      return {
        success: false,
        error: '未找到待确认的改密暂存记录',
      };
    }

    this.stagedMap.delete(key);
    return {
      success: true,
      committedVersion: staged.newVersion,
    };
  }

  /**
   * 放弃改密并回滚至旧版本
   */
  public rollback(domain: string, username: string): RollbackResult {
    const key = this.makeKey(domain, username);
    const staged = this.stagedMap.get(key);
    if (!staged) {
      return {
        success: false,
        error: '未找到待确认的改密暂存记录',
      };
    }

    this.stagedMap.delete(key);
    return {
      success: true,
      revertedVersion: staged.oldVersion,
    };
  }

  /**
   * 清理全部暂存
   */
  public clear(): void {
    this.stagedMap.clear();
  }
}
