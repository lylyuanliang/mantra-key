/**
 * 密诀 (MantraKey) - PC 桌面全局 HUD (Alt+K) 交互控制核心脚本
 * 遵循 Obsidian Cipher 交互设计规范与 Screen 02 状态流转
 */

(function () {
  'use strict';

  // DOM 节点引用
  const hudOverlay = document.getElementById('hudOverlay');
  const hudPanel = document.getElementById('hudPanel');
  const mantraInput = document.getElementById('mantraInput');
  const btnToggleMantraVis = document.getElementById('btnToggleMantraVis');
  const visIcon = document.getElementById('visIcon');
  const canaryIndicator = document.getElementById('canaryIndicator');
  const canaryDot = document.getElementById('canaryDot');
  const canaryText = document.getElementById('canaryText');
  const accountCards = document.querySelectorAll('.credential-card');
  const btnInject = document.getElementById('btnInject');
  const btnCopyOnly = document.getElementById('btnCopyOnly');
  const sessionCountdown = document.getElementById('sessionCountdown');
  const sessionDot = document.getElementById('sessionDot');
  const btnLockNow = document.getElementById('btnLockNow');
  const unknownProcessModal = document.getElementById('unknownProcessModal');
  const btnToggleUnknownModal = document.getElementById('btnToggleUnknownModal');
  const btnCloseUnknownModal = document.getElementById('btnCloseUnknownModal');
  const btnBindAndDerive = document.getElementById('btnBindAndDerive');
  const btnIgnoreProcess = document.getElementById('btnIgnoreProcess');
  const domainSearchInput = document.getElementById('domainSearchInput');
  const domainAutocomplete = document.getElementById('domainAutocomplete');
  const presetCards = document.querySelectorAll('.preset-card');
  const hudToast = document.getElementById('hudToast');
  const toastMsg = document.getElementById('toastMsg');
  const toastIcon = document.getElementById('toastIcon');
  const hostAppWindow = document.getElementById('hostAppWindow');
  const hostPasswordTarget = document.getElementById('hostPasswordTarget');
  const injectedDisplay = document.getElementById('injectedDisplay');

  // 会话状态管理 (默认 15 分钟 = 900 秒)
  let sessionSecondsRemaining = 900;
  let isSessionLocked = false;
  let sessionTimerId = null;

  // 金丝雀基准口令（模拟预期口令，用于防手抖防污染拦截）
  const CANARY_BASELINE = 'MantraKey#Secret2026';
  let canaryDebounceTimer = null;

  /**
   * 启动 15 分钟会话倒计时
   */
  function startSessionTimer() {
    if (sessionTimerId) clearInterval(sessionTimerId);
    sessionTimerId = setInterval(() => {
      if (sessionSecondsRemaining > 0 && !isSessionLocked) {
        sessionSecondsRemaining--;
        updateSessionDisplay();
      } else if (!isSessionLocked) {
        // 会话超时自动注销锁定
        lockSession();
      }
    }, 1000);
  }

  /**
   * 更新会话时间胶囊文本
   */
  function updateSessionDisplay() {
    const mins = Math.floor(sessionSecondsRemaining / 60);
    const secs = sessionSecondsRemaining % 60;
    const str = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    if (sessionCountdown) {
      sessionCountdown.textContent = str;
    }
  }

  /**
   * 刷新活跃会话（延长 15 分钟）
   */
  function refreshSession() {
    if (!isSessionLocked) {
      sessionSecondsRemaining = 900;
      updateSessionDisplay();
    }
  }

  /**
   * 显式注销锁定
   */
  function lockSession() {
    isSessionLocked = true;
    sessionSecondsRemaining = 0;
    updateSessionDisplay();
    if (sessionDot) {
      sessionDot.className = 'status-dot locked';
    }
    showToast('会话已锁定，内存密钥物理清零', 'info', '🔒');
  }

  /**
   * 解锁会话
   */
  function unlockSession() {
    isSessionLocked = false;
    sessionSecondsRemaining = 900;
    updateSessionDisplay();
    if (sessionDot) {
      sessionDot.className = 'status-dot active';
    }
    showToast('会话已就绪，15分钟防超时保护中', 'success', '🛡️');
  }

  /**
   * 显示轻量浮层通知
   */
  let toastHideTimer = null;
  function showToast(message, type = 'info', icon = '⚡') {
    if (!hudToast) return;
    toastMsg.textContent = message;
    toastIcon.textContent = icon;
    hudToast.className = `hud-toast show ${type}`;

    if (toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => {
      hudToast.className = 'hud-toast';
    }, 2800);
  }

  /**
   * 金丝雀实时比对验证
   */
  function validateCanary(inputVal) {
    if (!canaryIndicator || !canaryText) return;

    if (inputVal === CANARY_BASELINE) {
      // 100% 匹配翡翠绿
      canaryIndicator.className = 'canary-indicator';
      canaryText.textContent = '金丝雀防手抖: 0 误差验证通过';
      mantraInput.classList.remove('shake');
    } else if (inputVal.length > 0 && CANARY_BASELINE.startsWith(inputVal)) {
      // 部分输入中，预警金呼吸
      canaryIndicator.className = 'canary-indicator warning';
      canaryText.textContent = '金丝雀比对中 (键入中...)';
      mantraInput.classList.remove('shake');
    } else if (inputVal.length === 0) {
      // 空口令
      canaryIndicator.className = 'canary-indicator warning';
      canaryText.textContent = '等待主心诀口令输入';
      mantraInput.classList.remove('shake');
    } else {
      // 拦截错码（猩红朱红防污染报警）
      canaryIndicator.className = 'canary-indicator error';
      canaryText.textContent = '心诀不一致: 已拦截计算防污染!';
      mantraInput.classList.add('shake');
      setTimeout(() => {
        mantraInput.classList.remove('shake');
      }, 350);
    }
  }

  /**
   * 触发 SendInput 模拟键入并隐退 HUD
   */
  function executeSendInputInjection() {
    const selected = document.querySelector('.credential-card.selected');
    const accountName = selected ? selected.getAttribute('data-account') : 'steam_gamer_pro';
    const mantra = mantraInput ? mantraInput.value : '';

    if (!mantra || mantra.trim() === '' || mantra !== CANARY_BASELINE) {
      showToast('主口令为空或与金丝雀不符，已拦截注入防手抖污染', 'error', '⚠️');
      validateCanary(mantra);
      return;
    }

    refreshSession();
    showToast(`正在向 steam.exe 模拟打入 ${accountName} 密码...`, 'success', '⚡');

    // 视觉反馈：背景 Steam 密码框高亮并打入
    if (hostPasswordTarget && injectedDisplay) {
      hostPasswordTarget.style.borderColor = 'var(--cipher-cyan)';
      hostPasswordTarget.style.boxShadow = '0 0 16px rgba(0, 240, 255, 0.4)';
      injectedDisplay.textContent = '••••••••••••••••';
    }

    // 播放注入完成动效并淡出 HUD
    setTimeout(() => {
      hudOverlay.classList.add('hidden');
      if (hostAppWindow) {
        hostAppWindow.style.opacity = '1';
        hostAppWindow.style.filter = 'none';
      }
      showToast('SendInput 注入完毕，内存残留已物理 Zeroize', 'success', '✓');
    }, 450);
  }

  /**
   * 仅复制密码并启动 30 秒剪贴板自毁
   */
  function executeCopyOnly() {
    refreshSession();
    showToast('密码已写入剪贴板 (带 ExcludeFromMonitor 隐私属性)', 'info', '📋');

    // 模拟 30 秒自毁倒计时
    setTimeout(() => {
      showToast('30 秒已到：剪贴板已物理擦除清空', 'info', '🧹');
    }, 4000); // 演示版以 4 秒展示清空反馈
  }

  /**
   * 绑定事件监听器
   */
  function initEventListeners() {
    // 全局热键监听 [Alt + K] 与 [Esc]
    document.addEventListener('keydown', (e) => {
      // [Alt + K] 呼出 / 隐退 HUD
      if (e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        hudOverlay.classList.toggle('hidden');
        if (!hudOverlay.classList.contains('hidden')) {
          if (mantraInput) mantraInput.focus();
          if (hostAppWindow) {
            hostAppWindow.style.opacity = '0.35';
            hostAppWindow.style.filter = 'blur(1.5px)';
          }
        }
      }

      // [Esc] 隐退 HUD
      if (e.key === 'Escape') {
        if (!unknownProcessModal.classList.contains('hidden')) {
          unknownProcessModal.classList.add('hidden');
        } else if (!hudOverlay.classList.contains('hidden')) {
          hudOverlay.classList.add('hidden');
          if (hostAppWindow) {
            hostAppWindow.style.opacity = '1';
            hostAppWindow.style.filter = 'none';
          }
        }
      }

      // [Enter] 快捷派生并键入 (当 HUD 打开且焦点不在某些特殊按钮上)
      if (e.key === 'Enter' && !hudOverlay.classList.contains('hidden')) {
        if (!unknownProcessModal.classList.contains('hidden')) {
          e.preventDefault();
          if (btnBindAndDerive) btnBindAndDerive.click();
          return;
        }
        if (document.activeElement !== btnCopyOnly && document.activeElement !== btnIgnoreProcess) {
          e.preventDefault();
          executeSendInputInjection();
        }
      }

      // [Alt + C] 仅复制密码
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        executeCopyOnly();
      }

      // [1] / [2] 快速选择账号
      if (!hudOverlay.classList.contains('hidden') && document.activeElement !== mantraInput) {
        if (e.key === '1' && accountCards[0]) {
          selectAccountCard(accountCards[0]);
        } else if (e.key === '2' && accountCards[1]) {
          selectAccountCard(accountCards[1]);
        }
      }
    });

    // 主口令实时输入监听 (带 120ms 防抖)
    if (mantraInput) {
      mantraInput.addEventListener('input', (e) => {
        clearTimeout(canaryDebounceTimer);
        canaryDebounceTimer = setTimeout(() => {
          validateCanary(e.target.value.trim());
        }, 120);
      });
    }

    // 明密文切换
    if (btnToggleMantraVis && mantraInput) {
      btnToggleMantraVis.addEventListener('click', () => {
        if (mantraInput.type === 'password') {
          mantraInput.type = 'text';
          visIcon.textContent = '🔒';
        } else {
          mantraInput.type = 'password';
          visIcon.textContent = '👁️';
        }
      });
    }

    // 账号卡片点击切换
    function selectAccountCard(card) {
      accountCards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      const account = card.getAttribute('data-account');
      showToast(`已切换至账号: ${account}`, 'info', '👤');
    }

    accountCards.forEach((card) => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.version-stepper') && !e.target.closest('.btn-copy-mini')) {
          selectAccountCard(card);
        }
      });
    });

    // 版本步进器按钮处理
    document.querySelectorAll('.btn-ver-up').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const display = btn.parentElement.querySelector('.ver-display');
        let currentVer = parseInt(display.textContent.replace('v', ''), 10) || 1;
        currentVer++;
        display.textContent = `v${currentVer}`;
        showToast(`密码版本已递增至 v${currentVer} (无需存库现场派生)`, 'success', '⚡');
      });
    });

    document.querySelectorAll('.btn-ver-down').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const display = btn.parentElement.querySelector('.ver-display');
        let currentVer = parseInt(display.textContent.replace('v', ''), 10) || 1;
        if (currentVer > 1) {
          currentVer--;
          display.textContent = `v${currentVer}`;
          showToast(`密码版本回退至 v${currentVer}`, 'info', '↩️');
        }
      });
    });

    // 卡片内独立复制按钮
    document.querySelectorAll('.btn-copy-card').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        executeCopyOnly();
      });
    });

    // 主按钮点击
    if (btnInject) {
      btnInject.addEventListener('click', executeSendInputInjection);
    }

    if (btnCopyOnly) {
      btnCopyOnly.addEventListener('click', executeCopyOnly);
    }

    // 锁屏按钮
    if (btnLockNow) {
      btnLockNow.addEventListener('click', () => {
        if (isSessionLocked) {
          unlockSession();
        } else {
          lockSession();
        }
      });
    }

    // 未知进程拦截弹窗控制
    if (btnToggleUnknownModal) {
      btnToggleUnknownModal.addEventListener('click', () => {
        unknownProcessModal.classList.toggle('hidden');
      });
    }

    if (btnCloseUnknownModal) {
      btnCloseUnknownModal.addEventListener('click', () => {
        unknownProcessModal.classList.add('hidden');
      });
    }

    if (btnIgnoreProcess) {
      btnIgnoreProcess.addEventListener('click', () => {
        unknownProcessModal.classList.add('hidden');
        showToast('已忽略 discord.exe 进程', 'info', '✕');
      });
    }

    if (btnBindAndDerive) {
      btnBindAndDerive.addEventListener('click', () => {
        const domain = domainSearchInput ? domainSearchInput.value : 'discord.com';
        unknownProcessModal.classList.add('hidden');
        showToast(`discord.exe 已成功绑定至 ${domain} 并派生完成`, 'success', '🔗');
      });
    }

    // 规则预设单选
    presetCards.forEach((card) => {
      card.addEventListener('click', () => {
        presetCards.forEach((c) => {
          c.classList.remove('active');
          const radio = c.querySelector('.preset-card-title span:last-child');
          if (radio) {
            radio.textContent = '○';
            radio.style.color = 'var(--text-muted)';
          }
        });
        card.classList.add('active');
        const activeRadio = card.querySelector('.preset-card-title span:last-child');
        if (activeRadio) {
          activeRadio.textContent = '●';
          activeRadio.style.color = 'var(--cipher-cyan)';
        }
      });
    });

    // 域名搜索实时联动
    if (domainSearchInput && domainAutocomplete) {
      domainSearchInput.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase();
        if (val.includes('discord')) {
          domainAutocomplete.style.display = 'block';
        } else if (val.trim() === '') {
          domainAutocomplete.style.display = 'none';
        } else {
          domainAutocomplete.style.display = 'block';
        }
      });
    }

    // -----------------------------------------------------------------------
    // WebDAV 端到端加密多端同步事件绑定
    // -----------------------------------------------------------------------
    const btnOpenSyncModal = document.getElementById('btnOpenSyncModal');
    const webdavSyncModal = document.getElementById('webdavSyncModal');
    const btnCloseSyncModal = document.getElementById('btnCloseSyncModal');
    const btnHudSaveSync = document.getElementById('btnHudSaveSync');
    const btnHudTestSync = document.getElementById('btnHudTestSync');
    const btnHudDoSync = document.getElementById('btnHudDoSync');

    btnOpenSyncModal?.addEventListener('click', () => {
      webdavSyncModal?.classList.remove('hidden');
      refreshDesktopSyncView();
    });

    btnCloseSyncModal?.addEventListener('click', () => {
      webdavSyncModal?.classList.add('hidden');
    });

    btnHudSaveSync?.addEventListener('click', () => {
      const cfg = {
        serverUrl: hudWebdavUrl ? hudWebdavUrl.value.trim() : '',
        username: hudWebdavUser ? hudWebdavUser.value.trim() : '',
        password: hudWebdavPass ? hudWebdavPass.value.trim() : '',
        remoteFileName: hudWebdavFile ? hudWebdavFile.value.trim() : 'mantra_sync.mkey',
        syncPassword: hudWebdavSyncPass ? hudWebdavSyncPass.value.trim() : ''
      };
      saveDesktopWebDAVConfig(cfg);
      refreshDesktopSyncView();
      showToast('WebDAV 配置已保存！', 'success', '💾');
    });

    btnHudTestSync?.addEventListener('click', async () => {
      const cfg = {
        serverUrl: hudWebdavUrl ? hudWebdavUrl.value.trim() : '',
        username: hudWebdavUser ? hudWebdavUser.value.trim() : '',
        password: hudWebdavPass ? hudWebdavPass.value.trim() : '',
        remoteFileName: hudWebdavFile ? hudWebdavFile.value.trim() : 'mantra_sync.mkey',
        syncPassword: hudWebdavSyncPass ? hudWebdavSyncPass.value.trim() : ''
      };
      if (btnHudTestSync) btnHudTestSync.textContent = '⏳ 测试中...';
      try {
        let url = cfg.serverUrl.replace(/\/+$/, '');
        if (!url) {
          alert('请先输入 WebDAV 服务器根地址');
          return;
        }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        const auth = 'Basic ' + btoa(`${cfg.username}:${cfg.password}`);

        const res = await fetch(url + '/', {
          method: 'GET',
          headers: { 'Authorization': auth },
          signal: AbortSignal.timeout(6000)
        });

        if (res.status === 401 || res.status === 403) {
          alert('❌ 认证失败: 用户名或应用密码错误');
        } else if (res.ok || res.status === 207) {
          alert(`✅ 连通性测试通过 (HTTP ${res.status})`);
        } else {
          alert(`⚠️ 服务器返回: HTTP ${res.status}`);
        }
      } catch (err) {
        alert('❌ 连接失败: ' + (err.message || '网络无法访问'));
      } finally {
        if (btnHudTestSync) btnHudTestSync.textContent = '⚡ 测试连接';
      }
    });

    btnHudDoSync?.addEventListener('click', async () => {
      const cfg = {
        serverUrl: hudWebdavUrl ? hudWebdavUrl.value.trim() : '',
        username: hudWebdavUser ? hudWebdavUser.value.trim() : '',
        password: hudWebdavPass ? hudWebdavPass.value.trim() : '',
        remoteFileName: hudWebdavFile ? hudWebdavFile.value.trim() : 'mantra_sync.mkey',
        syncPassword: hudWebdavSyncPass ? hudWebdavSyncPass.value.trim() : ''
      };

      if (!cfg.serverUrl) {
        alert('请先填写 WebDAV 服务器地址与账号密码');
        return;
      }

      if (btnHudDoSync) btnHudDoSync.textContent = '⏳ 正在双向同步...';
      if (hudSyncStatusBadge) {
        hudSyncStatusBadge.textContent = '🔄 同步中...';
        hudSyncStatusBadge.style.color = '#00f0ff';
      }

      try {
        let base = cfg.serverUrl.replace(/\/+$/, '');
        if (!/^https?:\/\//i.test(base)) base = 'https://' + base;
        const remoteUrl = `${base}/${cfg.remoteFileName || 'mantra_sync.mkey'}`;
        const auth = 'Basic ' + btoa(`${cfg.username}:${cfg.password}`);

        const localManifest = getDesktopManifest();
        let remoteManifest = null;
        let remoteIsEncrypted = false;
        let activeSyncPassword = cfg.syncPassword;

        try {
          const getRes = await fetch(remoteUrl, {
            method: 'GET',
            headers: { 'Authorization': auth },
            signal: AbortSignal.timeout(8000)
          });
          if (getRes.ok) {
            const buf = await getRes.arrayBuffer();
            if (buf.byteLength > 0) {
              try {
                const unpackRes = await unpackDesktopEnvelope(new Uint8Array(buf), activeSyncPassword);
                remoteManifest = unpackRes.manifest;
                remoteIsEncrypted = unpackRes.isEncrypted;
              } catch (unpackErr) {
                if (unpackErr.code === 'NEED_SYNC_PASSWORD') {
                  const inputPass = prompt('检测到云端文件已启用端到端加密，请输入同步加密密码：');
                  if (!inputPass || !inputPass.trim()) {
                    throw new Error('同步已取消：云端数据已加密，需要同步密码方可合并');
                  }
                  activeSyncPassword = inputPass.trim();
                  cfg.syncPassword = activeSyncPassword;
                  saveDesktopWebDAVConfig(cfg);
                  if (hudWebdavSyncPass) hudWebdavSyncPass.value = activeSyncPassword;

                  const retryRes = await unpackDesktopEnvelope(new Uint8Array(buf), activeSyncPassword);
                  remoteManifest = retryRes.manifest;
                  remoteIsEncrypted = retryRes.isEncrypted;
                } else {
                  throw unpackErr;
                }
              }
            }
          }
        } catch (e) {
          if (e.code === 'NEED_SYNC_PASSWORD' || e.code === 'PASSWORD_MISMATCH' || e.message?.includes('密码')) {
            throw e;
          }
          console.warn('[HUD Sync] 获取远程文件异常:', e);
        }

        let finalManifest = localManifest;
        if (remoteManifest) {
          finalManifest = mergeDesktopManifests(localManifest, remoteManifest);
        }
        finalManifest.updatedAt = Date.now();
        saveDesktopManifest(finalManifest);

        const newEnvelope = await packDesktopEnvelope(finalManifest, activeSyncPassword);
        const putRes = await fetch(remoteUrl, {
          method: 'PUT',
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/octet-stream'
          },
          body: newEnvelope,
          signal: AbortSignal.timeout(10000)
        });

        if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
          throw new Error(`回写 WebDAV 异常 (HTTP ${putRes.status})`);
        }

        const count = Object.keys(finalManifest.domains).length;
        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const upgraded = !remoteIsEncrypted && !!activeSyncPassword;
        const successMsg = upgraded
          ? `同步成功并已升格为 AES-256-GCM 加密！已合并 ${count} 个站点规则`
          : `WebDAV 同步成功！已合并 ${count} 个站点规则`;

        saveDesktopSyncInfo({
          status: 'success',
          lastSyncTime: timeStr,
          message: successMsg,
          syncedDomainsCount: count
        });

        refreshDesktopSyncView();
        showToast(successMsg, 'success', '🌐');
      } catch (err) {
        saveDesktopSyncInfo({
          status: 'error',
          lastSyncTime: '',
          message: err.message || '未知错误',
          syncedDomainsCount: 0
        });
        refreshDesktopSyncView();
        alert('❌ 同步异常: ' + (err.message || '网络连接中断'));
      } finally {
        if (btnHudDoSync) btnHudDoSync.textContent = '🔄 立即双向同步 (CRDT 自愈合并)';
      }
    });
  }

  // =========================================================================
  // WebDAV 桌面端状态与加解密方法定义
  // =========================================================================
  const hudSyncStatusBadge = document.getElementById('hudSyncStatusBadge');
  const hudSyncTimeText = document.getElementById('hudSyncTimeText');
  const hudWebdavUrl = document.getElementById('hudWebdavUrl');
  const hudWebdavUser = document.getElementById('hudWebdavUser');
  const hudWebdavPass = document.getElementById('hudWebdavPass');
  const hudWebdavFile = document.getElementById('hudWebdavFile');
  const hudWebdavSyncPass = document.getElementById('hudWebdavSyncPass');

  function getDesktopWebDAVConfig() {
    try {
      const raw = localStorage.getItem('mk_webdav_config');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { serverUrl: '', username: '', password: '', remoteFileName: 'mantra_sync.mkey', syncPassword: '' };
  }

  function saveDesktopWebDAVConfig(cfg) {
    try {
      localStorage.setItem('mk_webdav_config', JSON.stringify(cfg));
    } catch {}
  }

  function getDesktopSyncInfo() {
    try {
      const raw = localStorage.getItem('mk_sync_status_info');
      if (raw) return JSON.parse(raw);
    } catch {}
    return { status: 'idle', lastSyncTime: '', message: '尚未同步', syncedDomainsCount: 0 };
  }

  function saveDesktopSyncInfo(info) {
    try {
      localStorage.setItem('mk_sync_status_info', JSON.stringify(info));
    } catch {}
  }

  function getDesktopManifest() {
    try {
      const raw = localStorage.getItem('mk_local_manifest');
      if (raw) return JSON.parse(raw);
    } catch {}
    return {
      schemaVersion: 1,
      canaryHash: '',
      domains: {
        'steampowered.com': {
          canonicalDomain: 'steampowered.com',
          displayName: 'Steam',
          rulePreset: 'standard_16',
          accounts: {
            'steam_gamer_pro': { username: 'steam_gamer_pro', version: 1, updatedAt: Date.now(), isDeleted: false }
          },
          updatedAt: Date.now()
        }
      },
      updatedAt: Date.now()
    };
  }

  function saveDesktopManifest(manifest) {
    try {
      localStorage.setItem('mk_local_manifest', JSON.stringify(manifest));
    } catch {}
  }

  function refreshDesktopSyncView() {
    const cfg = getDesktopWebDAVConfig();
    const info = getDesktopSyncInfo();

    if (hudWebdavUrl && !hudWebdavUrl.value) hudWebdavUrl.value = cfg.serverUrl || '';
    if (hudWebdavUser && !hudWebdavUser.value) hudWebdavUser.value = cfg.username || '';
    if (hudWebdavPass && !hudWebdavPass.value) hudWebdavPass.value = cfg.password || '';
    if (hudWebdavFile && !hudWebdavFile.value) hudWebdavFile.value = cfg.remoteFileName || 'mantra_sync.mkey';
    if (hudWebdavSyncPass && !hudWebdavSyncPass.value) hudWebdavSyncPass.value = cfg.syncPassword || '';

    if (hudSyncTimeText) {
      hudSyncTimeText.textContent = info.lastSyncTime ? `上次同步: ${info.lastSyncTime}` : '上次同步: 尚未同步';
    }

    if (hudSyncStatusBadge) {
      if (info.status === 'success') {
        hudSyncStatusBadge.textContent = '🟢 已同步';
        hudSyncStatusBadge.style.color = '#10b981';
      } else if (info.status === 'syncing') {
        hudSyncStatusBadge.textContent = '🔄 同步中...';
        hudSyncStatusBadge.style.color = '#00f0ff';
      } else if (info.status === 'error') {
        hudSyncStatusBadge.textContent = '🔴 失败';
        hudSyncStatusBadge.style.color = '#ef4444';
      } else {
        hudSyncStatusBadge.textContent = cfg.serverUrl ? '⚪ 待同步' : '⚪ 未配置';
        hudSyncStatusBadge.style.color = 'var(--text-muted)';
      }
    }
  }

  async function packDesktopEnvelope(manifest, syncPassword) {
    const enc = new TextEncoder();
    const manifestBytes = enc.encode(JSON.stringify(manifest));

    if (!syncPassword || !syncPassword.trim()) {
      const envelope = new Uint8Array(3 + manifestBytes.length);
      envelope[0] = 0x4D;
      envelope[1] = 0x4B;
      envelope[2] = 0x00;
      envelope.set(manifestBytes, 3);
      return envelope;
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(syncPassword.trim()),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, manifestBytes);
    const cipherBytes = new Uint8Array(cipherBuffer);

    const envelope = new Uint8Array(3 + 16 + 12 + cipherBytes.length);
    envelope[0] = 0x4D;
    envelope[1] = 0x4B;
    envelope[2] = 0x01;
    envelope.set(salt, 3);
    envelope.set(iv, 3 + 16);
    envelope.set(cipherBytes, 3 + 16 + 12);
    return envelope;
  }

  async function unpackDesktopEnvelope(envelope, syncPassword) {
    if (!envelope || envelope.length === 0) throw new Error('同步数据为空');
    const dec = new TextDecoder();

    // 1. raw JSON
    if (envelope[0] === 0x7B || envelope[0] === 0x5B) {
      return { manifest: JSON.parse(dec.decode(envelope)), isEncrypted: false };
    }

    // 2. check MK
    if (envelope.length < 3 || envelope[0] !== 0x4D || envelope[1] !== 0x4B) {
      throw new Error('无效的同步信封格式魔数');
    }

    const flag = envelope[2];
    if (flag === 0x00) {
      return { manifest: JSON.parse(dec.decode(envelope.slice(3))), isEncrypted: false };
    }

    if (flag === 0x01) {
      if (!syncPassword || !syncPassword.trim()) {
        const err = new Error('检测到云端文件已启用端到端加密，请输入同步加密密码');
        err.code = 'NEED_SYNC_PASSWORD';
        throw err;
      }
      if (envelope.length < 3 + 16 + 12 + 16) throw new Error('加密信封数据损坏');

      const salt = envelope.slice(3, 3 + 16);
      const iv = envelope.slice(3 + 16, 3 + 16 + 12);
      const cipherBytes = envelope.slice(3 + 16 + 12);

      const enc = new TextEncoder();
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(syncPassword.trim()),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );

      try {
        const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipherBytes);
        return { manifest: JSON.parse(dec.decode(plainBuffer)), isEncrypted: true };
      } catch (e) {
        const err = new Error('同步加密密码不匹配，无法解密');
        err.code = 'PASSWORD_MISMATCH';
        throw err;
      }
    }

    throw new Error('不支持的同步信封版本: 0x' + flag.toString(16));
  }

  function mergeDesktopManifests(local, remote) {
    const merged = {
      schemaVersion: Math.max(local.schemaVersion || 1, remote.schemaVersion || 1),
      canaryHash: (remote.updatedAt > local.updatedAt ? remote.canaryHash : local.canaryHash) || local.canaryHash || remote.canaryHash,
      domains: { ...local.domains },
      updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now())
    };

    for (const [dKey, remoteDomain] of Object.entries(remote.domains || {})) {
      const localDomain = merged.domains[dKey];
      if (!localDomain) {
        merged.domains[dKey] = remoteDomain;
      } else {
        const newer = remoteDomain.updatedAt > localDomain.updatedAt ? remoteDomain : localDomain;
        const combinedAccounts = { ...localDomain.accounts, ...remoteDomain.accounts };
        merged.domains[dKey] = {
          canonicalDomain: newer.canonicalDomain,
          displayName: newer.displayName || localDomain.displayName,
          rulePreset: newer.rulePreset || localDomain.rulePreset,
          accounts: combinedAccounts,
          updatedAt: Math.max(localDomain.updatedAt, remoteDomain.updatedAt)
        };
      }
    }
    return merged;
  }
  }

  // 页面加载启动初始化
  document.addEventListener('DOMContentLoaded', () => {
    startSessionTimer();
    initEventListeners();
    validateCanary(mantraInput ? mantraInput.value : '');
    showToast('密诀桌面守护宿主就绪 · [Alt+K] 呼出', 'success', '🚀');
  });
})();
