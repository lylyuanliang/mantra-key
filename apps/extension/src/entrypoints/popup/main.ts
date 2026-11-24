/**
 * 密诀 MantraKey - Popup 视窗交互控制逻辑
 *
 * 100% 动态驱动，支持纯浏览器本地 WebCrypto 与 Native 混合引擎
 * 默认浅色主题 (Light Theme)，一键切换至 Obsidian 暗黑极客模式
 * 清单优先 (Manifest-First) 架构，去除冗余分散小字，配置密码轮换 Popover 气泡
 */

import { computeCanary, deriveSitePassword, RulePreset } from '../../utils/crypto';
import { toUnicodeDomain } from '../../utils/domain';
import {
  getSessionState,
  unlockSession,
  lockSession,
  getAccountsForDomain,
  saveAccountForDomain,
  deleteAccountFromDomain,
  updateAccountVersion,
  getAllAccountsManifest,
  linkDomainToExisting,
  getDomainDisplayName,
  setDomainDisplayName,
  type AccountRecord,
} from '../../utils/storage';
import {
  getWebDAVConfig,
  saveWebDAVConfig,
  getSyncStatus,
  testWebDAVConnection,
  performWebDAVSync,
  exportLocalManifest,
  importMergedManifest,
  normalizeWebDAVUrl,
  type WebDAVConfig,
} from '../../utils/webdav';
import { checkExtensionUpdate, performExtensionAutoUpdate } from '../../utils/update';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM 元素引用
  const btnToggleTheme = document.getElementById('btn-toggle-theme') as HTMLButtonElement | null;

  // 扩展自动更新提醒条
  const updateBanner = document.getElementById('update-banner') as HTMLElement | null;
  const updateBannerText = document.getElementById('update-banner-text') as HTMLElement | null;
  const btnDownloadUpdate = document.getElementById('btn-download-update') as HTMLButtonElement | null;

  const headerCanaryChip = document.getElementById('header-canary-chip') as HTMLElement;
  const headerCanaryText = document.getElementById('header-canary-text') as HTMLElement;

  const sessionStatusPill = document.getElementById('session-status-pill') as HTMLElement;
  const sessionDot = document.getElementById('session-dot') as HTMLElement;
  const sessionTtlText = document.getElementById('session-ttl-text') as HTMLElement;
  const btnLockSession = document.getElementById('btn-lock-session') as HTMLButtonElement;

  // 记忆口令与防手抖元素
  const inputMasterMantra = document.getElementById('input-master-mantra') as HTMLInputElement;
  const btnToggleMantraEye = document.getElementById('btn-toggle-mantra-eye') as HTMLButtonElement;
  const canaryPreviewHex = document.getElementById('canary-preview-hex') as HTMLElement;
  const sessionActiveHint = document.getElementById('session-active-hint') as HTMLElement | null;
  const codeQuickSample = document.getElementById('code-quick-sample') as HTMLElement | null;

  // 解锁视图元素
  const currentDomainTitleRow = document.getElementById('current-domain-title-row') as HTMLElement | null;
  const currentDomainText = document.getElementById('current-domain-text') as HTMLElement;
  const currentDomainAlias = document.getElementById('current-domain-alias') as HTMLElement | null;
  const btnEditCurrentAlias = document.getElementById('btn-edit-current-alias') as HTMLButtonElement | null;
  const btnEditDomain = document.getElementById('btn-edit-domain') as HTMLButtonElement;
  const domainEditBox = document.getElementById('domain-edit-box') as HTMLElement;
  const inputCustomDomain = document.getElementById('input-custom-domain') as HTMLInputElement;
  const btnConfirmDomain = document.getElementById('btn-confirm-domain') as HTMLButtonElement;
  const btnCancelDomain = document.getElementById('btn-cancel-domain') as HTMLButtonElement;

  const accountsSection = document.getElementById('accounts-section') as HTMLElement;
  const accCountBadge = document.getElementById('acc-count-badge') as HTMLElement;
  const btnToggleAddSection = document.getElementById('btn-toggle-add-section') as HTMLButtonElement;
  const accountListEl = document.getElementById('account-list') as HTMLElement;
  const addAccountCard = document.getElementById('add-account-card') as HTMLElement;
  const deriveCardTitle = document.getElementById('derive-card-title') as HTMLElement;

  // 快捷派生卡片元素
  const newAccUser = document.getElementById('new-acc-user') as HTMLInputElement;
  const newAccVer = document.getElementById('new-acc-ver') as HTMLInputElement;
  const btnNewVerDown = document.getElementById('btn-new-ver-down') as HTMLButtonElement;
  const btnNewVerUp = document.getElementById('btn-new-ver-up') as HTMLButtonElement;
  const newAccRule = document.getElementById('new-acc-rule') as HTMLSelectElement;
  const newPwdPreview = document.getElementById('new-pwd-preview') as HTMLElement;
  const btnPeekPreview = document.getElementById('btn-peek-preview') as HTMLButtonElement;

  // 通用服务归属与常变域名别名组件
  const newAccService = document.getElementById('new-acc-service') as HTMLInputElement | null;
  const newAccAliases = document.getElementById('new-acc-aliases') as HTMLInputElement | null;
  const serviceAliasesWrap = document.getElementById('service-aliases-wrap') as HTMLElement | null;
  const btnToggleServiceDetail = document.getElementById('btn-toggle-service-detail') as HTMLElement | null;

  // 版本 Popover 气泡组件
  const versionInfoBtn = document.getElementById('version-info-btn') as HTMLButtonElement | null;
  const versionPopoverCard = document.getElementById('version-popover-card') as HTMLElement | null;
  const popoverCloseBtn = document.getElementById('popover-close-btn') as HTMLButtonElement | null;

  const btnActionAutofill = document.getElementById('btn-action-autofill') as HTMLButtonElement;
  const btnActionSave = document.getElementById('btn-action-save') as HTMLButtonElement;
  const btnActionCopy = document.getElementById('btn-action-copy') as HTMLButtonElement;

  const linkClearAllDomain = document.getElementById('link-clear-all-domain') as HTMLElement;
  const copyToast = document.getElementById('copy-toast') as HTMLElement;

  // 模态弹窗与本地备份组件
  const btnModalBackTop = document.getElementById('btn-modal-back-top') as HTMLButtonElement | null;
  const btnModalBackBottom = document.getElementById('btn-modal-back-bottom') as HTMLButtonElement | null;
  const tabBtnLocal = document.getElementById('tab-btn-local') as HTMLButtonElement | null;
  const tabBtnWebdav = document.getElementById('tab-btn-webdav') as HTMLButtonElement | null;
  const paneLocalBackup = document.getElementById('pane-local-backup') as HTMLElement | null;
  const paneWebdavSync = document.getElementById('pane-webdav-sync') as HTMLElement | null;
  const btnDoExportFile = document.getElementById('btn-do-export-file') as HTMLButtonElement | null;
  const btnTriggerImportFile = document.getElementById('btn-trigger-import-file') as HTMLButtonElement | null;
  const inputImportBackupFile = document.getElementById('input-import-backup-file') as HTMLInputElement | null;

  // 内部状态
  let currentDomain = 'github.com';
  let activeTabTitle = '';
  let activeMantra: string | null = null;
  let activeCanary: string | null = null;
  let ttlRemaining = 0;
  let isUnlocked = false;
  let isMantraPeek = false;
  let isPreviewPeek = false;
  let currentDerivedPreview = '';
  let ttlTimer: number | null = null;

  /**
   * 弹出 Toast 提示 (顶层高 z-index 浮层，支持多次调用防抖)
   */
  let toastTimer: number | null = null;
  function showToast(text: string, duration: number = 2400) {
    if (copyToast) {
      if (toastTimer) {
        clearTimeout(toastTimer);
      }
      copyToast.textContent = text;
      copyToast.style.display = 'block';
      toastTimer = window.setTimeout(() => {
        copyToast.style.display = 'none';
        toastTimer = null;
      }, duration);
    }
  }

  /**
   * 双主题管理器：默认浅色主题 (Light Theme)，支持平滑切换至深色主题
   */
  function applyTheme(theme: 'light' | 'dark') {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.className = theme;
    if (btnToggleTheme) {
      btnToggleTheme.textContent = theme === 'light' ? '🌙' : '☀️';
      btnToggleTheme.title = theme === 'light' ? '切换至深色主题' : '切换至浅色主题';
    }
    localStorage.setItem('mantra_theme', theme);
    try {
      chrome.storage.local.set({ mantra_theme: theme });
    } catch {
      // 容错处理
    }
  }

  // 读取并应用主题：优先本地缓存，默认浅色
  const savedTheme = (localStorage.getItem('mantra_theme') as 'light' | 'dark') || 'light';
  applyTheme(savedTheme);

  btnToggleTheme?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme);
    showToast(nextTheme === 'light' ? '已切换至浅色主题' : '已切换至暗黑极客主题');
  });

  /**
   * 版本号解释气泡 (Popover/Tooltip) 交互管理
   */
  function setPopoverOpen(isOpen: boolean) {
    if (!versionPopoverCard || !versionInfoBtn) return;
    versionPopoverCard.classList.toggle('is-active', isOpen);
    versionPopoverCard.setAttribute('aria-hidden', String(!isOpen));
    versionInfoBtn.setAttribute('aria-expanded', String(isOpen));
  }

  versionInfoBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = versionPopoverCard?.classList.contains('is-active');
    setPopoverOpen(!isOpen);
  });

  popoverCloseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    setPopoverOpen(false);
  });

  document.addEventListener('click', (e) => {
    if (versionPopoverCard && !versionPopoverCard.contains(e.target as Node) && !versionInfoBtn?.contains(e.target as Node)) {
      setPopoverOpen(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && versionPopoverCard?.classList.contains('is-active')) {
      setPopoverOpen(false);
      versionInfoBtn?.focus();
    }
  });

  /**
   * 复制到剪贴板并提示
   */
  async function copyToClipboard(text: string, label: string = '强密码') {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`已复制 ${label} 到剪贴板 (30s 自毁)`);
    } catch {
      showToast(`已生成 ${label} (请手动选择复制)`);
    }
  }

  /**
   * 启动 TTL 倒计时
   */
  function startTtlTimer() {
    if (ttlTimer) {
      clearInterval(ttlTimer);
    }
    ttlTimer = window.setInterval(() => {
      if (ttlRemaining > 0) {
        ttlRemaining--;
        const mins = Math.floor(ttlRemaining / 60);
        const secs = ttlRemaining % 60;
        sessionTtlText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      } else {
        handleLockSession();
      }
    }, 1000);
  }

  /**
   * 刷新界面会话视图状态
   */
  function updateSessionView() {
    if (isUnlocked && activeMantra) {
      document.body.classList.add('is-unlocked');
      sessionDot.classList.remove('locked');
      if (sessionStatusPill) {
        sessionStatusPill.classList.remove('locked');
        sessionStatusPill.title = '记忆口令已就绪（15分钟物理清空）';
      }
      btnLockSession.style.display = 'inline-flex';
      btnLockSession.textContent = '清空';
      btnLockSession.title = '立即清空口令缓存并擦除内存';

      headerCanaryChip.style.display = 'inline-flex';
      headerCanaryText.textContent = activeCanary || '--------';

      const mins = Math.floor(ttlRemaining / 60);
      const secs = ttlRemaining % 60;
      sessionTtlText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      if (linkClearAllDomain) linkClearAllDomain.style.display = 'inline';

      if (sessionActiveHint) sessionActiveHint.style.display = 'block';
      if (!inputMasterMantra.value) {
        inputMasterMantra.placeholder = '已就绪 (可留空沿用，或输入新口令覆盖)...';
        canaryPreviewHex.textContent = activeCanary || '--------';
      }

      startTtlTimer();
      updateNewPwdPreview();
    } else {
      document.body.classList.remove('is-unlocked');
      headerCanaryChip.style.display = 'none';
      if (linkClearAllDomain) linkClearAllDomain.style.display = 'none';
      sessionDot.classList.add('locked');
      if (sessionStatusPill) {
        sessionStatusPill.classList.add('locked');
        sessionStatusPill.title = '口令未就绪，内存零驻留';
      }
      sessionTtlText.textContent = '待输入';
      btnLockSession.style.display = 'none';
      if (sessionActiveHint) sessionActiveHint.style.display = 'none';
      if (!inputMasterMantra.value) {
        inputMasterMantra.placeholder = '输入记忆口令...';
        canaryPreviewHex.textContent = '--------';
      }
      if (ttlTimer) {
        clearInterval(ttlTimer);
        ttlTimer = null;
      }
      updateNewPwdPreview();
    }
  }

  /**
   * 获取当前生效的记忆口令 (优先采用输入框即时输入，若输入框为空则沿用有效会话)
   */
  async function getEffectiveMantra(): Promise<string> {
    const inputVal = inputMasterMantra.value.trim();
    if (inputVal) {
      if (inputVal !== activeMantra) {
        const state = await unlockSession(inputVal, 900);
        isUnlocked = true;
        activeMantra = state.mantra;
        activeCanary = state.canary;
        ttlRemaining = state.ttlRemaining || 900;
        updateSessionView();
  await loadDomainAccounts();
      }
      return inputVal;
    }
    if (activeMantra) {
      return activeMantra;
    }
    return '';
  }

  /**
   * 执行清空已存口令
   */
  async function handleLockSession() {
    await lockSession();
    isUnlocked = false;
    activeMantra = null;
    activeCanary = null;
    ttlRemaining = 0;
    inputMasterMantra.value = '';
    canaryPreviewHex.textContent = '--------';
    updateSessionView();
  await loadDomainAccounts();
    showToast('口令已清空，内存已物理清零');
  }

  /**
   * 动态实时派生快速录入区的密码预览
   */
  async function updateNewPwdPreview() {
    const currentMantra = inputMasterMantra.value.trim() || activeMantra;
    if (!currentMantra) {
      newPwdPreview.textContent = '••••••••••••••••';
      currentDerivedPreview = '';
      return;
    }

    const username = newAccUser.value.trim() || 'default';
    const version = parseInt(newAccVer.value, 10) || 1;
    const rule = (newAccRule.value as RulePreset) || 'standard-16';
    const serviceKey = newAccService?.value.trim() || '';
    const derivationBase = serviceKey || currentDomain;

    try {
      const derived = await deriveSitePassword(currentMantra, derivationBase, username, version, rule);
      currentDerivedPreview = derived;
      if (isPreviewPeek) {
        newPwdPreview.textContent = derived;
      } else {
        newPwdPreview.textContent = '•'.repeat(Math.min(derived.length, 16));
      }
    } catch (e) {
      console.warn('预览派生异常:', e);
    }
  }

  let selectedAccount: AccountRecord | null = null;

  function applySelectedAccount(acc: AccountRecord) {
    selectedAccount = acc;
    deriveCardTitle.textContent = `📌 账号详情与生成: ${acc.username}`;
    newAccUser.value = acc.username;
    if (newAccService) {
      newAccService.value = acc.serviceKey || '';
    }
    if (newAccRule) {
      newAccRule.value = acc.rulePreset || 'standard-16';
    }
    newAccVer.value = String(acc.version || 1);
    btnActionAutofill.textContent = '⚡ 填入网页';
    btnActionSave.textContent = '💾 保存修改并填入';
    updateNewPwdPreview();
  }

  function applyNewAccountMode() {
    selectedAccount = null;
    accountListEl.querySelectorAll('.account-item').forEach((el) => el.classList.remove('active'));
    deriveCardTitle.textContent = '⚡ 录入新账号与派生';
    newAccUser.value = '';
    if (newAccService) {
      newAccService.value = currentDomain;
    }
    if (newAccRule) {
      newAccRule.value = 'standard-16';
    }
    newAccVer.value = '1';
    btnActionAutofill.textContent = '⚡ 仅派生填入';
    btnActionSave.textContent = '💾 保存账号并填充';
    newAccUser.focus();
    updateNewPwdPreview();
  }

  /**
   * 渲染并加载当前域名的账号列表 (清单优先 Manifest-First)
   * 即使未解锁状态下，也完整展示凭据元数据清单
   */
  async function loadDomainAccounts() {
    const accounts = await getAccountsForDomain(currentDomain, activeTabTitle);
    accCountBadge.textContent = accounts.length.toString();

    // 账号区域常驻展示，杜绝无清单界面的情况
    accountsSection.style.display = 'flex';

    if (accounts.length === 0) {
      accountListEl.innerHTML = `
        <div class="empty-accounts-card" style="padding: 10px 12px; background: var(--color-surface-subtle); border: 1px dashed var(--color-border); border-radius: 8px; text-align: center; margin-bottom: 4px;">
          <div style="font-size: 11px; color: var(--color-text-muted); margin-bottom: 6px;">
            当前站点尚未记录专属账号
          </div>
          <div style="display: flex; gap: 8px; justify-content: center;">
            <button type="button" class="btn-xs-primary" id="btn-empty-quick-add" style="padding: 4px 10px; font-size: 11px; cursor: pointer;">
              + 立即录入
            </button>
            <button type="button" class="btn-xs-muted" id="btn-empty-open-manifest" style="padding: 4px 10px; font-size: 11px; cursor: pointer;">
              📋 浏览所有记录
            </button>
          </div>
        </div>
      `;

      accountListEl.querySelector('#btn-empty-quick-add')?.addEventListener('click', () => {
        applyNewAccountMode();
      });
      accountListEl.querySelector('#btn-empty-open-manifest')?.addEventListener('click', () => {
        openManifestModal();
      });
      applyNewAccountMode();
      return;
    }

    accountListEl.innerHTML = '';

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const itemEl = document.createElement('div');
      itemEl.className = 'account-item' + (i === 0 ? ' active' : '');
      itemEl.dataset.username = acc.username;

      let accountPwd = '';
      const derivationBase = acc.serviceKey || currentDomain;
      if (activeMantra) {
        accountPwd = await deriveSitePassword(
          activeMantra,
          derivationBase,
          acc.username,
          acc.version,
          acc.rulePreset
        );
      }

      const aliasBadgeHtml = acc.serviceKey ? `<span class="alias-tag-badge" title="跨域名派生对齐">🏷️ ${acc.serviceKey}</span>` : '';

      itemEl.innerHTML = `
        <div class="account-item-top">
          <span class="account-username" title="${acc.username}">${acc.username}</span>
          <div style="display: flex; align-items: center;">
            <span class="account-tag ${acc.tag === 'Work' ? 'work' : ''}">${acc.tag || 'v' + acc.version}</span>
            ${aliasBadgeHtml}
          </div>
        </div>
        <div class="account-item-bottom">
          <div class="account-meta">
            <span class="account-rule">${acc.rulePreset}</span>
            <div class="version-stepper-sm">
              <button type="button" class="btn-step-sm btn-item-ver-down" title="版本-1">-</button>
              <span class="ver-text-sm">v${acc.version}</span>
              <button type="button" class="btn-step-sm btn-item-ver-up" title="改密轮换+1">+</button>
            </div>
          </div>
          <div class="account-actions">
            <button type="button" class="btn-autofill-sm btn-item-autofill" title="一键填充到页面">⚡ 填充</button>
            <button type="button" class="btn-copy-pwd btn-item-copy" title="复制派生密码">📋 复制</button>
            <button type="button" class="btn-del-sm btn-item-del" title="删除账号记录">✕</button>
          </div>
        </div>
      `;

      // 点击整个卡片项：选定该账号，并在下方展示详情
      itemEl.addEventListener('click', () => {
        accountListEl.querySelectorAll('.account-item').forEach((el) => el.classList.remove('active'));
        itemEl.classList.add('active');
        applySelectedAccount(acc);
        if (!activeMantra) {
          inputMasterMantra.focus();
        }
      });

      // 填充快捷按钮
      itemEl.querySelector('.btn-item-autofill')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        accountListEl.querySelectorAll('.account-item').forEach((el) => el.classList.remove('active'));
        itemEl.classList.add('active');
        applySelectedAccount(acc);

        const mantra = await getEffectiveMantra();
        if (!mantra) {
          inputMasterMantra.focus();
          showToast('请先输入记忆口令以实时生成强密码');
          return;
        }

        const pwd = await deriveSitePassword(
          mantra,
          derivationBase,
          acc.username,
          acc.version,
          acc.rulePreset
        );

        chrome.runtime.sendMessage({
          action: 'AUTOFILL_ACTIVE_TAB',
          payload: {
            username: acc.username,
            password: pwd,
          },
        }, () => {
          const _err = chrome.runtime.lastError;
          showToast(`已向网页填入 [${acc.username}] 与强密码`);
        });
      });

      itemEl.querySelector('.btn-item-copy')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const mantra = await getEffectiveMantra();
        if (!mantra) {
          inputMasterMantra.focus();
          showToast('请先输入记忆口令以实时生成强密码');
          return;
        }
        const pwd = await deriveSitePassword(
          mantra,
          derivationBase,
          acc.username,
          acc.version,
          acc.rulePreset
        );
        copyToClipboard(pwd, acc.username);
      });

      itemEl.querySelector('.btn-item-ver-down')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (acc.version > 1) {
          await updateAccountVersion(currentDomain, acc.username, acc.version - 1);
          loadDomainAccounts();
          showToast(`[${acc.username}] 版本已降回 v${acc.version - 1}`);
        }
      });

      itemEl.querySelector('.btn-item-ver-up')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        const nextVer = acc.version + 1;
        await updateAccountVersion(currentDomain, acc.username, nextVer);
        loadDomainAccounts();
        showToast(`[${acc.username}] 准备改密：版本提升至 v${nextVer}`);
      });

      itemEl.querySelector('.btn-item-del')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`确定要移除账号 [${acc.username}] 吗？`)) {
          await deleteAccountFromDomain(currentDomain, acc.username);
          loadDomainAccounts();
          showToast(`已移除 [${acc.username}]`);
        }
      });

      accountListEl.appendChild(itemEl);
    }

    // 默认展示第一个账号的详情与生成界面
    if (accounts.length > 0) {
      applySelectedAccount(accounts[0]);
    }
  }

  // ================= 初始加载与事件监听 =================

  function startInlineAliasEdit(
    container: HTMLElement,
    targetDomain: string,
    initialVal: string,
    onSaveSuccess: () => Promise<void>,
    onCancel?: () => void
  ) {
    const originalHtml = container.innerHTML;
    container.innerHTML = `
      <div class="inline-alias-wrapper" style="width: 100%; display: flex; align-items: center; gap: 4px;">
        <input type="text" class="inline-alias-input" value="${initialVal.replace(/"/g, '&quot;')}" placeholder="输入站点别名" style="flex: 1; min-width: 80px;" />
        <button type="button" class="btn-inline-alias-save" title="保存修改 (Enter)">✓</button>
        <button type="button" class="btn-inline-alias-cancel" title="取消 (Esc)">✕</button>
      </div>
    `;

    const input = container.querySelector('.inline-alias-input') as HTMLInputElement | null;
    const btnSave = container.querySelector('.btn-inline-alias-save') as HTMLButtonElement | null;
    const btnCancel = container.querySelector('.btn-inline-alias-cancel') as HTMLButtonElement | null;

    if (!input) return;

    input.focus();
    input.select();

    let isFinished = false;

    const doSave = async () => {
      if (isFinished) return;
      isFinished = true;
      const newAlias = input.value.trim();
      await setDomainDisplayName(targetDomain, newAlias);
      showToast(newAlias ? `已保存站点备注 [${newAlias}]` : '已恢复默认站点域名');
      await onSaveSuccess();
    };

    const doCancel = () => {
      if (isFinished) return;
      isFinished = true;
      if (onCancel) {
        onCancel();
      } else {
        container.innerHTML = originalHtml;
      }
    };

    btnSave?.addEventListener('click', (e) => {
      e.stopPropagation();
      doSave();
    });

    btnCancel?.addEventListener('click', (e) => {
      e.stopPropagation();
      doCancel();
    });

    input.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        e.preventDefault();
        doSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        doCancel();
      }
    });

    input.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  async function triggerMainDomainInlineEdit() {
    if (!currentDomainTitleRow) return;
    const curName = (await getDomainDisplayName(currentDomain)) || toUnicodeDomain(currentDomain);
    startInlineAliasEdit(
      currentDomainTitleRow,
      currentDomain,
      curName,
      async () => {
        await refreshCurrentDomainDisplay();
        if (manifestModalOverlay && manifestModalOverlay.style.display !== 'none') {
          await renderAllManifest(inputSearchManifest?.value || '');
        }
      },
      () => {
        refreshCurrentDomainDisplay();
      }
    );
  }

  async function refreshCurrentDomainDisplay() {
    const unicode = toUnicodeDomain(currentDomain);
    const displayName = await getDomainDisplayName(currentDomain);

    if (currentDomainTitleRow) {
      currentDomainTitleRow.innerHTML = `
        <span class="domain-name" id="current-domain-text" title="${currentDomain}">${unicode}</span>
        <button type="button" id="btn-edit-current-alias" title="设置/修改站点别名" style="border: none; background: transparent; cursor: pointer; font-size: 11px; padding: 0 2px; opacity: 0.6; transition: opacity 0.15s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'">✏️</button>
      `;
      currentDomainTitleRow.querySelector('#btn-edit-current-alias')?.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerMainDomainInlineEdit();
      });
      currentDomainTitleRow.querySelector('#current-domain-text')?.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        triggerMainDomainInlineEdit();
      });
    } else {
      currentDomainText.textContent = unicode;
      currentDomainText.title = currentDomain;
    }

    if (displayName && displayName !== unicode && displayName !== currentDomain) {
      if (currentDomainAlias) {
        currentDomainAlias.textContent = `🏷️ ${displayName}`;
        currentDomainAlias.style.display = 'inline-block';
      }
    } else {
      if (currentDomainAlias) {
        currentDomainAlias.style.display = 'none';
      }
    }
  }

  // 1. 获取当前活动标签页真实域名并转换为友好 Unicode
  try {
    const domainRes = await new Promise<{ domain?: string; title?: string }>((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_CURRENT_DOMAIN' }, (res) => {
        const _err = chrome.runtime.lastError;
        resolve(res);
      });
    });
    if (domainRes?.domain) {
      currentDomain = domainRes.domain;
    }
    if (domainRes?.title) {
      activeTabTitle = domainRes.title;
    }
  } catch (e) {
    console.warn('[Popup] 获取活动域名失败:', e);
  }
  await refreshCurrentDomainDisplay();

  // 2. 检查会话状态并渲染视图
  const session = await getSessionState();
  if (session.isUnlocked && session.mantra) {
    isUnlocked = true;
    activeMantra = session.mantra;
    activeCanary = session.canary;
    ttlRemaining = session.ttlRemaining;
  }
  updateSessionView();
  await loadDomainAccounts();

  // 3. 记忆口令输入事件：实时金丝雀指纹计算与密码预览联动
  inputMasterMantra.addEventListener('input', async () => {
    const val = inputMasterMantra.value.trim();
    if (val) {
      const canary = await computeCanary(val);
      canaryPreviewHex.textContent = canary;
    } else if (activeMantra) {
      canaryPreviewHex.textContent = activeCanary || await computeCanary(activeMantra);
    } else {
      canaryPreviewHex.textContent = '--------';
    }
    updateNewPwdPreview();
  });

  inputMasterMantra.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnActionAutofill.click();
    }
  });

  // 4. 明文切换按钮（密文状态显示 🙈 点击显示；明文状态显示 👁️ 点击隐藏）
  btnToggleMantraEye.addEventListener('click', () => {
    isMantraPeek = !isMantraPeek;
    inputMasterMantra.type = isMantraPeek ? 'text' : 'password';
    btnToggleMantraEye.textContent = isMantraPeek ? '👁️' : '🙈';
    btnToggleMantraEye.title = isMantraPeek ? '点击隐藏口令' : '点击显示明文';
  });

  // 5. 检查插件在线版本更新与一键静默升级
  checkExtensionUpdate().then((info) => {
    if (info?.hasUpdate && updateBanner && updateBannerText && btnDownloadUpdate) {
      updateBanner.style.display = 'flex';
      updateBannerText.textContent = `🚀 密诀新版本 v${info.latestVersion} 可用！`;
      btnDownloadUpdate.onclick = async () => {
        btnDownloadUpdate.disabled = true;
        btnDownloadUpdate.textContent = '⏳ 更新中...';
        showToast('正在执行在线自动更新...');

        const updateResult = await performExtensionAutoUpdate(info, (statusText) => {
          showToast(statusText);
        });

        if (updateResult.success) {
          showToast(updateResult.message);
        } else {
          showToast(updateResult.message, 5000);
          btnDownloadUpdate.disabled = false;
          btnDownloadUpdate.textContent = '⚡ 一键更新';
        }
      };
    }
  }).catch(() => {});

  // 6. 快捷示例填充 (若存在)
  codeQuickSample?.addEventListener('click', async () => {
    inputMasterMantra.value = 'CorrectHorseBatteryStaple2026!';
    inputMasterMantra.dispatchEvent(new Event('input'));
  });

  // 7. 顶部锁切换
  btnLockSession.addEventListener('click', () => {
    if (isUnlocked) {
      handleLockSession();
    } else {
      inputMasterMantra.focus();
    }
  });

  // 8. 域名编辑切换
  btnEditDomain.addEventListener('click', () => {
    domainEditBox.style.display = domainEditBox.style.display === 'none' ? 'flex' : 'none';
    inputCustomDomain.value = currentDomain;
    inputCustomDomain.focus();
  });

  btnConfirmDomain.addEventListener('click', async () => {
    const custom = inputCustomDomain.value.trim().toLowerCase();
    if (custom) {
      currentDomain = custom;
      await refreshCurrentDomainDisplay();
      domainEditBox.style.display = 'none';
      loadDomainAccounts();
      updateNewPwdPreview();
      showToast(`已切换至目标域名: ${toUnicodeDomain(currentDomain)}`);
    }
  });

  btnCancelDomain.addEventListener('click', () => {
    domainEditBox.style.display = 'none';
  });

  // 9. 展开录入新账号
  btnToggleAddSection.addEventListener('click', () => {
    applyNewAccountMode();
    addAccountCard.scrollIntoView({ behavior: 'smooth' });
    newAccUser.focus();
  });

  // 10. 录入表单动态派生事件
  newAccUser.addEventListener('input', () => updateNewPwdPreview());
  newAccRule.addEventListener('change', () => updateNewPwdPreview());

  btnNewVerDown.addEventListener('click', () => {
    let ver = parseInt(newAccVer.value, 10) || 1;
    if (ver > 1) {
      newAccVer.value = (ver - 1).toString();
      updateNewPwdPreview();
    }
  });

  btnNewVerUp.addEventListener('click', () => {
    let ver = parseInt(newAccVer.value, 10) || 1;
    newAccVer.value = (ver + 1).toString();
    updateNewPwdPreview();
  });

  btnPeekPreview.addEventListener('click', () => {
    isPreviewPeek = !isPreviewPeek;
    btnPeekPreview.textContent = isPreviewPeek ? '🔒' : '👁️';
    updateNewPwdPreview();
  });

  // 11. 填入网页
  btnActionAutofill.addEventListener('click', async () => {
    const mantra = await getEffectiveMantra();
    if (!mantra) {
      inputMasterMantra.focus();
      showToast('🔑 请先输入记忆口令以生成强密码');
      return;
    }
    const user = newAccUser.value.trim();
    await updateNewPwdPreview();
    if (!currentDerivedPreview) {
      showToast('生成密码失败');
      return;
    }
    chrome.runtime.sendMessage({
      action: 'AUTOFILL_ACTIVE_TAB',
      payload: {
        username: user,
        password: currentDerivedPreview,
      },
    }, () => {
      const _err = chrome.runtime.lastError;
      showToast(`⚡ 已向网页填入 [${user || '账号'}] 与强密码！`);
    });
  });

  // 12. 保存账号并填充
  btnActionSave.addEventListener('click', async () => {
    const user = newAccUser.value.trim();
    if (!user) {
      showToast('请输入账号或用户名');
      newAccUser.focus();
      return;
    }

    const mantra = await getEffectiveMantra();
    if (!mantra) {
      inputMasterMantra.focus();
      showToast('🔑 请先输入记忆口令以生成强密码');
      return;
    }

    const version = parseInt(newAccVer.value, 10) || 1;
    const rulePreset = (newAccRule.value as RulePreset) || 'standard-16';
    const serviceKey = newAccService?.value.trim() || undefined;
    const aliasesRaw = newAccAliases?.value.trim() || '';
    const aliases = aliasesRaw ? aliasesRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : undefined;

    await saveAccountForDomain(currentDomain, {
      username: user,
      version,
      rulePreset,
      serviceKey,
      aliases,
      tag: serviceKey ? `服务: ${serviceKey}` : 'Personal',
    });

    await updateNewPwdPreview();

    chrome.runtime.sendMessage({
      action: 'AUTOFILL_ACTIVE_TAB',
      payload: {
        username: user,
        password: currentDerivedPreview,
      },
    }, () => {
      const _err = chrome.runtime.lastError;
    });

    await loadDomainAccounts();
    showToast(`已保存账号 [${user}] 并填入当前网页！`);
  });

  // 13. 复制密码
  btnActionCopy.addEventListener('click', async () => {
    if (!currentDerivedPreview) {
      await updateNewPwdPreview();
    }
    copyToClipboard(currentDerivedPreview, newAccUser.value.trim() || '派生强密码');
  });

  // 14. 清空本站凭据
  linkClearAllDomain.addEventListener('click', async () => {
    if (confirm(`确定要清空域名 [${toUnicodeDomain(currentDomain)}] 下的所有凭据吗？`)) {
      const key = `mantra_accs_${currentDomain.toLowerCase()}`;
      await chrome.storage.local.remove([key]);
      loadDomainAccounts();
      showToast(`已清空 [${toUnicodeDomain(currentDomain)}] 的凭据`);
    }
  });

  // 15. 通用服务归属与常变域名别名切换交互
  btnToggleServiceDetail?.addEventListener('click', () => {
    if (serviceAliasesWrap) {
      const isHidden = serviceAliasesWrap.style.display === 'none';
      serviceAliasesWrap.style.display = isHidden ? 'flex' : 'none';
    }
  });
  newAccService?.addEventListener('input', () => updateNewPwdPreview());

  // 16. 数据管理与多端同步全屏模态弹窗交互
  const btnOpenSyncModal = document.getElementById('btn-open-sync-modal');
  const syncModalOverlay = document.getElementById('sync-modal-overlay');
  const btnCloseSyncModal = document.getElementById('btn-close-sync-modal');

  const syncInputUrl = document.getElementById('sync-input-url') as HTMLInputElement | null;
  const syncInputUser = document.getElementById('sync-input-user') as HTMLInputElement | null;
  const syncInputPass = document.getElementById('sync-input-pass') as HTMLInputElement | null;
  const syncInputFile = document.getElementById('sync-input-file') as HTMLInputElement | null;
  const syncInputSyncPass = document.getElementById('sync-input-sync-pass') as HTMLInputElement | null;
  const btnToggleSyncPass = document.getElementById('btn-toggle-sync-pass') as HTMLButtonElement | null;

  let isSyncPassPeek = false;
  btnToggleSyncPass?.addEventListener('click', () => {
    isSyncPassPeek = !isSyncPassPeek;
    if (syncInputSyncPass) {
      syncInputSyncPass.type = isSyncPassPeek ? 'text' : 'password';
    }
    if (btnToggleSyncPass) {
      btnToggleSyncPass.textContent = isSyncPassPeek ? '🔒 隐藏' : '👁️ 显示';
    }
  });

  function promptSyncPasswordModal(): Promise<string | null> {
    return new Promise((resolve) => {
      const modal = document.getElementById('sync-pass-modal-overlay');
      const input = document.getElementById('modal-sync-pass-input') as HTMLInputElement | null;
      const btnConfirm = document.getElementById('btn-confirm-modal-sync-pass');
      const btnCancel = document.getElementById('btn-cancel-modal-sync-pass');

      if (!modal || !input || !btnConfirm || !btnCancel) {
        const val = prompt('检测到云端备份已启用端到端加密，请输入「同步加密密码」以解锁合并：');
        resolve(val ? val.trim() : null);
        return;
      }

      input.value = '';
      modal.style.display = 'flex';
      input.focus();

      const cleanup = () => {
        modal.style.display = 'none';
        btnConfirm.removeEventListener('click', onConfirm);
        btnCancel.removeEventListener('click', onCancel);
      };

      const onConfirm = () => {
        const val = input.value.trim();
        cleanup();
        resolve(val || null);
      };

      const onCancel = () => {
        cleanup();
        resolve(null);
      };

      btnConfirm.addEventListener('click', onConfirm);
      btnCancel.addEventListener('click', onCancel);
    });
  }

  const btnPopupTestSync = document.getElementById('btn-popup-test-sync') as HTMLButtonElement | null;
  const btnPopupSaveSync = document.getElementById('btn-popup-save-sync') as HTMLButtonElement | null;
  const btnPopupDoSync = document.getElementById('btn-popup-do-sync') as HTMLButtonElement | null;

  const popupSyncStatusBadge = document.getElementById('popup-sync-status-badge');
  const popupSyncTimeText = document.getElementById('popup-sync-time-text');

  function closeSyncModal() {
    if (syncModalOverlay) {
      syncModalOverlay.style.display = 'none';
    }
  }

  function openSyncModal() {
    if (syncModalOverlay) {
      syncModalOverlay.style.display = 'flex';
      refreshSyncView();
    }
  }

  btnOpenSyncModal?.addEventListener('click', openSyncModal);
  btnCloseSyncModal?.addEventListener('click', closeSyncModal);
  btnModalBackTop?.addEventListener('click', closeSyncModal);
  btnModalBackBottom?.addEventListener('click', closeSyncModal);

  // 点击遮罩空白区域自动关闭
  syncModalOverlay?.addEventListener('click', (e) => {
    if (e.target === syncModalOverlay) {
      closeSyncModal();
    }
  });

  // 按 ESC 键快速返回
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && syncModalOverlay && syncModalOverlay.style.display !== 'none') {
      closeSyncModal();
    }
  });

  // Tab 选项卡切换 (本地文件备份 vs WebDAV 云端同步)
  tabBtnLocal?.addEventListener('click', () => {
    tabBtnLocal.classList.add('active');
    tabBtnWebdav?.classList.remove('active');
    if (paneLocalBackup) paneLocalBackup.style.display = 'block';
    if (paneWebdavSync) paneWebdavSync.style.display = 'none';
  });

  tabBtnWebdav?.addEventListener('click', () => {
    tabBtnWebdav.classList.add('active');
    tabBtnLocal?.classList.remove('active');
    if (paneWebdavSync) paneWebdavSync.style.display = 'block';
    if (paneLocalBackup) paneLocalBackup.style.display = 'none';
    refreshSyncView();
  });

  // 本地账号清单备份文件导出 (.json) - 零门槛，无需输入记忆口令
  btnDoExportFile?.addEventListener('click', async () => {
    try {
      const manifest = await exportLocalManifest('');
      const jsonStr = JSON.stringify(manifest, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
      a.href = url;
      a.download = `mantra_accounts_backup_${timeStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('🎉 账号清单备份 (.json) 导出成功！');
    } catch (err: any) {
      showToast('❌ 导出备份异常: ' + (err?.message || '未知错误'));
    }
  });

  // 本地文件选取并导入 - 零门槛，直接解析并 CRDT 智能合并
  btnTriggerImportFile?.addEventListener('click', () => {
    inputImportBackupFile?.click();
  });

  inputImportBackupFile?.addEventListener('change', async () => {
    const file = inputImportBackupFile?.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let manifest: any;
      try {
        manifest = JSON.parse(text);
      } catch {
        throw new Error('所选文件不是有效的 JSON 格式');
      }

      if (!manifest || typeof manifest !== 'object' || !manifest.domains) {
        throw new Error('无效的备份文件结构（未包含 domains 节点）');
      }

      await importMergedManifest(manifest);
      await loadDomainAccounts();
      const domainCount = Object.keys(manifest.domains).length;
      showToast(`🎉 成功导入并合并 ${domainCount} 个站点的账号清单！`);
      closeSyncModal();
    } catch (err: any) {
      showToast('❌ 导入失败: ' + (err?.message || '文件损坏或格式不符'));
    } finally {
      if (inputImportBackupFile) inputImportBackupFile.value = '';
    }
  });

  // WebDAV 状态刷新
  async function refreshSyncView() {
    const cfg = await getWebDAVConfig();
    const info = await getSyncStatus();

    if (syncInputUrl && !syncInputUrl.value) syncInputUrl.value = cfg.serverUrl || 'https://dav.jianguoyun.com/dav/mantra-key';
    if (syncInputUser && !syncInputUser.value) syncInputUser.value = cfg.username || '';
    if (syncInputPass && !syncInputPass.value) syncInputPass.value = cfg.password || '';
    if (syncInputFile && !syncInputFile.value) syncInputFile.value = cfg.remoteFileName || 'mantra_sync.mkey';
    if (syncInputSyncPass && !syncInputSyncPass.value) syncInputSyncPass.value = cfg.syncPassword || '';

    if (popupSyncTimeText) {
      popupSyncTimeText.textContent = info.lastSyncTime ? `上次同步: ${info.lastSyncTime}` : '上次同步: 尚未同步';
    }

    if (popupSyncStatusBadge) {
      popupSyncStatusBadge.className = 'sync-tag ' + (info.status || 'idle');
      if (info.status === 'success') {
        popupSyncStatusBadge.textContent = '🟢 已同步';
      } else if (info.status === 'syncing') {
        popupSyncStatusBadge.textContent = '🔄 同步中...';
      } else if (info.status === 'error') {
        popupSyncStatusBadge.textContent = '🔴 失败';
      } else {
        popupSyncStatusBadge.textContent = cfg.serverUrl ? '⚪ 待同步' : '⚪ 未配置';
      }
    }
  }

  // 失去焦点时自动智能补全坚果云二级目录 /mantra-key
  syncInputUrl?.addEventListener('blur', () => {
    if (syncInputUrl.value) {
      syncInputUrl.value = normalizeWebDAVUrl(syncInputUrl.value);
    }
  });

  btnPopupSaveSync?.addEventListener('click', async () => {
    const currentCfg: WebDAVConfig = {
      serverUrl: normalizeWebDAVUrl(syncInputUrl?.value?.trim() || ''),
      username: syncInputUser?.value?.trim() || '',
      password: syncInputPass?.value?.trim() || '',
      remoteFileName: syncInputFile?.value?.trim() || 'mantra_sync.mkey',
      syncPassword: syncInputSyncPass?.value?.trim() || undefined
    };
    if (btnPopupSaveSync) {
      btnPopupSaveSync.textContent = '⏳ 保存中...';
      btnPopupSaveSync.disabled = true;
    }
    try {
      await saveWebDAVConfig(currentCfg);
      await refreshSyncView();
      if (btnPopupSaveSync) {
        btnPopupSaveSync.textContent = '✅ 已保存配置';
        btnPopupSaveSync.style.borderColor = 'var(--color-primary)';
      }
      showToast('✅ WebDAV 配置已保存！');
    } catch (e: any) {
      showToast('❌ 保存失败: ' + (e?.message || '未知错误'));
    } finally {
      setTimeout(() => {
        if (btnPopupSaveSync) {
          btnPopupSaveSync.textContent = '💾 保存配置';
          btnPopupSaveSync.style.borderColor = '';
          btnPopupSaveSync.disabled = false;
        }
      }, 1500);
    }
  });

  btnPopupTestSync?.addEventListener('click', async () => {
    const currentCfg: WebDAVConfig = {
      serverUrl: syncInputUrl?.value?.trim() || '',
      username: syncInputUser?.value?.trim() || '',
      password: syncInputPass?.value?.trim() || '',
      remoteFileName: syncInputFile?.value?.trim() || 'mantra_sync.mkey',
      syncPassword: syncInputSyncPass?.value?.trim() || undefined
    };
    if (!currentCfg.serverUrl) {
      showToast('⚠️ 请先填写 WebDAV 服务器地址');
      syncInputUrl?.focus();
      return;
    }
    if (btnPopupTestSync) {
      btnPopupTestSync.textContent = '⏳ 测试连接中...';
      btnPopupTestSync.disabled = true;
    }
    try {
      const res = await testWebDAVConnection(currentCfg);
      if (res.ok) {
        showToast(`✅ ${res.message}`);
        if (btnPopupTestSync) {
          btnPopupTestSync.textContent = '✅ 连接成功';
          btnPopupTestSync.style.borderColor = 'var(--color-primary)';
        }
      } else {
        showToast(`❌ ${res.message}`);
        if (btnPopupTestSync) {
          btnPopupTestSync.textContent = '❌ 连接失败';
        }
      }
    } catch (e: any) {
      showToast(`❌ 连接异常: ${e?.message || '未知错误'}`);
    } finally {
      setTimeout(() => {
        if (btnPopupTestSync) {
          btnPopupTestSync.textContent = '⚡ 测试连接';
          btnPopupTestSync.style.borderColor = '';
          btnPopupTestSync.disabled = false;
        }
      }, 2000);
    }
  });

  btnPopupDoSync?.addEventListener('click', async () => {
    const currentCfg: WebDAVConfig = {
      serverUrl: syncInputUrl?.value?.trim() || '',
      username: syncInputUser?.value?.trim() || '',
      password: syncInputPass?.value?.trim() || '',
      remoteFileName: syncInputFile?.value?.trim() || 'mantra_sync.mkey',
      syncPassword: syncInputSyncPass?.value?.trim() || undefined
    };

    if (!currentCfg.serverUrl) {
      showToast('⚠️ 请先填写 WebDAV 服务器地址与账号密码');
      syncInputUrl?.focus();
      return;
    }

    if (btnPopupDoSync) {
      btnPopupDoSync.textContent = '⏳ 正在进行双向加密同步...';
      btnPopupDoSync.disabled = true;
    }
    if (popupSyncStatusBadge) {
      popupSyncStatusBadge.className = 'sync-tag syncing';
      popupSyncStatusBadge.textContent = '🔄 同步中...';
    }

    try {
      const res = await performWebDAVSync(currentCfg, promptSyncPasswordModal);
      if (currentCfg.syncPassword && syncInputSyncPass) {
        syncInputSyncPass.value = currentCfg.syncPassword;
      }
      await refreshSyncView();
      await loadDomainAccounts();
      showToast(res.ok ? `🎉 ${res.message}` : `⚠️ 同步未完成: ${res.message}`, 3000);
    } catch (e: any) {
      showToast(`❌ 同步发生异常: ${e?.message || '未知错误'}`, 3000);
      await refreshSyncView();
    } finally {
      if (btnPopupDoSync) {
        btnPopupDoSync.textContent = '🔄 立即双向同步 (CRDT 合并)';
        btnPopupDoSync.disabled = false;
      }
    }
  });

  // 17. 站点别名就地修改交互 (主面板)
  currentDomainAlias?.addEventListener('click', (e) => {
    e.stopPropagation();
    triggerMainDomainInlineEdit();
  });
  currentDomainAlias?.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    triggerMainDomainInlineEdit();
  });

  // 18. 全部已存站点与账号清单全屏模态弹窗交互 (清单透明化)
  const btnOpenAllManifest = document.getElementById('btn-open-all-manifest');
  const manifestModalOverlay = document.getElementById('manifest-modal-overlay');
  const btnCloseManifestModal = document.getElementById('btn-close-manifest-modal');
  const btnManifestBackTop = document.getElementById('btn-manifest-back-top');
  const btnManifestBackBottom = document.getElementById('btn-manifest-back-bottom');
  const inputSearchManifest = document.getElementById('input-search-manifest') as HTMLInputElement | null;
  const manifestDomainsContainer = document.getElementById('manifest-domains-container');

  function closeManifestModal() {
    if (manifestModalOverlay) {
      manifestModalOverlay.style.display = 'none';
    }
  }

  async function openManifestModal() {
    if (manifestModalOverlay) {
      manifestModalOverlay.style.display = 'flex';
      if (inputSearchManifest) inputSearchManifest.value = '';
      await renderAllManifest('');
    }
  }

  async function renderAllManifest(filterText: string = '') {
    if (!manifestDomainsContainer) return;
    const query = filterText.trim().toLowerCase();
    const manifest = await getAllAccountsManifest();

    if (manifest.length === 0) {
      manifestDomainsContainer.innerHTML = `
        <div style="padding: 24px 12px; text-align: center; color: var(--color-text-muted);">
          <div style="font-size: 24px; margin-bottom: 8px;">📋</div>
          <div style="font-weight: 600; font-size: 13px; color: var(--color-text-main); margin-bottom: 4px;">暂无已存站点账号记录</div>
          <div style="font-size: 11px;">在当前站点录入新账号后，所有记录将汇总展示于此。</div>
        </div>
      `;
      return;
    }

    const filtered = manifest.filter((group) => {
      if (!query) return true;
      if (group.displayName && group.displayName.toLowerCase().includes(query)) return true;
      if (group.domain.toLowerCase().includes(query)) return true;
      if (group.unicodeDomain.toLowerCase().includes(query)) return true;
      if (group.serviceKey && group.serviceKey.toLowerCase().includes(query)) return true;
      if (group.associatedDomains.some((d) => d.toLowerCase().includes(query))) return true;
      return group.accounts.some((acc) =>
        acc.username.toLowerCase().includes(query) ||
        (acc.displayName && acc.displayName.toLowerCase().includes(query)) ||
        (acc.serviceKey && acc.serviceKey.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      manifestDomainsContainer.innerHTML = `
        <div style="padding: 24px 12px; text-align: center; color: var(--color-text-muted);">
          <div style="font-size: 20px; margin-bottom: 6px;">🔍</div>
          <div style="font-size: 12px;">未匹配到关于 "${query}" 的站点或账号</div>
        </div>
      `;
      return;
    }

    manifestDomainsContainer.innerHTML = '';

    for (const group of filtered) {
      const card = document.createElement('div');
      card.className = 'manifest-domain-card';
      card.style.cssText = `
        background: var(--color-surface);
        border: 1px solid var(--color-border);
        border-radius: 8px;
        margin-bottom: 10px;
        padding: 10px 12px;
      `;

      const isCurrentSite = group.domain.toLowerCase() === currentDomain.toLowerCase() ||
                            group.unicodeDomain.toLowerCase() === currentDomain.toLowerCase();

      const hasCustomName = Boolean(group.displayName && group.displayName !== group.unicodeDomain && group.displayName !== group.domain);
      const displayTitle = hasCustomName ? group.displayName : group.unicodeDomain;
      const subTitle = hasCustomName ? group.unicodeDomain : '';

      const serviceTag = (group.serviceKey && group.serviceKey !== group.displayName && group.serviceKey !== group.domain && group.serviceKey !== group.unicodeDomain)
        ? `<span class="alias-tag-badge" style="margin-left: 4px;">🏷️ ${group.serviceKey}</span>`
        : '';

      const assocDrawerHtml = (group.associatedDomains && group.associatedDomains.length > 0)
        ? `
          <div class="assoc-domains-drawer">
            <div class="assoc-domains-header">
              <span class="assoc-title">🔗 已关联镜像域名 (${group.associatedDomains.length})</span>
            </div>
            <div class="assoc-domains-list">
              ${group.associatedDomains.map((d) => `<span class="assoc-domain-pill" title="${d}">${d}</span>`).join('')}
            </div>
          </div>
        `
        : '';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px dashed var(--color-border);">
          <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; min-width: 0; flex: 1; margin-right: 6px;">
            <div class="manifest-domain-title-area" style="display: flex; align-items: center; gap: 4px; overflow: hidden;">
              <span style="font-size: 14px; flex-shrink: 0;">${hasCustomName ? '🏷️' : '🌐'}</span>
              <span class="manifest-domain-title-text" style="font-weight: 700; font-size: 13px; color: var(--color-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer;" title="双击或点击 ✏️ 修改备注名称" data-domain="${group.domain}" data-alias="${group.displayName || ''}">
                ${displayTitle}
              </span>
              <button type="button" class="btn-edit-alias-icon" data-domain="${group.domain}" data-alias="${group.displayName || ''}" title="点击修改备注名称">
                ✏️
              </button>
            </div>
            ${(subTitle || serviceTag) ? `
              <div style="font-size: 10px; color: var(--color-text-dim); margin-left: 20px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                ${subTitle ? `<span>🌐 ${subTitle}</span>` : ''}
                ${serviceTag}
              </div>
            ` : ''}
          </div>
          <div style="display: flex; gap: 6px; flex-shrink: 0; align-items: center;">
            ${!isCurrentSite ? `
              <button type="button" class="btn-link-here btn-xs-primary" style="padding: 3px 8px; font-size: 10.5px; cursor: pointer;" title="将当前打开的网页关联为该站点的镜像别名">
                🔗 关联当前网页
              </button>
            ` : ''}
            ${isCurrentSite ? `
              <span class="manifest-current-badge" title="当前主面板正在查看此站点">✓ 当前正在查看</span>
            ` : `
              <button type="button" class="btn-switch-domain btn-load-panel" title="将此站点的账号与规则载入主界面进行派生与管理">
                🖥️ 载入主面板
              </button>
            `}
          </div>
        </div>
        ${assocDrawerHtml}
        <div class="manifest-acc-list" style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;"></div>
      `;

      const accListContainer = card.querySelector('.manifest-acc-list') as HTMLElement;

      for (const acc of group.accounts) {
        const row = document.createElement('div');
        row.style.cssText = `
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          background: var(--color-surface-subtle);
          border-radius: 6px;
          font-size: 11px;
        `;

        row.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 2px;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 600; color: var(--color-text-main);">${acc.username}</span>
              <span style="font-size: 9.5px; color: var(--color-text-muted); background: var(--color-border); padding: 0 4px; border-radius: 3px;">v${acc.version}</span>
            </div>
            <div style="font-size: 9.5px; color: var(--color-text-muted);">${acc.rulePreset || 'standard-16'}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-manifest-autofill btn-autofill-sm" style="padding: 3px 7px; font-size: 10px; cursor: pointer;">
              ⚡ 填入网页
            </button>
            <button type="button" class="btn-manifest-copy btn-copy-pwd" style="padding: 3px 7px; font-size: 10px; cursor: pointer;">
              📋 复制
            </button>
          </div>
        `;

        // 填入网页
        row.querySelector('.btn-manifest-autofill')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!activeMantra) {
            currentDomain = group.domain;
            await refreshCurrentDomainDisplay();
            await loadDomainAccounts();
            applySelectedAccount(acc);
            closeManifestModal();
            inputMasterMantra.focus();
            showToast('请在此输入记忆口令，输入即刻派生填入！');
            return;
          }
          const derivationBase = acc.serviceKey || group.domain;
          const pwd = await deriveSitePassword(activeMantra, derivationBase, acc.username, acc.version, acc.rulePreset);
          chrome.runtime.sendMessage({
            action: 'AUTOFILL_ACTIVE_TAB',
            payload: { username: acc.username, password: pwd },
          }, () => {
            const _err = chrome.runtime.lastError;
            closeManifestModal();
            showToast(`已向网页填入 [${acc.username}] 与强密码`);
          });
        });

        // 复制密码
        row.querySelector('.btn-manifest-copy')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!activeMantra) {
            closeManifestModal();
            inputMasterMantra.focus();
            showToast('请先输入记忆口令以实时生成强密码');
            return;
          }
          const derivationBase = acc.serviceKey || group.domain;
          const pwd = await deriveSitePassword(activeMantra, derivationBase, acc.username, acc.version, acc.rulePreset);
          await copyToClipboard(pwd, acc.username);
        });

        accListContainer.appendChild(row);
      }

      // 编辑此站点备注名称 (行内就地修改，点击 ✏️ 图标或双击站点名称)
      const titleArea = card.querySelector('.manifest-domain-title-area') as HTMLElement | null;
      const initialName = group.displayName || displayTitle;

      const handleInlineEdit = (e: Event) => {
        e.stopPropagation();
        if (!titleArea) return;
        startInlineAliasEdit(
          titleArea,
          group.domain,
          initialName,
          async () => {
            if (group.domain === currentDomain) {
              await refreshCurrentDomainDisplay();
            }
            await renderAllManifest(inputSearchManifest?.value || '');
          },
          () => {
            renderAllManifest(inputSearchManifest?.value || '');
          }
        );
      };

      card.querySelectorAll('.btn-edit-alias-icon').forEach((btn) => {
        btn.addEventListener('click', handleInlineEdit);
      });

      card.querySelectorAll('.manifest-domain-title-text').forEach((titleEl) => {
        titleEl.addEventListener('dblclick', handleInlineEdit);
      });

      // 载入主面板
      card.querySelector('.btn-switch-domain')?.addEventListener('click', async () => {
        currentDomain = group.domain;
        await refreshCurrentDomainDisplay();
        loadDomainAccounts();
        updateNewPwdPreview();
        closeManifestModal();
        showToast(`已将 [${displayTitle}] 载入主面板`);
      });

      // 关联当前网页
      card.querySelector('.btn-link-here')?.addEventListener('click', async () => {
        const ok = await linkDomainToExisting(currentDomain, group.domain);
        if (ok) {
          await loadDomainAccounts();
          closeManifestModal();
          showToast(`已成功将当前站点 [${toUnicodeDomain(currentDomain)}] 关联至 [${displayTitle}]！`);
        } else {
          showToast('关联失败');
        }
      });

      manifestDomainsContainer.appendChild(card);
    }
  }

  btnOpenAllManifest?.addEventListener('click', openManifestModal);
  btnCloseManifestModal?.addEventListener('click', closeManifestModal);
  btnManifestBackTop?.addEventListener('click', closeManifestModal);
  btnManifestBackBottom?.addEventListener('click', closeManifestModal);

  manifestModalOverlay?.addEventListener('click', (e) => {
    if (e.target === manifestModalOverlay) {
      closeManifestModal();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (manifestModalOverlay && manifestModalOverlay.style.display !== 'none') {
        closeManifestModal();
      }
    }
  });

  inputSearchManifest?.addEventListener('input', () => {
    renderAllManifest(inputSearchManifest.value);
  });
});
