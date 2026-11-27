/**
 * 密诀 (MantraKey) - PC 桌面全局 HUD (Alt+K) 交互控制核心脚本
 * 接入动态 Manifest 清单、WebCrypto 确定性派生与 WebDAV 双向加密同步
 */

(function () {
  'use strict';

  // -------------------------------------------------------------------------
  // 1. 纯端侧确定性密码派生引擎 (与扩展/Android 100% 算法对齐)
  // -------------------------------------------------------------------------
  const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
  const DIGITS = '23456789';
  const SYMBOLS = '!@#$%^&*()-_=+[]{}|;:,.<>?';
  const CHARSET_STANDARD = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;
  const CHARSET_ALPHANUMERIC = UPPERCASE + LOWERCASE + DIGITS;
  const CHARSET_PIN = '0123456789';
  const UNIVERSAL_SALT = 'mantra_key_salt_universal_2026';

  const RULE_PRESETS = {
    'standard-16': { name: '16位标准', length: 16, charset: CHARSET_STANDARD },
    'secure-20': { name: '20位高强', length: 20, charset: CHARSET_STANDARD },
    'super-32': { name: '32位极高安全', length: 32, charset: CHARSET_STANDARD },
    'alphanumeric-16': { name: '16位无符号', length: 16, charset: CHARSET_ALPHANUMERIC },
    'pin-6': { name: '6位PIN', length: 6, charset: CHARSET_PIN }
  };

  function normalizeRulePreset(raw) {
    if (!raw) return 'standard-16';
    const map = {
      standard_16: 'standard-16',
      super_32: 'super-32',
      secure_20: 'secure-20',
      alphanumeric_16: 'alphanumeric-16',
      pin_6: 'pin-6'
    };
    const key = map[raw] || raw;
    return RULE_PRESETS[key] ? key : 'standard-16';
  }

  async function computeCanary(mantra) {
    if (!mantra || !mantra.trim()) return '';
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(mantra.trim()));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 8)
      .toUpperCase();
  }

  async function deriveMasterSeed(mantra, salt = UNIVERSAL_SALT) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      enc.encode(mantra),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    return new Uint8Array(derived);
  }

  function rejectionSampling(entropy, alphabet, targetLen) {
    if (!alphabet || targetLen <= 0 || entropy.length === 0) return '';
    const alphabetLen = alphabet.length;
    const limit = Math.floor(256 / alphabetLen) * alphabetLen;
    let result = '';
    let idx = 0;

    while (result.length < targetLen && idx < entropy.length) {
      const b = entropy[idx++];
      if (b < limit) result += alphabet[b % alphabetLen];
    }
    let loopIdx = 0;
    while (result.length < targetLen) {
      const b = entropy[loopIdx % entropy.length];
      loopIdx++;
      if (b < limit) result += alphabet[b % alphabetLen];
    }
    return result;
  }

  async function deriveSitePassword(masterMantra, canonicalDomain, username = '', version = 1, preset = 'standard-16') {
    if (!masterMantra || !masterMantra.trim() || !canonicalDomain || !canonicalDomain.trim()) {
      return '';
    }
    const seed = await deriveMasterSeed(masterMantra);
    const enc = new TextEncoder();
    const hkdfKey = await crypto.subtle.importKey('raw', seed, { name: 'HKDF' }, false, ['deriveBits']);
    const infoStr = `mantra_v1:${canonicalDomain.toLowerCase().trim()}:${(username || '').trim()}:${version || 1}`;
    const okm = await crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(), info: enc.encode(infoStr) },
      hkdfKey,
      512
    );
    const rule = RULE_PRESETS[normalizeRulePreset(preset)];
    return rejectionSampling(new Uint8Array(okm), rule.charset, rule.length);
  }

  // -------------------------------------------------------------------------
  // 2. DOM 节点引用
  // -------------------------------------------------------------------------
  const hudOverlay = document.getElementById('hudOverlay');
  const mantraInput = document.getElementById('mantraInput');
  const btnToggleMantraVis = document.getElementById('btnToggleMantraVis');
  const visIcon = document.getElementById('visIcon');
  const canaryIndicator = document.getElementById('canaryIndicator');
  const canaryText = document.getElementById('canaryText');
  const accountListEl = document.getElementById('accountList');
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
  const hostWindowTitle = document.getElementById('hostWindowTitle');
  const hostAccountDisplay = document.getElementById('hostAccountDisplay');
  const hostPasswordTarget = document.getElementById('hostPasswordTarget');
  const injectedDisplay = document.getElementById('injectedDisplay');

  const hudActiveTitle = document.getElementById('hudActiveTitle');
  const hudManifestCount = document.getElementById('hudManifestCount');
  const hudActiveDomain = document.getElementById('hudActiveDomain');
  const hudActiveAliasTag = document.getElementById('hudActiveAliasTag');
  const hudSearchInput = document.getElementById('hudSearchInput');
  const btnClearHudSearch = document.getElementById('btnClearHudSearch');
  const btnToggleAddSite = document.getElementById('btnToggleAddSite');
  const hudAddDrawer = document.getElementById('hudAddDrawer');
  const addSiteDomain = document.getElementById('addSiteDomain');
  const addSiteAlias = document.getElementById('addSiteAlias');
  const addSiteUser = document.getElementById('addSiteUser');
  const addSitePreset = document.getElementById('addSitePreset');
  const btnSaveNewSite = document.getElementById('btnSaveNewSite');
  const btnCancelNewSite = document.getElementById('btnCancelNewSite');

  // -------------------------------------------------------------------------
  // 3. 会话与选择状态
  // -------------------------------------------------------------------------
  let sessionSecondsRemaining = 900;
  let isSessionLocked = false;
  let sessionTimerId = null;
  let canaryDebounceTimer = null;
  let toastHideTimer = null;
  let clipboardWipeTimer = null;

  let searchKeyword = '';
  let selectedDomainKey = '';
  let selectedUserKey = '';

  function escHtml(raw) {
    return String(raw || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizeDomainText(raw) {
    let v = String(raw || '').trim();
    if (!v) return '';
    if (/^https?:\/\//i.test(v)) {
      try {
        v = new URL(v).hostname;
      } catch {
        v = v.replace(/^https?:\/\//i, '');
      }
    } else {
      v = v.split('/')[0];
    }
    return v.replace(/:\d+$/, '').trim().toLowerCase();
  }

  function startSessionTimer() {
    if (sessionTimerId) clearInterval(sessionTimerId);
    sessionTimerId = setInterval(() => {
      if (sessionSecondsRemaining > 0 && !isSessionLocked) {
        sessionSecondsRemaining--;
        updateSessionDisplay();
      } else if (!isSessionLocked) {
        lockSession();
      }
    }, 1000);
  }

  function updateSessionDisplay() {
    const mins = Math.floor(sessionSecondsRemaining / 60);
    const secs = sessionSecondsRemaining % 60;
    if (sessionCountdown) {
      sessionCountdown.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
  }

  function refreshSession() {
    if (!isSessionLocked) {
      sessionSecondsRemaining = 900;
      updateSessionDisplay();
    }
  }

  function lockSession() {
    isSessionLocked = true;
    sessionSecondsRemaining = 0;
    if (mantraInput) mantraInput.value = '';
    updateSessionDisplay();
    if (sessionDot) sessionDot.className = 'status-dot locked';
    validateCanary('');
    showToast('会话已锁定，口令输入已清空', 'info', '🔒');
  }

  function unlockSession() {
    isSessionLocked = false;
    sessionSecondsRemaining = 900;
    updateSessionDisplay();
    if (sessionDot) sessionDot.className = 'status-dot active';
    showToast('会话已就绪，15分钟防超时保护中', 'success', '🛡️');
  }

  function showToast(message, type = 'info', icon = '⚡') {
    if (!hudToast) return;
    if (toastMsg) toastMsg.textContent = message;
    if (toastIcon) toastIcon.textContent = icon;
    hudToast.className = `hud-toast show ${type}`;
    if (toastHideTimer) clearTimeout(toastHideTimer);
    toastHideTimer = setTimeout(() => {
      hudToast.className = 'hud-toast';
    }, 2800);
  }

  // -------------------------------------------------------------------------
  // 4. 金丝雀防手抖校验 (结合 Manifest.canaryHash)
  // -------------------------------------------------------------------------
  async function validateCanary(inputVal) {
    if (!canaryIndicator || !canaryText) return;
    const trimmed = (inputVal || '').trim();
    if (!trimmed) {
      canaryIndicator.className = 'canary-indicator warning';
      canaryText.textContent = '等待主心诀口令输入';
      mantraInput?.classList.remove('shake');
      return;
    }

    const digest = await computeCanary(trimmed);
    const manifest = getDesktopManifest();
    const baseline = (manifest.canaryHash || '').trim().toUpperCase();

    if (baseline && digest !== baseline) {
      canaryIndicator.className = 'canary-indicator error';
      canaryText.textContent = `校验码 ${digest} ≠ ${baseline}`;
      mantraInput?.classList.add('shake');
      setTimeout(() => mantraInput?.classList.remove('shake'), 350);
      return;
    }

    canaryIndicator.className = 'canary-indicator';
    canaryText.textContent = baseline
      ? `金丝雀通过: ${digest}`
      : `校验码: ${digest}`;
    mantraInput?.classList.remove('shake');
  }

  // -------------------------------------------------------------------------
  // 5. 动态 Manifest 存储与关联管理
  // -------------------------------------------------------------------------
  function getDesktopManifest() {
    try {
      const raw = localStorage.getItem('mk_local_manifest');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.domains) {
          return parsed;
        }
      }
    } catch {}
    return {
      schemaVersion: 1,
      canaryHash: '',
      domains: {},
      updatedAt: Date.now()
    };
  }

  function saveDesktopManifest(manifest) {
    try {
      localStorage.setItem('mk_local_manifest', JSON.stringify(manifest));
    } catch {}
  }

  function isCustomDisplayName(name, canonicalDomain) {
    const trimmed = String(name || '').trim();
    if (!trimmed) return false;
    return trimmed.toLowerCase() !== String(canonicalDomain || '').trim().toLowerCase();
  }

  function pickMergedDisplayName(localDomain, remoteDomain) {
    const canonical = remoteDomain.canonicalDomain || localDomain.canonicalDomain || '';
    const localCustom = isCustomDisplayName(localDomain.displayName, canonical);
    const remoteCustom = isCustomDisplayName(remoteDomain.displayName, canonical);
    if (localCustom && remoteCustom) {
      return remoteDomain.updatedAt > localDomain.updatedAt
        ? remoteDomain.displayName
        : localDomain.displayName;
    }
    if (remoteCustom) return remoteDomain.displayName;
    if (localCustom) return localDomain.displayName;
    return remoteDomain.updatedAt > localDomain.updatedAt
      ? (remoteDomain.displayName || localDomain.displayName || canonical)
      : (localDomain.displayName || remoteDomain.displayName || canonical);
  }

  function getEntryAssociatedDomains(manifest, entry) {
    const selfRaw = (entry.canonicalDomain || '').trim().toLowerCase();
    const result = new Set();

    const addIfOther = (raw) => {
      const clean = (raw || '').trim().toLowerCase();
      if (clean && clean !== selfRaw) result.add(clean);
    };

    if (Array.isArray(entry.associatedDomains)) {
      entry.associatedDomains.forEach(addIfOther);
    }

    const serviceKeys = new Set();
    if (entry.serviceKey) serviceKeys.add(entry.serviceKey.trim().toLowerCase());

    for (const acc of Object.values(entry.accounts || {})) {
      if (acc.isDeleted) continue;
      if (acc.serviceKey) serviceKeys.add(acc.serviceKey.trim().toLowerCase());
      if (Array.isArray(acc.aliases)) acc.aliases.forEach(addIfOther);
    }

    if (serviceKeys.size > 0) {
      for (const [otherKey, otherEntry] of Object.entries(manifest.domains || {})) {
        if (otherKey.toLowerCase() === selfRaw) continue;
        const otherKeys = [];
        if (otherEntry.serviceKey) otherKeys.push(otherEntry.serviceKey.trim().toLowerCase());
        for (const acc of Object.values(otherEntry.accounts || {})) {
          if (!acc.isDeleted && acc.serviceKey) {
            otherKeys.push(acc.serviceKey.trim().toLowerCase());
          }
        }
        if (otherKeys.some((sk) => serviceKeys.has(sk))) {
          addIfOther(otherEntry.canonicalDomain || otherKey);
        }
      }
    }
    return Array.from(result);
  }

  function upsertDesktopAccount(domainRaw, usernameRaw, presetRaw, aliasRaw, versionVal = 1) {
    const domain = normalizeDomainText(domainRaw);
    if (!domain) return null;
    const username = (usernameRaw || '').trim() || 'default';
    const preset = normalizeRulePreset(presetRaw);
    const alias = (aliasRaw || '').trim();
    const manifest = getDesktopManifest();
    const now = Date.now();
    const existing = manifest.domains[domain];
    const accounts = { ...(existing?.accounts || {}) };
    const existingAcc = accounts[username];

    accounts[username] = {
      username,
      version: versionVal > 0 ? versionVal : (existingAcc?.version || 1),
      serviceKey: existingAcc?.serviceKey || existing?.serviceKey,
      aliases: existingAcc?.aliases,
      updatedAt: now,
      isDeleted: false
    };

    manifest.domains[domain] = {
      canonicalDomain: domain,
      displayName: alias || existing?.displayName || domain,
      rulePreset: preset || existing?.rulePreset || 'standard-16',
      serviceKey: existing?.serviceKey,
      associatedDomains: existing?.associatedDomains,
      accounts,
      updatedAt: now
    };
    manifest.updatedAt = now;
    saveDesktopManifest(manifest);
    selectedDomainKey = domain;
    selectedUserKey = username;
    return manifest;
  }

  function updateDesktopDomainAlias(domainKey, newAlias) {
    const manifest = getDesktopManifest();
    const entry = manifest.domains[domainKey];
    if (!entry) return;
    const now = Date.now();
    entry.displayName = newAlias.trim() || domainKey;
    entry.updatedAt = now;
    manifest.updatedAt = now;
    saveDesktopManifest(manifest);
  }

  function removeDesktopDomain(domainKey) {
    const manifest = getDesktopManifest();
    if (!manifest.domains[domainKey]) return;
    delete manifest.domains[domainKey];
    manifest.updatedAt = Date.now();
    saveDesktopManifest(manifest);
    if (selectedDomainKey === domainKey) {
      selectedDomainKey = '';
      selectedUserKey = '';
    }
  }

  function bumpDesktopAccountVersion(domainKey, userKey, delta) {
    const manifest = getDesktopManifest();
    const entry = manifest.domains[domainKey];
    if (!entry || !entry.accounts?.[userKey]) return null;
    const nextVer = Math.max(1, (entry.accounts[userKey].version || 1) + delta);
    const now = Date.now();
    entry.accounts[userKey].version = nextVer;
    entry.accounts[userKey].updatedAt = now;
    entry.updatedAt = now;
    manifest.updatedAt = now;
    saveDesktopManifest(manifest);
    return nextVer;
  }

  function addDesktopDomainAssoc(domainKey, rawAlias) {
    const alias = normalizeDomainText(rawAlias);
    if (!alias) return { ok: false, message: '请输入有效的关联域名' };
    if (alias === domainKey) return { ok: false, message: '无需关联自身域名' };
    const manifest = getDesktopManifest();
    const entry = manifest.domains[domainKey];
    if (!entry) return { ok: false, message: '未找到站点记录' };

    const now = Date.now();
    const assocSet = new Set((entry.associatedDomains || []).map((d) => d.trim().toLowerCase()));
    assocSet.add(alias);
    entry.serviceKey = entry.serviceKey || domainKey;
    entry.associatedDomains = Array.from(assocSet);

    for (const [uKey, acc] of Object.entries(entry.accounts || {})) {
      if (acc.isDeleted) continue;
      const accAliases = new Set((acc.aliases || []).map((d) => d.trim().toLowerCase()));
      accAliases.add(alias);
      entry.accounts[uKey] = {
        ...acc,
        serviceKey: acc.serviceKey || entry.serviceKey,
        aliases: Array.from(accAliases),
        updatedAt: now
      };
    }
    entry.updatedAt = now;
    manifest.updatedAt = now;
    saveDesktopManifest(manifest);
    return { ok: true, message: `已添加关联 [${alias}]` };
  }

  function removeDesktopDomainAssoc(domainKey, targetAlias) {
    const aliasLower = targetAlias.trim().toLowerCase();
    const manifest = getDesktopManifest();
    const entry = manifest.domains[domainKey];
    if (!entry) return false;
    const now = Date.now();

    const nextAssoc = (entry.associatedDomains || []).filter((d) => d.trim().toLowerCase() !== aliasLower);
    entry.associatedDomains = nextAssoc.length > 0 ? nextAssoc : undefined;
    for (const [uKey, acc] of Object.entries(entry.accounts || {})) {
      entry.accounts[uKey] = {
        ...acc,
        aliases: Array.isArray(acc.aliases)
          ? acc.aliases.filter((d) => d.trim().toLowerCase() !== aliasLower)
          : undefined,
        updatedAt: now
      };
    }
    entry.updatedAt = now;

    if (manifest.domains[aliasLower]) {
      const other = manifest.domains[aliasLower];
      const cleanedAssoc = (other.associatedDomains || []).filter((d) => d.trim().toLowerCase() !== domainKey);
      other.associatedDomains = cleanedAssoc.length > 0 ? cleanedAssoc : undefined;
      if (other.serviceKey === (entry.serviceKey || domainKey)) {
        other.serviceKey = aliasLower;
      }
      for (const [uKey, acc] of Object.entries(other.accounts || {})) {
        other.accounts[uKey] = {
          ...acc,
          aliases: Array.isArray(acc.aliases)
            ? acc.aliases.filter((d) => d.trim().toLowerCase() !== domainKey)
            : undefined,
          serviceKey: acc.serviceKey === (entry.serviceKey || domainKey) ? aliasLower : acc.serviceKey,
          updatedAt: now
        };
      }
      other.updatedAt = now;
    }

    manifest.updatedAt = now;
    saveDesktopManifest(manifest);
    return true;
  }

  // -------------------------------------------------------------------------
  // 6. 动态清单渲染与选中联动
  // -------------------------------------------------------------------------
  function getSelectedAccountContext() {
    const manifest = getDesktopManifest();
    const entry = manifest.domains[selectedDomainKey];
    if (!entry) return null;
    const acc = entry.accounts?.[selectedUserKey];
    if (!acc || acc.isDeleted) return null;
    return {
      domainKey: selectedDomainKey,
      entry,
      account: acc,
      derivationBase: acc.serviceKey || entry.serviceKey || entry.canonicalDomain,
      preset: normalizeRulePreset(entry.rulePreset)
    };
  }

  function updateActiveSelectionChrome() {
    const manifest = getDesktopManifest();
    const totalSites = Object.keys(manifest.domains || {}).length;
    if (hudManifestCount) {
      hudManifestCount.textContent = `${totalSites} 个站点`;
    }

    const ctx = getSelectedAccountContext();
    if (!ctx) {
      if (hudActiveTitle) hudActiveTitle.textContent = '密诀动态凭据清单';
      if (hudActiveDomain) hudActiveDomain.textContent = '未选择站点';
      if (hudActiveAliasTag) hudActiveAliasTag.textContent = '[Dynamic Manifest]';
      if (hostWindowTitle) hostWindowTitle.textContent = '桌面目标宿主视窗 (待选择站点)';
      if (hostAccountDisplay) hostAccountDisplay.textContent = '未选择账号';
      return;
    }

    const hasAlias = isCustomDisplayName(ctx.entry.displayName, ctx.entry.canonicalDomain);
    const title = hasAlias ? ctx.entry.displayName : ctx.entry.canonicalDomain;
    if (hudActiveTitle) hudActiveTitle.textContent = `${title} · ${ctx.account.username}`;
    if (hudActiveDomain) hudActiveDomain.textContent = ctx.entry.canonicalDomain;
    if (hudActiveAliasTag) {
      hudActiveAliasTag.textContent = hasAlias ? `[${ctx.entry.displayName}]` : `[v${ctx.account.version || 1}]`;
    }
    if (hostWindowTitle) hostWindowTitle.textContent = `${title} (${ctx.entry.canonicalDomain})`;
    if (hostAccountDisplay) hostAccountDisplay.textContent = ctx.account.username;
  }

  function renderHudManifest() {
    if (!accountListEl) return;
    const manifest = getDesktopManifest();
    const allDomains = manifest.domains || {};
    const sortedKeys = Object.keys(allDomains).sort(
      (a, b) => (allDomains[b]?.updatedAt || 0) - (allDomains[a]?.updatedAt || 0)
    );

    const kw = searchKeyword.trim().toLowerCase();
    const filteredKeys = sortedKeys.filter((k) => {
      if (!kw) return true;
      const entry = allDomains[k];
      if (!entry) return false;
      const assoc = getEntryAssociatedDomains(manifest, entry).join(' ').toLowerCase();
      const accNames = Object.values(entry.accounts || {})
        .filter((a) => !a.isDeleted)
        .map((a) => `${a.username} ${a.serviceKey || ''}`)
        .join(' ')
        .toLowerCase();
      return (
        k.toLowerCase().includes(kw) ||
        (entry.canonicalDomain || '').toLowerCase().includes(kw) ||
        (entry.displayName || '').toLowerCase().includes(kw) ||
        (entry.serviceKey || '').toLowerCase().includes(kw) ||
        assoc.includes(kw) ||
        accNames.includes(kw)
      );
    });

    // 确保有默认选中项
    const hasValidSelection = Boolean(getSelectedAccountContext());
    if (!hasValidSelection && filteredKeys.length > 0) {
      for (const dk of filteredKeys) {
        const activeAccs = Object.values(allDomains[dk].accounts || {}).filter((a) => !a.isDeleted);
        if (activeAccs.length > 0) {
          selectedDomainKey = dk;
          selectedUserKey = activeAccs[0].username;
          break;
        }
      }
    }

    if (filteredKeys.length === 0) {
      accountListEl.innerHTML = kw
        ? `<div class="hud-empty-state">
             <div>🔍 未找到与「${escHtml(kw)}」匹配的站点或账号</div>
             <div class="hud-empty-actions">
               <button type="button" class="btn-hud-mini" id="btnEmptyClearSearch">清空搜索</button>
             </div>
           </div>`
        : `<div class="hud-empty-state">
             <div>📂 动态清单暂无站点记录</div>
             <div style="font-size:11px; color:var(--text-muted);">点击右上角「➕ 录入」添加账号，或使用「🌐 WebDAV 同步」拉取多端密码库</div>
             <div class="hud-empty-actions">
               <button type="button" class="btn-hud-mini" id="btnEmptyAdd">➕ 录入新站点</button>
               <button type="button" class="btn-hud-mini" id="btnEmptySync">🌐 WebDAV 同步</button>
             </div>
           </div>`;

      document.getElementById('btnEmptyClearSearch')?.addEventListener('click', () => {
        searchKeyword = '';
        if (hudSearchInput) hudSearchInput.value = '';
        if (btnClearHudSearch) btnClearHudSearch.style.display = 'none';
        renderHudManifest();
      });
      document.getElementById('btnEmptyAdd')?.addEventListener('click', () => {
        hudAddDrawer?.classList.remove('hidden');
        addSiteDomain?.focus();
      });
      document.getElementById('btnEmptySync')?.addEventListener('click', () => {
        document.getElementById('btnOpenSyncModal')?.click();
      });

      updateActiveSelectionChrome();
      return;
    }

    let quickIndex = 0;
    accountListEl.innerHTML = filteredKeys.map((domainKey) => {
      const entry = allDomains[domainKey];
      const hasAlias = isCustomDisplayName(entry.displayName, entry.canonicalDomain);
      const displayTitle = hasAlias ? entry.displayName : entry.canonicalDomain;
      const presetKey = normalizeRulePreset(entry.rulePreset);
      const presetInfo = RULE_PRESETS[presetKey];
      const assocDomains = getEntryAssociatedDomains(manifest, entry);
      const activeAccs = Object.values(entry.accounts || {}).filter((a) => !a.isDeleted);
      const safeDomAttr = escHtml(domainKey);

      const assocHtml = `
        <div class="hud-assoc-row" data-assoc-domain="${safeDomAttr}">
          <span>${assocDomains.length > 0 ? `🔗 关联 (${assocDomains.length}):` : '🔗 关联: 暂无'}</span>
          ${assocDomains.map((ad) => `
            <span class="hud-assoc-pill">
              <span>${escHtml(ad)}</span>
              <button type="button" class="btn-hud-rm-assoc" data-domain="${safeDomAttr}" data-alias="${escHtml(ad)}" title="取消关联">×</button>
            </span>
          `).join('')}
          <button type="button" class="hud-op-btn btn-hud-add-assoc" data-domain="${safeDomAttr}">+ 关联</button>
        </div>
        <div class="hud-inline-edit-row hidden" data-assoc-editor="${safeDomAttr}">
          <input type="text" placeholder="输入镜像域名 (如 mirror.example.com)" class="inp-hud-assoc" />
          <button type="button" class="hud-op-btn btn-hud-assoc-ok">添加</button>
          <button type="button" class="hud-op-btn btn-hud-assoc-cancel">取消</button>
        </div>
      `;

      const cardsHtml = activeAccs.length > 0
        ? activeAccs.map((acc) => {
            quickIndex++;
            const isSelected = domainKey === selectedDomainKey && acc.username === selectedUserKey;
            const maskStr = '•'.repeat(Math.min(presetInfo.length, 24));
            const ver = acc.version || 1;
            const safeUserAttr = escHtml(acc.username);
            const hotkeyHint = quickIndex <= 9 ? `按 [${quickIndex}] 选中` : presetInfo.name;

            return `
              <div class="credential-card${isSelected ? ' selected' : ''}" data-domain="${safeDomAttr}" data-account="${safeUserAttr}">
                <div class="card-top-row">
                  <div class="card-user-info">
                    <div class="card-user-icon">${isSelected ? '👤' : '👥'}</div>
                    <div>
                      <div style="display:flex; align-items:center; gap:6px;">
                        <span class="username-text">${safeUserAttr}</span>
                        ${acc.serviceKey ? `<span class="account-badge">🏷️ ${escHtml(acc.serviceKey)}</span>` : ''}
                      </div>
                    </div>
                  </div>
                  <div class="entropy-tag">
                    <span>${escHtml(presetInfo.name)}</span>
                  </div>
                </div>
                <div class="card-version-row">
                  <div style="display:flex; align-items:center; gap:6px;">
                    <span>版本步进:</span>
                    <div class="version-stepper">
                      <button type="button" class="btn-stepper btn-ver-down" data-domain="${safeDomAttr}" data-account="${safeUserAttr}" title="回退版本">-</button>
                      <span class="stepper-val ver-display">v${ver}</span>
                      <button type="button" class="btn-stepper btn-ver-up" data-domain="${safeDomAttr}" data-account="${safeUserAttr}" title="升级版本">+</button>
                    </div>
                  </div>
                  <span style="font-size:10px; color:var(--text-muted);">${hotkeyHint}</span>
                </div>
                <div class="mask-preview-box">
                  <div style="display:flex; align-items:center; gap:8px;">
                    <span style="color:var(--text-muted); font-size:12px;">🔒</span>
                    <span class="mask-code font-mono">${maskStr}</span>
                  </div>
                  <div class="sha-preview">
                    <button type="button" class="btn-copy-mini btn-peek-card" data-domain="${safeDomAttr}" data-account="${safeUserAttr}" title="显示/隐藏派生密码">👁️</button>
                    <button type="button" class="btn-copy-mini btn-copy-card" data-domain="${safeDomAttr}" data-account="${safeUserAttr}" title="派生并复制密码">📋</button>
                  </div>
                </div>
              </div>
            `;
          }).join('')
        : `<div style="font-size:11px; color:var(--text-muted); padding:4px 2px;">该站点暂无账号，点击右上「➕ 录入」补充账号</div>`;

      return `
        <section class="hud-site-group" data-site-group="${safeDomAttr}">
          <div class="hud-site-header">
            <div class="hud-site-title-wrap">
              <span class="hud-site-title">${hasAlias ? '🏷️ ' : '🌐 '}${escHtml(displayTitle)}</span>
              ${hasAlias ? `<span class="hud-site-domain-sub">${safeDomAttr}</span>` : ''}
            </div>
            <div class="hud-site-ops">
              <button type="button" class="hud-op-btn btn-hud-edit-alias" data-domain="${safeDomAttr}" data-alias="${escHtml(entry.displayName || '')}" title="修改别名">✏️</button>
              <button type="button" class="hud-op-btn btn-hud-del-site" data-domain="${safeDomAttr}" title="删除站点">✕</button>
            </div>
          </div>
          <div class="hud-inline-edit-row hidden" data-alias-editor="${safeDomAttr}">
            <input type="text" class="inp-hud-alias" value="${escHtml(hasAlias ? entry.displayName : '')}" placeholder="输入站点别名 (留空恢复域名)" />
            <button type="button" class="hud-op-btn btn-hud-alias-save">保存</button>
            <button type="button" class="hud-op-btn btn-hud-alias-cancel">取消</button>
          </div>
          ${assocHtml}
          ${cardsHtml}
        </section>
      `;
    }).join('');

    bindRenderedManifestEvents();
    updateActiveSelectionChrome();
  }

  function bindRenderedManifestEvents() {
    if (!accountListEl) return;

    accountListEl.querySelectorAll('.credential-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.version-stepper') || e.target.closest('.btn-copy-mini')) return;
        selectedDomainKey = card.getAttribute('data-domain') || '';
        selectedUserKey = card.getAttribute('data-account') || '';
        accountListEl.querySelectorAll('.credential-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        updateActiveSelectionChrome();
        showToast(`已选中 ${selectedDomainKey} · ${selectedUserKey}`, 'info', '👤');
      });
    });

    accountListEl.querySelectorAll('.btn-ver-up').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dk = btn.getAttribute('data-domain') || '';
        const uk = btn.getAttribute('data-account') || '';
        const nextVer = bumpDesktopAccountVersion(dk, uk, 1);
        if (nextVer) {
          renderHudManifest();
          showToast(`版本已递增至 v${nextVer}`, 'success', '⚡');
        }
      });
    });

    accountListEl.querySelectorAll('.btn-ver-down').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dk = btn.getAttribute('data-domain') || '';
        const uk = btn.getAttribute('data-account') || '';
        const nextVer = bumpDesktopAccountVersion(dk, uk, -1);
        if (nextVer) {
          renderHudManifest();
          showToast(`版本已回退至 v${nextVer}`, 'info', '↩️');
        }
      });
    });

    accountListEl.querySelectorAll('.btn-copy-card').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        selectedDomainKey = btn.getAttribute('data-domain') || selectedDomainKey;
        selectedUserKey = btn.getAttribute('data-account') || selectedUserKey;
        updateActiveSelectionChrome();
        await executeCopyOnly();
      });
    });

    accountListEl.querySelectorAll('.btn-peek-card').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const card = btn.closest('.credential-card');
        const maskEl = card?.querySelector('.mask-code');
        if (!maskEl) return;

        if (btn.getAttribute('data-revealed') === 'true') {
          btn.setAttribute('data-revealed', 'false');
          btn.textContent = '👁️';
          maskEl.textContent = '••••••••••••••••';
          return;
        }

        selectedDomainKey = btn.getAttribute('data-domain') || selectedDomainKey;
        selectedUserKey = btn.getAttribute('data-account') || selectedUserKey;
        const pwd = await deriveSelectedPassword();
        if (!pwd) return;

        btn.setAttribute('data-revealed', 'true');
        btn.textContent = '🙈';
        maskEl.textContent = pwd;
        setTimeout(() => {
          btn.setAttribute('data-revealed', 'false');
          btn.textContent = '👁️';
          maskEl.textContent = '•'.repeat(pwd.length);
        }, 5000);
      });
    });

    accountListEl.querySelectorAll('.btn-hud-edit-alias').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dk = btn.getAttribute('data-domain') || '';
        const group = btn.closest('.hud-site-group');
        const editor = group?.querySelector(`[data-alias-editor="${CSS.escape(dk)}"]`);
        if (editor) {
          editor.classList.toggle('hidden');
          editor.querySelector('.inp-hud-alias')?.focus();
        }
      });
    });

    accountListEl.querySelectorAll('.hud-site-group').forEach((group) => {
      const dk = group.getAttribute('data-site-group') || '';
      const aliasEditor = group.querySelector('[data-alias-editor]');
      const aliasInput = aliasEditor?.querySelector('.inp-hud-alias');

      aliasEditor?.querySelector('.btn-hud-alias-save')?.addEventListener('click', () => {
        updateDesktopDomainAlias(dk, aliasInput?.value || '');
        renderHudManifest();
        showToast(`已更新 [${dk}] 站点别名`, 'success', '🏷️');
      });
      aliasEditor?.querySelector('.btn-hud-alias-cancel')?.addEventListener('click', () => {
        aliasEditor.classList.add('hidden');
      });
      aliasInput?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          updateDesktopDomainAlias(dk, aliasInput.value || '');
          renderHudManifest();
          showToast(`已更新 [${dk}] 站点别名`, 'success', '🏷️');
        }
      });

      const assocEditor = group.querySelector('[data-assoc-editor]');
      const assocInput = assocEditor?.querySelector('.inp-hud-assoc');
      group.querySelector('.btn-hud-add-assoc')?.addEventListener('click', () => {
        assocEditor?.classList.toggle('hidden');
        assocInput?.focus();
      });
      assocEditor?.querySelector('.btn-hud-assoc-cancel')?.addEventListener('click', () => {
        assocEditor.classList.add('hidden');
      });
      const submitAssoc = () => {
        const res = addDesktopDomainAssoc(dk, assocInput?.value || '');
        if (res.ok) {
          renderHudManifest();
          showToast(res.message, 'success', '🔗');
        } else {
          showToast(res.message, 'error', '⚠️');
        }
      };
      assocEditor?.querySelector('.btn-hud-assoc-ok')?.addEventListener('click', submitAssoc);
      assocInput?.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          submitAssoc();
        }
      });
    });

    accountListEl.querySelectorAll('.btn-hud-rm-assoc').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dk = btn.getAttribute('data-domain') || '';
        const alias = btn.getAttribute('data-alias') || '';
        if (removeDesktopDomainAssoc(dk, alias)) {
          renderHudManifest();
          showToast(`已取消关联 [${alias}]`, 'info', '🔗');
        }
      });
    });

    accountListEl.querySelectorAll('.btn-hud-del-site').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dk = btn.getAttribute('data-domain') || '';
        if (btn.getAttribute('data-armed') !== 'true') {
          btn.setAttribute('data-armed', 'true');
          btn.textContent = '确认?';
          setTimeout(() => {
            btn.setAttribute('data-armed', 'false');
            btn.textContent = '✕';
          }, 2500);
          return;
        }
        removeDesktopDomain(dk);
        renderHudManifest();
        showToast(`已移除站点 [${dk}]`, 'info', '🗑️');
      });
    });
  }

  // -------------------------------------------------------------------------
  // 7. 派生与注入 / 剪贴板动作
  // -------------------------------------------------------------------------
  async function deriveSelectedPassword() {
    const mantra = mantraInput ? mantraInput.value.trim() : '';
    if (!mantra) {
      showToast('请先输入主心诀口令', 'error', '⚠️');
      mantraInput?.focus();
      return '';
    }

    const ctx = getSelectedAccountContext();
    if (!ctx) {
      showToast('请先在清单中添加或选择一个账号', 'error', '⚠️');
      return '';
    }

    const manifest = getDesktopManifest();
    const baseline = (manifest.canaryHash || '').trim().toUpperCase();
    if (baseline) {
      const digest = await computeCanary(mantra);
      if (digest !== baseline) {
        showToast('主口令与清单校验码不符，已拦截派生', 'error', '⚠️');
        await validateCanary(mantra);
        return '';
      }
    }

    refreshSession();
    return deriveSitePassword(
      mantra,
      ctx.derivationBase,
      ctx.account.username,
      ctx.account.version || 1,
      ctx.preset
    );
  }

  async function executeSendInputInjection() {
    const ctx = getSelectedAccountContext();
    const pwd = await deriveSelectedPassword();
    if (!pwd || !ctx) return;

    try {
      await navigator.clipboard.writeText(pwd);
    } catch {}

    showToast(`已为 ${ctx.entry.canonicalDomain} (${ctx.account.username}) 派生并就绪`, 'success', '⚡');

    if (hostPasswordTarget && injectedDisplay) {
      hostPasswordTarget.style.borderColor = 'var(--cipher-cyan)';
      hostPasswordTarget.style.boxShadow = '0 0 16px rgba(0, 240, 255, 0.4)';
      injectedDisplay.textContent = '•'.repeat(pwd.length);
    }

    setTimeout(() => {
      hudOverlay?.classList.add('hidden');
      if (hostAppWindow) {
        hostAppWindow.style.opacity = '1';
        hostAppWindow.style.filter = 'none';
      }
    }, 350);
  }

  async function executeCopyOnly() {
    const ctx = getSelectedAccountContext();
    const pwd = await deriveSelectedPassword();
    if (!pwd || !ctx) return;

    try {
      await navigator.clipboard.writeText(pwd);
      showToast(`已复制 [${ctx.entry.displayName || ctx.entry.canonicalDomain}] 密码 (30秒后自动清空)`, 'success', '📋');
    } catch {
      showToast('剪贴板写入受限，请使用 👁️ 查看派生结果', 'error', '⚠️');
      return;
    }

    if (clipboardWipeTimer) clearTimeout(clipboardWipeTimer);
    clipboardWipeTimer = setTimeout(async () => {
      try {
        await navigator.clipboard.writeText('');
      } catch {}
      showToast('30 秒已到：剪贴板已安全擦除', 'info', '🧹');
    }, 30000);
  }

  // -------------------------------------------------------------------------
  // 8. 全局事件与 WebDAV 绑定
  // -------------------------------------------------------------------------
  function initEventListeners() {
    document.addEventListener('keydown', (e) => {
      if (e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        hudOverlay?.classList.toggle('hidden');
        if (!hudOverlay?.classList.contains('hidden')) {
          mantraInput?.focus();
          if (hostAppWindow) {
            hostAppWindow.style.opacity = '0.35';
            hostAppWindow.style.filter = 'blur(1.5px)';
          }
        }
      }

      if (e.key === 'Escape') {
        if (unknownProcessModal && !unknownProcessModal.classList.contains('hidden')) {
          unknownProcessModal.classList.add('hidden');
        } else if (webdavSyncModal && !webdavSyncModal.classList.contains('hidden')) {
          webdavSyncModal.classList.add('hidden');
        } else if (hudOverlay && !hudOverlay.classList.contains('hidden')) {
          hudOverlay.classList.add('hidden');
          if (hostAppWindow) {
            hostAppWindow.style.opacity = '1';
            hostAppWindow.style.filter = 'none';
          }
        }
      }

      if (e.key === 'Enter' && hudOverlay && !hudOverlay.classList.contains('hidden')) {
        const activeTag = document.activeElement?.tagName;
        if (activeTag === 'INPUT' && document.activeElement !== mantraInput) return;
        if (unknownProcessModal && !unknownProcessModal.classList.contains('hidden')) {
          e.preventDefault();
          btnBindAndDerive?.click();
          return;
        }
        if (document.activeElement !== btnCopyOnly && document.activeElement !== btnIgnoreProcess) {
          e.preventDefault();
          executeSendInputInjection();
        }
      }

      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        executeCopyOnly();
      }

      if (hudOverlay && !hudOverlay.classList.contains('hidden') && document.activeElement?.tagName !== 'INPUT') {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= 9) {
          const cards = accountListEl?.querySelectorAll('.credential-card');
          if (cards && cards[num - 1]) {
            cards[num - 1].click();
          }
        }
      }
    });

    mantraInput?.addEventListener('input', (e) => {
      clearTimeout(canaryDebounceTimer);
      canaryDebounceTimer = setTimeout(() => {
        validateCanary(e.target.value);
      }, 120);
    });

    btnToggleMantraVis?.addEventListener('click', () => {
      if (!mantraInput) return;
      if (mantraInput.type === 'password') {
        mantraInput.type = 'text';
        if (visIcon) visIcon.textContent = '🔒';
      } else {
        mantraInput.type = 'password';
        if (visIcon) visIcon.textContent = '👁️';
      }
    });

    hudSearchInput?.addEventListener('input', () => {
      searchKeyword = hudSearchInput.value || '';
      if (btnClearHudSearch) {
        btnClearHudSearch.style.display = searchKeyword ? 'inline-block' : 'none';
      }
      renderHudManifest();
    });

    btnClearHudSearch?.addEventListener('click', () => {
      searchKeyword = '';
      if (hudSearchInput) hudSearchInput.value = '';
      btnClearHudSearch.style.display = 'none';
      renderHudManifest();
      hudSearchInput?.focus();
    });

    btnToggleAddSite?.addEventListener('click', () => {
      hudAddDrawer?.classList.toggle('hidden');
      if (hudAddDrawer && !hudAddDrawer.classList.contains('hidden')) {
        addSiteDomain?.focus();
      }
    });

    btnCancelNewSite?.addEventListener('click', () => {
      hudAddDrawer?.classList.add('hidden');
    });

    btnSaveNewSite?.addEventListener('click', () => {
      const dom = addSiteDomain?.value || '';
      const alias = addSiteAlias?.value || '';
      const user = addSiteUser?.value || '';
      const preset = addSitePreset?.value || 'standard-16';
      if (!normalizeDomainText(dom)) {
        showToast('请输入有效的站点域名', 'error', '⚠️');
        addSiteDomain?.focus();
        return;
      }
      upsertDesktopAccount(dom, user, preset, alias, 1);
      if (addSiteDomain) addSiteDomain.value = '';
      if (addSiteAlias) addSiteAlias.value = '';
      if (addSiteUser) addSiteUser.value = '';
      hudAddDrawer?.classList.add('hidden');
      renderHudManifest();
      showToast('已保存站点至动态清单', 'success', '💾');
    });

    btnInject?.addEventListener('click', executeSendInputInjection);
    btnCopyOnly?.addEventListener('click', executeCopyOnly);

    btnLockNow?.addEventListener('click', () => {
      if (isSessionLocked) unlockSession();
      else lockSession();
    });

    btnToggleUnknownModal?.addEventListener('click', () => {
      unknownProcessModal?.classList.toggle('hidden');
    });

    btnCloseUnknownModal?.addEventListener('click', () => {
      unknownProcessModal?.classList.add('hidden');
    });

    btnIgnoreProcess?.addEventListener('click', () => {
      unknownProcessModal?.classList.add('hidden');
      showToast('已忽略当前未知进程提示', 'info', '✕');
    });

    btnBindAndDerive?.addEventListener('click', () => {
      const domain = domainSearchInput ? domainSearchInput.value : '';
      const activePresetEl = document.querySelector('.preset-card.active');
      const preset = activePresetEl?.getAttribute('data-preset') || 'standard-16';
      if (!normalizeDomainText(domain)) {
        showToast('请输入要绑定的目标域名', 'error', '⚠️');
        return;
      }
      upsertDesktopAccount(domain, 'default', preset, '', 1);
      unknownProcessModal?.classList.add('hidden');
      renderHudManifest();
      showToast(`已绑定并录入 ${normalizeDomainText(domain)}`, 'success', '🔗');
    });

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

    if (domainSearchInput && domainAutocomplete) {
      domainSearchInput.addEventListener('input', (e) => {
        const val = e.target.value.trim();
        domainAutocomplete.style.display = val ? 'block' : 'none';
      });
    }

    // WebDAV 同步事件绑定
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
      const cfg = readWebDAVFormConfig();
      saveDesktopWebDAVConfig(cfg);
      refreshDesktopSyncView();
      showToast('WebDAV 配置已保存！', 'success', '💾');
    });

    btnHudTestSync?.addEventListener('click', async () => {
      const cfg = readWebDAVFormConfig();
      btnHudTestSync.textContent = '⏳ 测试中...';
      try {
        let url = cfg.serverUrl.replace(/\/+$/, '');
        if (!url) {
          showToast('请先输入 WebDAV 服务器根地址', 'error', '⚠️');
          return;
        }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        const auth = 'Basic ' + btoa(`${cfg.username}:${cfg.password}`);
        const res = await fetch(url + '/', {
          method: 'GET',
          headers: { Authorization: auth },
          signal: AbortSignal.timeout(6000)
        });
        if (res.status === 401 || res.status === 403) {
          showToast('认证失败: 用户名或应用密码错误', 'error', '❌');
        } else if (res.ok || res.status === 207) {
          showToast(`连通性测试通过 (HTTP ${res.status})`, 'success', '✅');
        } else {
          showToast(`服务器返回: HTTP ${res.status}`, 'info', '⚠️');
        }
      } catch (err) {
        showToast('连接失败: ' + (err.message || '网络无法访问'), 'error', '❌');
      } finally {
        btnHudTestSync.textContent = '⚡ 测试连接';
      }
    });

    btnHudDoSync?.addEventListener('click', async () => {
      const cfg = readWebDAVFormConfig();
      if (!cfg.serverUrl) {
        showToast('请先填写 WebDAV 服务器地址与账号密码', 'error', '⚠️');
        return;
      }

      btnHudDoSync.textContent = '⏳ 正在双向同步...';
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
            headers: { Authorization: auth },
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
            Authorization: auth,
            'Content-Type': 'application/octet-stream'
          },
          body: newEnvelope,
          signal: AbortSignal.timeout(10000)
        });

        if (!putRes.ok && putRes.status !== 201 && putRes.status !== 204) {
          throw new Error(`回写 WebDAV 异常 (HTTP ${putRes.status})`);
        }

        const count = Object.keys(finalManifest.domains || {}).length;
        const timeStr = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const upgraded = !remoteIsEncrypted && !!activeSyncPassword;
        const successMsg = upgraded
          ? `同步成功并升格为 AES-256-GCM 加密！已合并 ${count} 个站点`
          : `WebDAV 同步成功！已合并 ${count} 个站点`;

        saveDesktopSyncInfo({
          status: 'success',
          lastSyncTime: timeStr,
          message: successMsg,
          syncedDomainsCount: count
        });

        refreshDesktopSyncView();
        renderHudManifest();
        validateCanary(mantraInput ? mantraInput.value : '');
        showToast(successMsg, 'success', '🌐');
      } catch (err) {
        saveDesktopSyncInfo({
          status: 'error',
          lastSyncTime: '',
          message: err.message || '未知错误',
          syncedDomainsCount: 0
        });
        refreshDesktopSyncView();
        showToast('同步异常: ' + (err.message || '网络连接中断'), 'error', '❌');
      } finally {
        btnHudDoSync.textContent = '🔄 立即双向同步 (CRDT 自愈合并)';
      }
    });
  }

  // -------------------------------------------------------------------------
  // 9. WebDAV 状态与加解密工具
  // -------------------------------------------------------------------------
  const hudSyncStatusBadge = document.getElementById('hudSyncStatusBadge');
  const hudSyncTimeText = document.getElementById('hudSyncTimeText');
  const hudWebdavUrl = document.getElementById('hudWebdavUrl');
  const hudWebdavUser = document.getElementById('hudWebdavUser');
  const hudWebdavPass = document.getElementById('hudWebdavPass');
  const hudWebdavFile = document.getElementById('hudWebdavFile');
  const hudWebdavSyncPass = document.getElementById('hudWebdavSyncPass');

  function readWebDAVFormConfig() {
    return {
      serverUrl: hudWebdavUrl ? hudWebdavUrl.value.trim() : '',
      username: hudWebdavUser ? hudWebdavUser.value.trim() : '',
      password: hudWebdavPass ? hudWebdavPass.value.trim() : '',
      remoteFileName: hudWebdavFile ? hudWebdavFile.value.trim() : 'mantra_sync.mkey',
      syncPassword: hudWebdavSyncPass ? hudWebdavSyncPass.value.trim() : ''
    };
  }

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

    if (envelope[0] === 0x7B || envelope[0] === 0x5B) {
      return { manifest: JSON.parse(dec.decode(envelope)), isEncrypted: false };
    }
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
      } catch {
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
      domains: { ...(local.domains || {}) },
      updatedAt: Math.max(local.updatedAt || 0, remote.updatedAt || 0, Date.now())
    };

    for (const [dKey, remoteDomain] of Object.entries(remote.domains || {})) {
      const localDomain = merged.domains[dKey];
      if (!localDomain) {
        merged.domains[dKey] = remoteDomain;
      } else {
        const newer = remoteDomain.updatedAt > localDomain.updatedAt ? remoteDomain : localDomain;
        const combinedAccounts = { ...(localDomain.accounts || {}) };
        for (const [uKey, remoteAcc] of Object.entries(remoteDomain.accounts || {})) {
          const localAcc = combinedAccounts[uKey];
          if (!localAcc) {
            combinedAccounts[uKey] = remoteAcc;
          } else {
            const mergedAliases = Array.from(new Set([
              ...(Array.isArray(localAcc.aliases) ? localAcc.aliases : []),
              ...(Array.isArray(remoteAcc.aliases) ? remoteAcc.aliases : [])
            ]));
            if (remoteAcc.version > localAcc.version || (remoteAcc.version === localAcc.version && remoteAcc.updatedAt > localAcc.updatedAt)) {
              combinedAccounts[uKey] = {
                ...remoteAcc,
                serviceKey: remoteAcc.serviceKey || localAcc.serviceKey,
                aliases: mergedAliases.length > 0 ? mergedAliases : undefined
              };
            } else {
              combinedAccounts[uKey] = {
                ...localAcc,
                serviceKey: localAcc.serviceKey || remoteAcc.serviceKey,
                aliases: mergedAliases.length > 0 ? mergedAliases : undefined
              };
            }
          }
        }
        merged.domains[dKey] = {
          canonicalDomain: newer.canonicalDomain,
          displayName: pickMergedDisplayName(localDomain, remoteDomain),
          rulePreset: newer.rulePreset || localDomain.rulePreset,
          serviceKey: newer.serviceKey || localDomain.serviceKey,
          associatedDomains: Array.from(new Set([
            ...(Array.isArray(localDomain.associatedDomains) ? localDomain.associatedDomains : []),
            ...(Array.isArray(remoteDomain.associatedDomains) ? remoteDomain.associatedDomains : [])
          ])),
          accounts: combinedAccounts,
          updatedAt: Math.max(localDomain.updatedAt || 0, remoteDomain.updatedAt || 0)
        };
      }
    }
    return merged;
  }

  // 页面加载启动初始化
  document.addEventListener('DOMContentLoaded', () => {
    startSessionTimer();
    initEventListeners();
    renderHudManifest();
    validateCanary(mantraInput ? mantraInput.value : '');
    showToast('密诀桌面守护宿主就绪 · [Alt+K] 呼出', 'success', '🚀');
  });
})();
