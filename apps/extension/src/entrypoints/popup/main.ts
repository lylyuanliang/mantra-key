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
} from '../../utils/storage';
import {
  getWebDAVConfig,
  saveWebDAVConfig,
  getSyncStatus,
  testWebDAVConnection,
  performWebDAVSync,
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

  // 版本 Popover 气泡组件
  const versionInfoBtn = document.getElementById('version-info-btn') as HTMLButtonElement | null;
  const versionPopoverCard = document.getElementById('version-popover-card') as HTMLElement | null;
  const popoverCloseBtn = document.getElementById('popover-close-btn') as HTMLButtonElement | null;

  const btnActionAutofill = document.getElementById('btn-action-autofill') as HTMLButtonElement;
  const btnActionSave = document.getElementById('btn-action-save') as HTMLButtonElement;
  const btnActionCopy = document.getElementById('btn-action-copy') as HTMLButtonElement;

  const linkClearAllDomain = document.getElementById('link-clear-all-domain') as HTMLElement;
  const copyToast = document.getElementById('copy-toast') as HTMLElement;

  // 内部状态
  let currentDomain = 'github.com';
  let activeMantra: string | null = null;
  let activeCanary: string | null = null;
  let ttlRemaining = 0;
  let isUnlocked = false;
  let isMantraPeek = false;
  let isPreviewPeek = false;
  let currentDerivedPreview = '';
  let ttlTimer: number | null = null;

  /**
   * 弹出 Toast 提示
   */
  function showToast(text: string) {
    if (copyToast) {
      copyToast.textContent = text;
      copyToast.style.display = 'block';
      setTimeout(() => {
        copyToast.style.display = 'none';
      }, 2500);
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
   * 刷新界面主口令会话视图状态
   */
  function updateSessionView() {
    if (isUnlocked && activeMantra) {
      document.body.classList.add('is-unlocked');
      viewLocked.style.display = 'none';
      viewUnlocked.style.display = 'flex';
      sessionDot.classList.remove('locked');
      if (sessionStatusPill) {
        sessionStatusPill.classList.remove('locked');
        sessionStatusPill.title = '主口令会话激活中（15分钟物理自毁）';
      }
      btnLockSession.style.display = 'inline-flex';
      btnLockSession.textContent = '锁定';
      btnLockSession.title = '立即锁定并擦除会话';

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
        sessionStatusPill.title = '会话已锁定，内存中无口令驻留';
      }
      sessionTtlText.textContent = '已锁定';
      btnLockSession.style.display = 'none';
      if (ttlTimer) {
        clearInterval(ttlTimer);
        ttlTimer = null;
      }
      loadDomainAccounts();
    }
  }

  /**
   * 执行锁定
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
    showToast('会话已锁定，内存已物理清零');
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

    try {
      const derived = await deriveSitePassword(activeMantra, currentDomain, username, version, rule);
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
    const accounts = await getAccountsForDomain(currentDomain);
    accCountBadge.textContent = accounts.length.toString();

    if (accounts.length === 0) {
      accountsSection.style.display = 'none';
      deriveCardTitle.textContent = '⚡ 快速派生与填充';
      return;
    }

    // 存在账号时常驻展示清单
    accountsSection.style.display = 'flex';
    deriveCardTitle.textContent = '⚡ 录入新账号';
    accountListEl.innerHTML = '';

    for (let i = 0; i < accounts.length; i++) {
      const acc = accounts[i];
      const itemEl = document.createElement('div');
      itemEl.className = 'account-item';
      itemEl.dataset.username = acc.username;

      let accountPwd = '';
      if (activeMantra) {
        accountPwd = await deriveSitePassword(
          activeMantra,
          currentDomain,
          acc.username,
          acc.version,
          acc.rulePreset
        );
      }

      itemEl.innerHTML = `
        <div class="account-item-top">
          <span class="account-username" title="${acc.username}">${acc.username}</span>
          <span class="account-tag ${acc.tag === 'Work' ? 'work' : ''}">${acc.tag || 'v' + acc.version}</span>
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
          showToast('请先输入主口令解锁会话以实时派生强密码');
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
          showToast('请先输入主口令解锁会话以实时派生强密码');
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
    const domainRes = await new Promise<{ domain?: string }>((resolve) => {
      chrome.runtime.sendMessage({ action: 'GET_CURRENT_DOMAIN' }, resolve);
    });
    if (domainRes?.domain) {
      currentDomain = domainRes.domain;
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
      showToast('请输入有效的主口令');
      inputMasterMantra.focus();
      return;
    }

    const state = await unlockSession(val, 900);
    isUnlocked = true;
    activeMantra = state.mantra;
    activeCanary = state.canary;
    ttlRemaining = state.ttlRemaining;
    updateSessionView();
    showToast(`会话已解锁！金丝雀: [${state.canary}]`);
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

    await saveAccountForDomain(currentDomain, {
      username: user,
      version,
      rulePreset,
      tag: 'Personal',
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

  // 15. WebDAV 端到端多端同步交互逻辑
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

  btnOpenSyncModal?.addEventListener('click', () => {
    if (syncModalOverlay) syncModalOverlay.style.display = 'flex';
    refreshSyncView();
  });

  btnCloseSyncModal?.addEventListener('click', () => {
    if (syncModalOverlay) syncModalOverlay.style.display = 'none';
  });

  btnPopupSaveSync?.addEventListener('click', async () => {
    const currentCfg: WebDAVConfig = {
      serverUrl: syncInputUrl?.value?.trim() || '',
      username: syncInputUser?.value?.trim() || '',
      password: syncInputPass?.value?.trim() || '',
      remoteFileName: syncInputFile?.value?.trim() || 'mantra_sync.mkey'
    };
    await saveWebDAVConfig(currentCfg);
    await refreshSyncView();
    showToast('WebDAV 配置已保存！');
  });

  btnPopupTestSync?.addEventListener('click', async () => {
    const currentCfg: WebDAVConfig = {
      serverUrl: syncInputUrl?.value?.trim() || '',
      username: syncInputUser?.value?.trim() || '',
      password: syncInputPass?.value?.trim() || '',
      remoteFileName: syncInputFile?.value?.trim() || 'mantra_sync.mkey'
    };
    if (btnPopupTestSync) btnPopupTestSync.textContent = '⏳ 测试中...';
    try {
      const res = await testWebDAVConnection(currentCfg);
      alert(res.ok ? `✅ ${res.message}` : `❌ ${res.message}`);
    } finally {
      if (btnPopupTestSync) btnPopupTestSync.textContent = '⚡ 测试连接';
    }
  });

  btnPopupDoSync?.addEventListener('click', async () => {
    const session = await getSessionState();
    if (!session.isUnlocked || !session.mantra) {
      alert('请先解锁会话输入主口令，端到端加解密需要主口令作为主密钥！');
      return;
    }

    const currentCfg: WebDAVConfig = {
      serverUrl: syncInputUrl?.value?.trim() || '',
      username: syncInputUser?.value?.trim() || '',
      password: syncInputPass?.value?.trim() || '',
      remoteFileName: syncInputFile?.value?.trim() || 'mantra_sync.mkey'
    };

    if (!currentCfg.serverUrl) {
      alert('请先填写 WebDAV 服务器地址与账号密码');
      return;
    }

    if (btnPopupDoSync) btnPopupDoSync.textContent = '⏳ 正在同步...';
    if (popupSyncStatusBadge) {
      popupSyncStatusBadge.className = 'sync-tag syncing';
      popupSyncStatusBadge.textContent = '🔄 同步中...';
    }

    try {
      const res = await performWebDAVSync(session.mantra, currentCfg);
      await refreshSyncView();
      await loadDomainAccounts();
      alert(res.ok ? `🎉 ${res.message}` : `⚠️ 同步未完成: ${res.message}`);
    } catch (e: any) {
      alert(`❌ 同步发生异常: ${e?.message || '未知错误'}`);
      await refreshSyncView();
    } finally {
      if (btnPopupDoSync) btnPopupDoSync.textContent = '🔄 立即双向同步 (CRDT 合并)';
    }
  });
});
