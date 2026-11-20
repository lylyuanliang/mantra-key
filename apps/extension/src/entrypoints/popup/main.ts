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
} from '../../utils/storage';
import {
  getWebDAVConfig,
  saveWebDAVConfig,
  getSyncStatus,
  testWebDAVConnection,
  performWebDAVSync,
  exportLocalManifest,
  importMergedManifest,
  type WebDAVConfig,
} from '../../utils/webdav';

document.addEventListener('DOMContentLoaded', async () => {
  // DOM 元素引用
  const btnToggleTheme = document.getElementById('btn-toggle-theme') as HTMLButtonElement | null;

  const viewLocked = document.getElementById('view-locked') as HTMLElement;
  const viewUnlocked = document.getElementById('view-unlocked') as HTMLElement;

  const headerCanaryChip = document.getElementById('header-canary-chip') as HTMLElement;
  const headerCanaryText = document.getElementById('header-canary-text') as HTMLElement;

  const sessionStatusPill = document.getElementById('session-status-pill') as HTMLElement;
  const sessionDot = document.getElementById('session-dot') as HTMLElement;
  const sessionTtlText = document.getElementById('session-ttl-text') as HTMLElement;
  const btnLockSession = document.getElementById('btn-lock-session') as HTMLButtonElement;

  // 锁定视图元素
  const inputMasterMantra = document.getElementById('input-master-mantra') as HTMLInputElement;
  const btnToggleMantraEye = document.getElementById('btn-toggle-mantra-eye') as HTMLButtonElement;
  const canaryPreviewHex = document.getElementById('canary-preview-hex') as HTMLElement;
  const btnUnlockSubmit = document.getElementById('btn-unlock-submit') as HTMLButtonElement;
  const codeQuickSample = document.getElementById('code-quick-sample') as HTMLElement | null;

  // 解锁视图元素
  const currentDomainText = document.getElementById('current-domain-text') as HTMLElement;
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
      viewLocked.style.display = 'none';
      viewUnlocked.style.display = 'flex';
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
      startTtlTimer();
      loadDomainAccounts();
      updateNewPwdPreview();
    } else {
      document.body.classList.remove('is-unlocked');
      viewLocked.style.display = 'flex';
      viewUnlocked.style.display = 'none';
      headerCanaryChip.style.display = 'none';
      if (linkClearAllDomain) linkClearAllDomain.style.display = 'none';
      sessionDot.classList.add('locked');
      if (sessionStatusPill) {
        sessionStatusPill.classList.add('locked');
        sessionStatusPill.title = '口令未就绪，内存零驻留';
      }
      sessionTtlText.textContent = '待输入';
      btnLockSession.style.display = 'none';
      if (ttlTimer) {
        clearInterval(ttlTimer);
        ttlTimer = null;
      }
      loadDomainAccounts();
    }
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
    showToast('口令已清空，内存已物理清零');
  }

  /**
   * 动态实时派生快速录入区的密码预览
   */
  async function updateNewPwdPreview() {
    if (!isUnlocked || !activeMantra) {
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
      const derived = await deriveSitePassword(activeMantra, derivationBase, username, version, rule);
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

  /**
   * 渲染并加载当前域名的账号列表 (清单优先 Manifest-First)
   * 即使未解锁状态下，也完整展示凭据元数据清单
   */
  async function loadDomainAccounts() {
    const accounts = await getAccountsForDomain(currentDomain, activeTabTitle);
    accCountBadge.textContent = accounts.length.toString();

    // 账号区域常驻展示，杜绝无清单界面的情况
    accountsSection.style.display = 'flex';
    deriveCardTitle.textContent = '⚡ 录入新账号';

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
        addAccountCard.scrollIntoView({ behavior: 'smooth' });
        newAccUser.focus();
      });
      accountListEl.querySelector('#btn-empty-open-manifest')?.addEventListener('click', () => {
        openManifestModal();
      });
      return;
    }

    accountListEl.innerHTML = '';

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const itemEl = document.createElement('div');
      itemEl.className = 'account-item';
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

      itemEl.querySelector('.btn-item-autofill')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!activeMantra) {
          inputMasterMantra.focus();
          showToast('请先输入记忆口令以实时生成强密码');
          return;
        }
        chrome.runtime.sendMessage({
          action: 'AUTOFILL_ACTIVE_TAB',
          payload: {
            username: acc.username,
            password: accountPwd,
          },
        }, () => {
          showToast(`已向网页填入 [${acc.username}] 与强密码`);
        });
      });

      itemEl.querySelector('.btn-item-copy')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!activeMantra) {
          inputMasterMantra.focus();
          showToast('请先输入记忆口令以实时生成强密码');
          return;
        }
        copyToClipboard(accountPwd, acc.username);
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
  }

  // ================= 初始加载与事件监听 =================

  // 1. 获取当前活动标签页真实域名并转换为友好 Unicode
  try {
    const domainRes = await new Promise<{ domain?: string; title?: string }>((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_CURRENT_DOMAIN' }, resolve);
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
  currentDomainText.textContent = toUnicodeDomain(currentDomain);
  currentDomainText.title = currentDomain;

  // 2. 检查会话状态并渲染视图
  const session = await getSessionState();
  if (session.isUnlocked && session.mantra) {
    isUnlocked = true;
    activeMantra = session.mantra;
    activeCanary = session.canary;
    ttlRemaining = session.ttlRemaining;
  }
  updateSessionView();

  // 3. 主口令输入事件：实时金丝雀哈希指纹计算
  inputMasterMantra.addEventListener('input', async () => {
    const val = inputMasterMantra.value;
    if (val) {
      const canary = await computeCanary(val);
      canaryPreviewHex.textContent = canary;
    } else {
      canaryPreviewHex.textContent = '--------';
    }
  });

  inputMasterMantra.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnUnlockSubmit.click();
    }
  });

  // 4. 明文切换按钮（密文状态显示 🙈 点击显示；明文状态显示 👁️ 点击隐藏）
  btnToggleMantraEye.addEventListener('click', () => {
    isMantraPeek = !isMantraPeek;
    inputMasterMantra.type = isMantraPeek ? 'text' : 'password';
    btnToggleMantraEye.textContent = isMantraPeek ? '👁️' : '🙈';
    btnToggleMantraEye.title = isMantraPeek ? '点击隐藏口令' : '点击显示明文';
  });

  // 5. 解锁按钮
  btnUnlockSubmit.addEventListener('click', async () => {
    const val = inputMasterMantra.value.trim();
    if (!val) {
      showToast('请输入有效的记忆口令');
      inputMasterMantra.focus();
      return;
    }

    const state = await unlockSession(val, 900);
    isUnlocked = true;
    activeMantra = state.mantra;
    activeCanary = state.canary;
    ttlRemaining = state.ttlRemaining;
    updateSessionView();
    showToast(`记忆口令已就绪！金丝雀: [${state.canary}]`);
  });

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

  btnConfirmDomain.addEventListener('click', () => {
    const custom = inputCustomDomain.value.trim().toLowerCase();
    if (custom) {
      currentDomain = custom;
      currentDomainText.textContent = toUnicodeDomain(currentDomain);
      currentDomainText.title = currentDomain;
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

  // 11. 一键填充到网页
  btnActionAutofill.addEventListener('click', async () => {
    const user = newAccUser.value.trim();
    if (!currentDerivedPreview) {
      await updateNewPwdPreview();
    }
    chrome.runtime.sendMessage({
      action: 'AUTOFILL_ACTIVE_TAB',
      payload: {
        username: user,
        password: currentDerivedPreview,
      },
    }, () => {
      showToast('⚡ 已一键填入网页！');
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

    if (!currentDerivedPreview) {
      await updateNewPwdPreview();
    }

    chrome.runtime.sendMessage({
      action: 'AUTOFILL_ACTIVE_TAB',
      payload: {
        username: user,
        password: currentDerivedPreview,
      },
    });

    loadDomainAccounts();
    showToast(`已保存账号 [${user}] 并填充到当前网页！`);
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

    if (syncInputUrl && !syncInputUrl.value) syncInputUrl.value = cfg.serverUrl || '';
    if (syncInputUser && !syncInputUser.value) syncInputUser.value = cfg.username || '';
    if (syncInputPass && !syncInputPass.value) syncInputPass.value = cfg.password || '';
    if (syncInputFile && !syncInputFile.value) syncInputFile.value = cfg.remoteFileName || 'mantra_sync.mkey';

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

  btnPopupSaveSync?.addEventListener('click', async () => {
    const currentCfg: WebDAVConfig = {
      serverUrl: syncInputUrl?.value?.trim() || '',
      username: syncInputUser?.value?.trim() || '',
      password: syncInputPass?.value?.trim() || '',
      remoteFileName: syncInputFile?.value?.trim() || 'mantra_sync.mkey'
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
      remoteFileName: syncInputFile?.value?.trim() || 'mantra_sync.mkey'
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
    const session = await getSessionState();
    if (!session.isUnlocked || !session.mantra) {
      showToast('⚠️ 请先输入记忆口令，端到端加密需要口令作为主密钥');
      return;
    }

    const currentCfg: WebDAVConfig = {
      serverUrl: syncInputUrl?.value?.trim() || '',
      username: syncInputUser?.value?.trim() || '',
      password: syncInputPass?.value?.trim() || '',
      remoteFileName: syncInputFile?.value?.trim() || 'mantra_sync.mkey'
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
      const res = await performWebDAVSync(session.mantra, currentCfg);
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

  // 17. 全部已存站点与账号清单全屏模态弹窗交互 (清单透明化)
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
      if (group.domain.toLowerCase().includes(query)) return true;
      if (group.unicodeDomain.toLowerCase().includes(query)) return true;
      if (group.serviceKey && group.serviceKey.toLowerCase().includes(query)) return true;
      return group.accounts.some((acc) =>
        acc.username.toLowerCase().includes(query) ||
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

      const serviceTag = group.serviceKey ? `<span class="alias-tag-badge" style="margin-left: 6px;">🏷️ ${group.serviceKey}</span>` : '';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px dashed var(--color-border);">
          <div style="display: flex; align-items: center; gap: 6px; overflow: hidden;">
            <span style="font-size: 14px;">🌐</span>
            <span style="font-weight: 700; font-size: 13px; color: var(--color-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${group.domain}">
              ${group.unicodeDomain}
            </span>
            ${serviceTag}
            ${isCurrentSite ? '<span style="font-size: 9.5px; background: rgba(13, 148, 136, 0.15); color: var(--color-primary); padding: 1px 5px; border-radius: 4px; font-weight: 600;">当前站点</span>' : ''}
          </div>
          <div style="display: flex; gap: 6px; flex-shrink: 0;">
            ${!isCurrentSite ? `
              <button type="button" class="btn-link-here btn-xs-primary" style="padding: 3px 8px; font-size: 10.5px; cursor: pointer;" title="将当前打开的网页关联为该站点的镜像别名">
                🔗 关联当前网页
              </button>
            ` : ''}
            <button type="button" class="btn-switch-domain btn-xs-muted" style="padding: 3px 8px; font-size: 10.5px; cursor: pointer;" title="在面板中切换管理此站点">
              切换管理
            </button>
          </div>
        </div>
        <div class="manifest-acc-list" style="display: flex; flex-direction: column; gap: 6px;"></div>
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
            closeManifestModal();
            inputMasterMantra.focus();
            showToast('请先输入记忆口令以实时生成强密码');
            return;
          }
          const derivationBase = acc.serviceKey || group.domain;
          const pwd = await deriveSitePassword(activeMantra, derivationBase, acc.username, acc.version, acc.rulePreset);
          chrome.runtime.sendMessage({
            action: 'AUTOFILL_ACTIVE_TAB',
            payload: { username: acc.username, password: pwd },
          }, () => {
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

      // 切换管理此站点
      card.querySelector('.btn-switch-domain')?.addEventListener('click', () => {
        currentDomain = group.domain;
        currentDomainText.textContent = toUnicodeDomain(currentDomain);
        currentDomainText.title = currentDomain;
        loadDomainAccounts();
        updateNewPwdPreview();
        closeManifestModal();
        showToast(`已切换至站点: ${group.unicodeDomain}`);
      });

      // 关联当前网页
      card.querySelector('.btn-link-here')?.addEventListener('click', async () => {
        const ok = await linkDomainToExisting(currentDomain, group.domain);
        if (ok) {
          await loadDomainAccounts();
          closeManifestModal();
          showToast(`已成功将当前站点 [${toUnicodeDomain(currentDomain)}] 关联至 [${group.unicodeDomain}]！`);
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
    if (e.key === 'Escape' && manifestModalOverlay && manifestModalOverlay.style.display !== 'none') {
      closeManifestModal();
    }
  });

  inputSearchManifest?.addEventListener('input', () => {
    renderAllManifest(inputSearchManifest.value);
  });
});
