import '../styles/content.css';
import { extractDomain, toUnicodeDomain } from '../utils/domain';
import { computeCanary } from '../utils/crypto';

export default defineContentScript({
  matches: ['<all_urls>'],
  main() {
    console.log('[MantraKey Ext] Content Script 挂载就绪');

    const rawDomain = extractDomain(window.location.href) || window.location.hostname;
    const currentDomain = rawDomain;
    const displayDomain = toUnicodeDomain(rawDomain);

    let activeBubbleEl: HTMLElement | null = null;
    let activeBannerEl: HTMLElement | null = null;
    let activeToastEl: HTMLElement | null = null;
    let currentAnchorInput: HTMLInputElement | null = null;
    let bubbleOpenTimestamp = 0;

    // 监听扩展主题实时切换
    try {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.mantra_theme && activeBubbleEl) {
          activeBubbleEl.setAttribute('data-theme', changes.mantra_theme.newValue === 'dark' ? 'dark' : 'light');
        }
      });
    } catch {}

    // SVG 图标定义
    const ICONS = {
      key: `<svg viewBox="0 0 24 24"><path d="M7 14c-2.76 0-5-2.24-5-5s2.24-5 5-5c2.42 0 4.44 1.72 4.9 4h6.1l2 2-2 2h-2l-1 1-1-1h-2.1c-.46 2.28-2.48 4-4.9 4zm0-8C5.34 6 4 7.34 4 9s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>`,
      bolt: `<svg viewBox="0 0 24 24"><path d="M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.9 17.55 11 21 11 21z"/></svg>`,
      lock: `<svg viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>`,
      check: `<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
      close: `<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
    };

    /**
     * 关闭当前显示的输入框悬浮气泡
     */
    function closeBubble() {
      if (activeBubbleEl && activeBubbleEl.parentNode) {
        activeBubbleEl.parentNode.removeChild(activeBubbleEl);
        activeBubbleEl = null;
        currentAnchorInput = null;
      }
    }

    /**
     * 优雅注入表单值并触发标准事件，确保现代前端框架 (React/Vue/Angular) 捕获更新
     */
    function injectInputValue(input: HTMLInputElement, value: string) {
      input.focus();
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;

      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(input, value);
      } else {
        input.value = value;
      }

      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * 智能识别页面内的登录表单并执行填充
     */
    function autofillPageCredentials(username?: string, password?: string): boolean {
      let filledAny = false;

      // 1. 查找密码框 (排除扩展自身的内嵌输入框)
      const passwordInputs = Array.from(
        document.querySelectorAll<HTMLInputElement>('input[type="password"]')
      ).filter(
        (el) =>
          el.offsetParent !== null &&
          !el.closest('#mantra-autofill-bubble') &&
          !el.classList.contains('mantra-bubble-input') &&
          !el.dataset.mantraInternal
      );

      const targetPwdInput =
        passwordInputs[0] ||
        (document.activeElement instanceof HTMLInputElement && document.activeElement.type === 'password'
          ? document.activeElement
          : null);

      if (targetPwdInput && password) {
        injectInputValue(targetPwdInput, password);
        filledAny = true;
      }

      // 2. 查找账号输入框
      if (username) {
        const usernameSelectors = [
          'input[autocomplete="username"]',
          'input[autocomplete="email"]',
          'input[type="email"]',
          'input[name*="user" i]',
          'input[name*="login" i]',
          'input[name*="account" i]',
          'input[name*="email" i]',
          'input[id*="user" i]',
          'input[id*="login" i]',
          'input[id*="account" i]',
          'input[id*="email" i]',
        ];

        let targetUserInput: HTMLInputElement | null = null;
        for (const sel of usernameSelectors) {
          const el = document.querySelector<HTMLInputElement>(sel);
          if (el && el.offsetParent !== null && el.type !== 'password' && el.type !== 'hidden') {
            targetUserInput = el;
            break;
          }
        }

        // 兜底：若前置有可见文本输入框则优先填充
        if (!targetUserInput && targetPwdInput) {
          const allInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input'));
          const pwdIdx = allInputs.indexOf(targetPwdInput);
          for (let i = pwdIdx - 1; i >= 0; i--) {
            const el = allInputs[i];
            if (el && (el.type === 'text' || el.type === 'email') && el.offsetParent !== null) {
              targetUserInput = el;
              break;
            }
          }
        }

        if (targetUserInput) {
          injectInputValue(targetUserInput, username);
          filledAny = true;
        }
      }

      showInPageToast(filledAny ? '⚡ 密诀: 凭据已安全填充！' : '⚠️ 未能定位到网页输入框');
      return filledAny;
    }

    /**
     * 页面内轻量发光浮动提示
     */
    function showInPageToast(text: string) {
      if (activeToastEl && activeToastEl.parentNode) {
        activeToastEl.parentNode.removeChild(activeToastEl);
      }

      const toast = document.createElement('div');
      toast.className = 'mantra-inpage-toast';
      toast.textContent = text;
      Object.assign(toast.style, {
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        backgroundColor: '#0b0f17',
        color: '#00f0ff',
        border: '1px solid rgba(0, 240, 255, 0.4)',
        borderRadius: '9999px',
        padding: '8px 20px',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '12px',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 240, 255, 0.25)',
        pointerEvents: 'none',
        transition: 'all 0.3s ease',
      });

      document.body.appendChild(toast);
      activeToastEl = toast;

      setTimeout(() => {
        if (toast && toast.parentNode) {
          toast.style.opacity = '0';
          setTimeout(() => toast.remove(), 300);
        }
      }, 2500);
    }

    /**
     * 重新定位浮动气泡，确保永不被父元素 overflow: hidden 裁剪
     */
    function updateBubblePosition() {
      if (!activeBubbleEl || !currentAnchorInput) return;
      const rect = currentAnchorInput.getBoundingClientRect();
      const bubbleWidth = 380;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      let left = rect.left;
      if (left + bubbleWidth > viewportWidth - 12) {
        left = viewportWidth - bubbleWidth - 12;
      }
      if (left < 12) {
        left = 12;
      }

      let top = rect.bottom + 6;
      if (top + 260 > viewportHeight && rect.top > 260) {
        top = Math.max(10, rect.top - 260 - 6);
      }

      activeBubbleEl.style.position = 'fixed';
      activeBubbleEl.style.top = `${top}px`;
      activeBubbleEl.style.left = `${left}px`;
      activeBubbleEl.style.zIndex = '2147483647';
    }

    /**
     * 安全跨进程通信，内建超时与异常兜底，防止挂死
     */
    function safeSendMessage<T>(msg: Record<string, unknown>, timeoutMs = 800): Promise<T | null> {
      return new Promise((resolve) => {
        let done = false;
        const timer = setTimeout(() => {
          if (!done) {
            done = true;
            resolve(null);
          }
        }, timeoutMs);

        try {
          chrome.runtime.sendMessage(msg, (response) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            if (chrome.runtime.lastError) {
              resolve(null);
              return;
            }
            resolve(response as T);
          });
        } catch {
          if (!done) {
            done = true;
            clearTimeout(timer);
            resolve(null);
          }
        }
      });
    }

    /**
     * 弹出 Screen 01 悬浮内嵌气泡卡片 (100% 挂载在 body 上，彻底防裁剪)
     * 支持查看账号清单、常变镜像关联操作、选定记录看详情以及录入新账号口令同屏联动
     */
    async function renderAutofillBubble(anchorInput: HTMLInputElement) {
      closeBubble();
      currentAnchorInput = anchorInput;
      bubbleOpenTimestamp = Date.now();

      const bubble = document.createElement('div');
      bubble.className = 'mantra-bubble-container';
      bubble.id = 'mantra-autofill-bubble';

      // 阻止气泡内部点击冒泡到 document 触发关闭
      bubble.addEventListener('click', (e) => e.stopPropagation());
      bubble.addEventListener('mousedown', (e) => e.stopPropagation());

      // 查询会话状态、本站点真实已存账号与当前主题 (带超时与兜底保障)
      let [sessionRes, accountsRes, themeRes] = await Promise.all([
        safeSendMessage<{ data?: { session_state?: string; ttl_remaining?: number; canary?: string } }>({ action: 'QUERY_SESSION' }, 600),
        safeSendMessage<{ accounts?: Array<{ username: string; version: number; rulePreset: string; tag?: string; serviceKey?: string }> }>({
          action: 'GET_ACCOUNTS_FOR_DOMAIN',
          payload: { domain: currentDomain, title: document.title }
        }, 600),
        safeSendMessage<{ theme?: string }>({ action: 'GET_THEME' }, 300),
      ]);

      const currentTheme = themeRes?.theme === 'dark' ? 'dark' : 'light';
      bubble.setAttribute('data-theme', currentTheme);

      let isUnlocked = sessionRes?.data?.session_state === 'unlocked';
      let ttlMinutes = Math.floor((sessionRes?.data?.ttl_remaining || 0) / 60);
      let canaryText = sessionRes?.data?.canary ? `[${sessionRes.data.canary}]` : '待计算';
      let accounts = accountsRes?.accounts || [];

      // 气泡内部导航状态
      let currentView: 'main' | 'manifest' = 'main';
      let selectedAccountIndex = 0;
      let isNewAccountMode = accounts.length === 0;

      function renderBubbleContent() {
        if (currentView === 'manifest') {
          renderManifestView();
        } else {
          renderMainView();
        }
      }

      function updateFooter() {
        const footerEl = bubble.querySelector('#bubble-footer');
        if (footerEl) {
          footerEl.innerHTML = `
            <div class="mantra-telemetry-item">
              <span>TTL: <span class="mantra-telemetry-highlight">${isUnlocked ? `${ttlMinutes}m` : '待就绪'}</span></span>
            </div>
            <div>•</div>
            <div class="mantra-telemetry-item">
              <span>金丝雀: <span class="mantra-telemetry-primary">${canaryText}</span></span>
            </div>
            <div>•</div>
            <div>零存储派生</div>
          `;
        }
        const statusText = bubble.querySelector('#bubble-status-text');
        const pulseDot = bubble.querySelector('#bubble-pulse-dot');
        if (statusText) statusText.textContent = isUnlocked ? '已就绪' : '待输入';
        if (pulseDot) {
          (pulseDot as HTMLElement).style.cssText = isUnlocked ? '' : 'background-color: #94a3b8; box-shadow: none;';
        }
      }

      function renderMainView() {
        const selectedAcc = accounts[selectedAccountIndex] || accounts[0];

        let accountsListHtml = '';
        if (accounts.length > 0) {
          accountsListHtml = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <span style="font-size: 11px; font-weight: 600; color: #64748b;">本站已存账号 (${accounts.length})</span>
              <button type="button" class="mantra-bubble-header-btn" id="bubble-btn-toggle-add" style="padding: 2px 6px;">
                ${isNewAccountMode ? '📋 查看已有账号' : '+ 录入新账号'}
              </button>
            </div>
            ${!isNewAccountMode ? `
              <div class="mantra-cards-list">
                ${accounts.map((acc, idx) => `
                  <div class="mantra-card ${idx === selectedAccountIndex ? 'active' : ''}" data-idx="${idx}" style="cursor: pointer;">
                    <div class="mantra-card-strip"></div>
                    <div class="mantra-card-left">
                      <div class="mantra-card-user-row">
                        <span class="mantra-card-username">${acc.username}</span>
                        <span class="mantra-card-badge">${acc.tag || 'v' + acc.version}</span>
                      </div>
                      <div class="mantra-card-sub-row">
                        <span class="mantra-rule-preset">${acc.rulePreset || 'standard-16'} (v${acc.version})</span>
                      </div>
                    </div>
                    <div class="mantra-card-right">
                      <span style="font-size: 10px; color: ${idx === selectedAccountIndex ? '#0d9488' : '#94a3b8'}; font-weight: 600;">
                        ${idx === selectedAccountIndex ? '✓ 选定' : '点击查看'}
                      </span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          `;
        }

        let detailOrAddHtml = '';
        if (isNewAccountMode || accounts.length === 0) {
          // 录入新账号模式：账号名、版本、规则与记忆口令同屏出现联动
          detailOrAddHtml = `
            <div class="bubble-account-detail-box">
              <div style="font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 2px;">
                ⚡ 录入新账号并秒级派生
              </div>
              <div>
                <input type="text" id="bubble-new-user" class="mantra-bubble-input" placeholder="输入账号或邮箱 (如 user@domain.com)" autocomplete="off" />
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <select id="bubble-new-rule" class="mantra-bubble-input" style="flex: 2; padding: 4px 6px; font-size: 10.5px;">
                  <option value="standard-16">16位标准 (字母+数字+符号)</option>
                  <option value="secure-20">20位高强 (高熵防破)</option>
                  <option value="super-32">32位极端安全</option>
                  <option value="alphanumeric-16">16位无符号 (纯字母数字)</option>
                  <option value="pin-6">6位数字 PIN</option>
                </select>
                <div class="bubble-ver-stepper" style="flex: 1; justify-content: flex-end;">
                  <span style="font-size: 10.5px; color: #64748b;">版本:</span>
                  <button type="button" class="bubble-ver-btn" id="bubble-btn-new-ver-down">-</button>
                  <span id="bubble-new-ver-val" style="font-size: 11px; font-weight: 700; min-width: 14px; text-align: center;">1</span>
                  <button type="button" class="bubble-ver-btn" id="bubble-btn-new-ver-up">+</button>
                </div>
              </div>
              <!-- 记忆口令输入行 (同屏联动) -->
              <div class="mantra-inline-unlock-header" style="margin-top: 2px;">
                <span class="mantra-inline-title">🔑 记忆口令 (零存储)</span>
                <span class="mantra-inline-canary" id="bubble-new-canary-badge">--------</span>
              </div>
              <div class="mantra-inline-input-wrap">
                <input
                  type="password"
                  id="bubble-new-mantra"
                  class="mantra-bubble-input"
                  placeholder="${isUnlocked ? '已就绪 (可留空沿用，或输入新口令)...' : '输入记忆口令，回车派生并填入...'}"
                  autocomplete="off"
                />
                <button type="button" class="mantra-bubble-btn-eye" id="bubble-new-eye">👁️</button>
              </div>
              <div style="display: flex; gap: 6px; margin-top: 4px;">
                <button type="button" class="mantra-bubble-btn-unlock" id="bubble-btn-save-and-fill" style="flex: 2;">
                  💾 保存账号并填充
                </button>
                <button type="button" class="mantra-bubble-header-btn" id="bubble-btn-quick-fill-only" style="flex: 1; padding: 6px 4px; font-weight: 600;">
                  ⚡ 仅填入
                </button>
              </div>
            </div>
          `;
        } else if (selectedAcc) {
          // 选择旧记录详情模式：点击记录后展开详情，引导输入口令（若在15分钟内则直接就绪），再出现填入按钮
          detailOrAddHtml = `
            <div class="bubble-account-detail-box">
              <div class="bubble-detail-meta-row">
                <span class="bubble-detail-user">👤 选定: <strong>${selectedAcc.username}</strong></span>
                <div class="bubble-ver-stepper">
                  <span style="font-size: 10px; color: #64748b;">版本:</span>
                  <button type="button" class="bubble-ver-btn" id="bubble-btn-acc-ver-down">-</button>
                  <span id="bubble-acc-ver-val" style="font-size: 11px; font-weight: 700; min-width: 14px; text-align: center;">v${selectedAcc.version}</span>
                  <button type="button" class="bubble-ver-btn" id="bubble-btn-acc-ver-up">+</button>
                </div>
              </div>
              <div style="font-size: 10px; color: #64748b;">
                规则: <span style="font-family: var(--mantra-font-mono);">${selectedAcc.rulePreset || 'standard-16'}</span>
                ${selectedAcc.serviceKey ? ` · 标识: <strong>${selectedAcc.serviceKey}</strong>` : ''}
              </div>
              <!-- 口令状态与输入引导 -->
              ${isUnlocked ? `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 6px; background: rgba(13, 148, 136, 0.1); border-radius: 6px; font-size: 10.5px; color: #0d9488;">
                  <span>🟢 记忆口令已就绪 (15分钟有效)</span>
                  <span class="mantra-inline-canary">${canaryText}</span>
                </div>
              ` : `
                <div>
                  <div class="mantra-inline-unlock-header">
                    <span class="mantra-inline-title">🔑 输入记忆口令</span>
                    <span class="mantra-inline-canary" id="bubble-old-canary-badge">--------</span>
                  </div>
                  <div class="mantra-inline-input-wrap">
                    <input
                      type="password"
                      id="bubble-old-mantra"
                      class="mantra-bubble-input"
                      placeholder="输入记忆口令，回车即刻填入..."
                      autocomplete="off"
                    />
                    <button type="button" class="mantra-bubble-btn-eye" id="bubble-old-eye">👁️</button>
                  </div>
                </div>
              `}
              <!-- 填入按钮 (展示详情后再出现) -->
              <button type="button" class="mantra-bubble-btn-unlock" id="bubble-btn-fill-selected" style="margin-top: 4px;">
                ⚡ 立即填入网页
              </button>
            </div>
          `;
        }

        const bodyContainer = bubble.querySelector('#bubble-body-container');
        if (bodyContainer) {
          bodyContainer.innerHTML = `
            ${accountsListHtml}
            ${detailOrAddHtml}
          `;
          bindMainEvents();
        }
      }

      async function renderManifestView() {
        const bodyContainer = bubble.querySelector('#bubble-body-container');
        if (!bodyContainer) return;

        bodyContainer.innerHTML = `
          <div class="bubble-manifest-view">
            <div style="display: flex; gap: 6px; align-items: center;">
              <button type="button" class="mantra-bubble-header-btn" id="bubble-btn-back-main" style="padding: 4px 8px; font-weight: 600;">
                ← 返回
              </button>
              <input type="text" id="bubble-manifest-search" class="bubble-manifest-search-input" placeholder="搜索已保存的站点或账号..." />
            </div>
            <div id="bubble-manifest-items" style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
              <div style="text-align: center; color: #94a3b8; font-size: 11px; padding: 12px;">加载账号清单中...</div>
            </div>
          </div>
        `;

        bubble.querySelector('#bubble-btn-back-main')?.addEventListener('click', () => {
          currentView = 'main';
          renderBubbleContent();
        });

        const manifestRes = await safeSendMessage<{ groups?: Array<{ domain: string; unicodeDomain: string; serviceKey?: string; accounts: any[] }> }>({
          action: 'GET_ALL_MANIFEST'
        }, 800);

        const groups = manifestRes?.groups || [];
        const itemsContainer = bubble.querySelector('#bubble-manifest-items');
        if (!itemsContainer) return;

        function renderGroupCards(filterText = '') {
          if (!itemsContainer) return;
          const query = filterText.trim().toLowerCase();
          const filtered = groups.filter((g) => {
            if (!query) return true;
            return (
              g.domain.toLowerCase().includes(query) ||
              g.unicodeDomain.toLowerCase().includes(query) ||
              (g.serviceKey && g.serviceKey.toLowerCase().includes(query)) ||
              g.accounts.some((a) => a.username.toLowerCase().includes(query))
            );
          });

          if (filtered.length === 0) {
            itemsContainer.innerHTML = `
              <div style="text-align: center; color: #94a3b8; font-size: 11px; padding: 10px;">
                未搜索到匹配的站点记录
              </div>
            `;
            return;
          }

          itemsContainer.innerHTML = filtered.map((g) => {
            const isCurrent = g.domain.toLowerCase() === currentDomain.toLowerCase();
            return `
              <div class="bubble-manifest-group-card">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="display: flex; align-items: center; gap: 5px; overflow: hidden;">
                    <span style="font-size: 13px;">🌐</span>
                    <span style="font-weight: 700; font-size: 11.5px; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${g.domain}">
                      ${g.unicodeDomain}
                    </span>
                    ${g.serviceKey ? `<span style="font-size: 9px; background: rgba(13, 148, 136, 0.15); color: #0d9488; padding: 1px 4px; border-radius: 3px;">🏷️ ${g.serviceKey}</span>` : ''}
                  </div>
                  <div style="display: flex; gap: 4px; flex-shrink: 0;">
                    ${!isCurrent ? `
                      <button type="button" class="mantra-bubble-header-btn btn-link-this-group" data-domain="${g.domain}" data-name="${g.unicodeDomain}" style="padding: 2px 6px; color: #0d9488; border-color: #0d9488;" title="将当前网页关联为此站点的镜像">
                        🔗 关联当前页
                      </button>
                    ` : '<span style="font-size: 9px; color: #0d9488; font-weight: 600;">当前站点</span>'}
                  </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                  ${g.accounts.map((a) => `
                    <span style="font-size: 10px; background: #e2e8f0; color: #334155; padding: 1px 5px; border-radius: 3px;">
                      ${a.username} (v${a.version})
                    </span>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('');

          // 绑定关联按钮
          itemsContainer.querySelectorAll('.btn-link-this-group').forEach((btn) => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              const sourceDomain = (btn as HTMLElement).dataset.domain || '';
              const sourceName = (btn as HTMLElement).dataset.name || sourceDomain;
              if (!sourceDomain) return;

              (btn as HTMLButtonElement).disabled = true;
              (btn as HTMLButtonElement).textContent = '⏳ 关联中...';

              const res = await safeSendMessage<{ status?: string; ok?: boolean }>({
                action: 'LINK_DOMAIN',
                payload: { targetDomain: currentDomain, sourceDomain }
              }, 800);

              if (res?.ok || res?.status === 'ok') {
                showInPageToast(`🎉 成功将当前网页关联至 [${sourceName}]！`);
                // 重新读取本站账号
                const refreshed = await safeSendMessage<{ accounts?: any[] }>({
                  action: 'GET_ACCOUNTS_FOR_DOMAIN',
                  payload: { domain: currentDomain, title: document.title }
                }, 600);
                accounts = refreshed?.accounts || [];
                selectedAccountIndex = 0;
                isNewAccountMode = false;
                currentView = 'main';
                renderBubbleContent();
              } else {
                showInPageToast('❌ 关联失败');
                (btn as HTMLButtonElement).disabled = false;
                (btn as HTMLButtonElement).textContent = '🔗 关联当前页';
              }
            });
          });
        }

        renderGroupCards('');

        const searchInput = bubble.querySelector<HTMLInputElement>('#bubble-manifest-search');
        searchInput?.addEventListener('input', () => {
          renderGroupCards(searchInput.value);
        });
      }

      function bindMainEvents() {
        // 卡片点选切换选定账号
        bubble.querySelectorAll('.mantra-card').forEach((card) => {
          card.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt((card as HTMLElement).dataset.idx || '0', 10);
            selectedAccountIndex = idx;
            isNewAccountMode = false;
            renderMainView();
          });
        });

        // 切换录入新账号
        bubble.querySelector('#bubble-btn-toggle-add')?.addEventListener('click', (e) => {
          e.stopPropagation();
          isNewAccountMode = !isNewAccountMode;
          renderMainView();
        });

        // 版本调整
        let currentVer = accounts[selectedAccountIndex]?.version || 1;
        const verValEl = bubble.querySelector('#bubble-acc-ver-val');
        bubble.querySelector('#bubble-btn-acc-ver-down')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (currentVer > 1) {
            currentVer--;
            if (verValEl) verValEl.textContent = `v${currentVer}`;
            if (accounts[selectedAccountIndex]) accounts[selectedAccountIndex].version = currentVer;
          }
        });
        bubble.querySelector('#bubble-btn-acc-ver-up')?.addEventListener('click', (e) => {
          e.stopPropagation();
          currentVer++;
          if (verValEl) verValEl.textContent = `v${currentVer}`;
          if (accounts[selectedAccountIndex]) accounts[selectedAccountIndex].version = currentVer;
        });

        // 新增账号的版本调整
        let newVer = 1;
        const newVerValEl = bubble.querySelector('#bubble-new-ver-val');
        bubble.querySelector('#bubble-btn-new-ver-down')?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (newVer > 1) {
            newVer--;
            if (newVerValEl) newVerValEl.textContent = String(newVer);
          }
        });
        bubble.querySelector('#bubble-btn-new-ver-up')?.addEventListener('click', (e) => {
          e.stopPropagation();
          newVer++;
          if (newVerValEl) newVerValEl.textContent = String(newVer);
        });

        // 旧记录口令输入与明文切换
        const oldMantraInput = bubble.querySelector<HTMLInputElement>('#bubble-old-mantra');
        const oldCanaryBadge = bubble.querySelector<HTMLElement>('#bubble-old-canary-badge');
        const oldEyeBtn = bubble.querySelector<HTMLButtonElement>('#bubble-old-eye');

        if (oldMantraInput) {
          setTimeout(() => oldMantraInput.focus(), 60);
          oldMantraInput.addEventListener('input', async (e) => {
            e.stopPropagation();
            const val = oldMantraInput.value.trim();
            if (val && oldCanaryBadge) {
              oldCanaryBadge.textContent = await computeCanary(val);
            } else if (oldCanaryBadge) {
              oldCanaryBadge.textContent = '--------';
            }
          });
          oldMantraInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              bubble.querySelector<HTMLButtonElement>('#bubble-btn-fill-selected')?.click();
            }
          });
        }

        let isOldEyeOpen = false;
        oldEyeBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!oldMantraInput) return;
          isOldEyeOpen = !isOldEyeOpen;
          oldMantraInput.type = isOldEyeOpen ? 'text' : 'password';
          oldEyeBtn.textContent = isOldEyeOpen ? '🔒' : '👁️';
        });

        // 选定账号的“填入网页”按钮点击事件
        bubble.querySelector('#bubble-btn-fill-selected')?.addEventListener('click', async (e) => {
          e.stopPropagation();
          const targetAcc = accounts[selectedAccountIndex] || accounts[0];
          if (!targetAcc) return;

          let mantraToUse = '';
          if (oldMantraInput && oldMantraInput.value.trim()) {
            mantraToUse = oldMantraInput.value.trim();
            // 顺带解锁后台 15 分钟会话
            await safeSendMessage({ action: 'UNLOCK_SESSION', payload: { mantra: mantraToUse } }, 600);
            isUnlocked = true;
          }

          chrome.runtime.sendMessage({
            action: 'DERIVE_CREDENTIAL',
            payload: {
              domain: currentDomain,
              serviceKey: targetAcc.serviceKey,
              username: targetAcc.username,
              version: targetAcc.version,
              rule_preset: targetAcc.rulePreset,
            },
          }, (res) => {
            const pwd = res?.data?.derived_password;
            if (pwd) {
              injectInputValue(anchorInput, pwd);
              showInPageToast(`⚡ 已成功填入 [${targetAcc.username}] 强密码`);
              closeBubble();
            } else {
              showInPageToast('❌ 派生失败: ' + (res?.message || '请先输入记忆口令'));
              if (oldMantraInput) oldMantraInput.focus();
            }
          });
        });

        // 录入新账号保存并填充
        const newMantraInput = bubble.querySelector<HTMLInputElement>('#bubble-new-mantra');
        const newCanaryBadge = bubble.querySelector<HTMLElement>('#bubble-new-canary-badge');
        const newEyeBtn = bubble.querySelector<HTMLButtonElement>('#bubble-new-eye');

        if (newMantraInput) {
          newMantraInput.addEventListener('input', async (e) => {
            e.stopPropagation();
            const val = newMantraInput.value.trim();
            if (val && newCanaryBadge) {
              newCanaryBadge.textContent = await computeCanary(val);
            } else if (newCanaryBadge) {
              newCanaryBadge.textContent = '--------';
            }
          });
        }

        let isNewEyeOpen = false;
        newEyeBtn?.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!newMantraInput) return;
          isNewEyeOpen = !isNewEyeOpen;
          newMantraInput.type = isNewEyeOpen ? 'text' : 'password';
          newEyeBtn.textContent = isNewEyeOpen ? '🔒' : '👁️';
        });

        const doSaveAndFill = async (shouldSave = true) => {
          const newUserInput = bubble.querySelector<HTMLInputElement>('#bubble-new-user');
          const newRuleSelect = bubble.querySelector<HTMLSelectElement>('#bubble-new-rule');
          const username = newUserInput?.value.trim() || '';

          if (!username) {
            showInPageToast('请输入账号名称');
            newUserInput?.focus();
            return;
          }

          const mantraVal = newMantraInput?.value.trim() || '';
          if (mantraVal) {
            await safeSendMessage({ action: 'UNLOCK_SESSION', payload: { mantra: mantraVal } }, 600);
            isUnlocked = true;
          }

          const rulePreset = newRuleSelect?.value || 'standard-16';

          chrome.runtime.sendMessage({
            action: 'DERIVE_CREDENTIAL',
            payload: {
              domain: currentDomain,
              username,
              version: newVer,
              rule_preset: rulePreset,
            },
          }, async (deriveRes) => {
            const pwd = deriveRes?.data?.derived_password;
            if (pwd) {
              injectInputValue(anchorInput, pwd);
              showInPageToast(`⚡ 已成功填入 [${username}] 密码`);

              if (shouldSave) {
                await safeSendMessage({
                  action: 'SAVE_ACCOUNT',
                  payload: {
                    domain: currentDomain,
                    account: {
                      username,
                      version: newVer,
                      rulePreset,
                      tag: 'Personal',
                    },
                  },
                }, 600);
              }
              closeBubble();
            } else {
              showInPageToast('❌ 派生失败: ' + (deriveRes?.message || '请先输入记忆口令'));
              if (newMantraInput) newMantraInput.focus();
            }
          });
        };

        bubble.querySelector('#bubble-btn-save-and-fill')?.addEventListener('click', (e) => {
          e.stopPropagation();
          doSaveAndFill(true);
        });

        bubble.querySelector('#bubble-btn-quick-fill-only')?.addEventListener('click', (e) => {
          e.stopPropagation();
          doSaveAndFill(false);
        });
      }

      // 气泡骨架
      bubble.innerHTML = `
        <div class="mantra-bubble-header">
          <div class="mantra-bubble-domain-tag">
            <span class="mantra-domain-icon">${ICONS.lock}</span>
            <span class="mantra-domain-title" id="bubble-domain-title">${displayDomain}</span>
          </div>
          <div class="mantra-bubble-header-actions">
            <button type="button" class="mantra-bubble-header-btn" id="bubble-btn-manifest" title="查看所有站点账号清单">📋 记录清单</button>
            <button type="button" class="mantra-bubble-header-btn" id="bubble-btn-link-site" title="关联当前网页到已有站点">🔗 关联</button>
          </div>
          <div class="mantra-session-status">
            <span class="mantra-pulse-dot" id="bubble-pulse-dot" style="${isUnlocked ? '' : 'background-color: #94a3b8; box-shadow: none;'}"></span>
            <span id="bubble-status-text">${isUnlocked ? '已就绪' : '待输入'}</span>
          </div>
        </div>

        <div id="bubble-body-container" style="display: flex; flex-direction: column; gap: 6px; margin: 6px 0;"></div>

        <div class="mantra-bubble-footer" id="bubble-footer">
          <div class="mantra-telemetry-item">
            <span>TTL: <span class="mantra-telemetry-highlight">${isUnlocked ? `${ttlMinutes}m` : '待就绪'}</span></span>
          </div>
          <div>•</div>
          <div class="mantra-telemetry-item">
            <span>金丝雀: <span class="mantra-telemetry-primary">${canaryText}</span></span>
          </div>
          <div>•</div>
          <div>零存储派生</div>
        </div>
      `;

      // 挂载到 body
      document.body.appendChild(bubble);
      activeBubbleEl = bubble;
      updateBubblePosition();

      // 绑定顶栏快捷按钮
      bubble.querySelector('#bubble-btn-manifest')?.addEventListener('click', (e) => {
        e.stopPropagation();
        currentView = currentView === 'manifest' ? 'main' : 'manifest';
        renderBubbleContent();
      });

      bubble.querySelector('#bubble-btn-link-site')?.addEventListener('click', (e) => {
        e.stopPropagation();
        currentView = 'manifest';
        renderBubbleContent();
      });

      // 首次渲染主视图
      renderBubbleContent();
    }

    /**
     * 智能对齐并在单个密码输入框挂载黑曜密符微标
     */
    function attachBadgeToInput(input: HTMLInputElement) {
      if (
        input.dataset.mantraBound === 'true' ||
        input.dataset.mantraInternal === 'true' ||
        input.closest('#mantra-autofill-bubble') ||
        input.closest('.mantra-bubble-container') ||
        input.classList.contains('mantra-bubble-input') ||
        input.id.startsWith('bubble-')
      ) {
        return;
      }
      input.dataset.mantraBound = 'true';

      const parent = input.parentElement;
      if (!parent) return;

      // 确保父级容器具备定位基准
      const computedPos = window.getComputedStyle(parent).position;
      if (computedPos === 'static') {
        parent.style.position = 'relative';
      }

      // 检查右侧是否已存在网站自带的明文眼睛或清空按钮
      const hasSiblingButton = Array.from(parent.children).some(
        (el) =>
          el !== input &&
          (el.tagName === 'BUTTON' ||
            el.tagName === 'SVG' ||
            el.tagName === 'I' ||
            el.getAttribute('role') === 'button' ||
            el.className.toString().toLowerCase().includes('eye') ||
            el.className.toString().toLowerCase().includes('suffix') ||
            el.className.toString().toLowerCase().includes('icon'))
      );

      const rightOffset = hasSiblingButton ? 38 : 10;

      const badge = document.createElement('button');
      badge.className = 'mantra-in-input-badge';
      badge.type = 'button';
      badge.title = '密诀 MantraKey - 一键安全派生与自动填充';
      badge.setAttribute('data-mantra-badge', 'true');
      badge.innerHTML = ICONS.key;

      // 强制垂直绝对居中，避免错位
      badge.style.position = 'absolute';
      badge.style.top = '50%';
      badge.style.transform = 'translateY(-50%)';
      badge.style.right = `${rightOffset}px`;
      badge.style.zIndex = '2147483645';
      badge.style.pointerEvents = 'auto';

      // 允许 mousedown 冒泡但不抢夺输入框焦点
      badge.addEventListener('mousedown', (e) => {
        e.stopPropagation();
      });

      let lastBadgeToggleTime = 0;
      const handleBadgeTrigger = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const now = Date.now();
        if (now - lastBadgeToggleTime < 250) {
          return;
        }
        lastBadgeToggleTime = now;

        if (activeBubbleEl) {
          closeBubble();
        } else {
          renderAutofillBubble(input);
        }
      };

      // 在捕获阶段 (capture: true) 拦截，彻底抵御 Vue/React/Naive UI 等现代 SPA 框架的事件拦截
      badge.addEventListener('click', handleBadgeTrigger, true);
      badge.addEventListener('pointerup', handleBadgeTrigger, true);

      parent.appendChild(badge);
    }

    /**
     * 扫描并绑定页面内所有密码输入框 (严格过滤扩展自身内嵌组件)
     */
    function scanAndBindInputs() {
      const passwordInputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
      passwordInputs.forEach((input) => {
        if (
          input.dataset.mantraInternal === 'true' ||
          input.closest('#mantra-autofill-bubble') ||
          input.closest('.mantra-bubble-container') ||
          input.classList.contains('mantra-bubble-input') ||
          input.id.startsWith('bubble-')
        ) {
          return;
        }
        attachBadgeToInput(input);
      });
    }

    // ==========================================================
    // 方案 A：网页内高质感快捷控制台浮层 (In-Page Quick Modal)
    // ==========================================================
    let activeQuickModalEl: HTMLElement | null = null;

    function closeQuickModal() {
      if (activeQuickModalEl) {
        activeQuickModalEl.classList.remove('visible');
        const modal = activeQuickModalEl;
        setTimeout(() => {
          if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
          }
        }, 220);
        activeQuickModalEl = null;
      }
    }

    function openQuickModal() {
      if (activeQuickModalEl) {
        closeQuickModal();
        return;
      }
      closeBubble();

      const overlay = document.createElement('div');
      overlay.id = 'mantra-quick-modal-overlay';
      overlay.className = 'mantra-quick-modal-overlay';

      overlay.innerHTML = `
        <div class="mantra-quick-modal-backdrop"></div>
        <div class="mantra-quick-modal-card">
          <iframe
            src="${chrome.runtime.getURL('popup.html')}"
            class="mantra-quick-modal-iframe"
            allow="clipboard-read; clipboard-write"
          ></iframe>
        </div>
      `;

      document.body.appendChild(overlay);
      activeQuickModalEl = overlay;

      requestAnimationFrame(() => {
        overlay.classList.add('visible');
      });

      overlay.querySelector('.mantra-quick-modal-backdrop')?.addEventListener('click', () => {
        closeQuickModal();
      });
    }

    // 监听 ESC 键关闭全局浮层
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeQuickModalEl) {
        closeQuickModal();
      }
    });

    // 监听来自浮层 iframe 的指令 (包含关闭与平滑高度自适应)
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'MANTRA_CLOSE_OVERLAY') {
        closeQuickModal();
      } else if (e.data?.type === 'MANTRA_POPUP_RESIZE' && typeof e.data.height === 'number') {
        const iframe = activeQuickModalEl?.querySelector<HTMLIFrameElement>('.mantra-quick-modal-iframe');
        if (iframe) {
          const maxAvailableHeight = window.innerHeight - 48;
          iframe.style.height = `${Math.min(e.data.height, maxAvailableHeight)}px`;
        }
      }
    });

    // 全局点击监听：点击外部关闭输入框小气泡 (附带 250ms 打开防抖冷却，防止同一点击冒泡秒关)
    document.addEventListener('click', (e) => {
      if (Date.now() - bubbleOpenTimestamp < 250) {
        return;
      }
      const target = e.target as HTMLElement;
      if (
        activeBubbleEl &&
        !activeBubbleEl.contains(target) &&
        !target.closest?.('.mantra-in-input-badge') &&
        !target.closest?.('[data-mantra-badge="true"]')
      ) {
        closeBubble();
      }
    }, true);

    // 页面滚动与尺寸变化时自适应气泡定位
    window.addEventListener('scroll', () => updateBubblePosition(), { passive: true });
    window.addEventListener('resize', () => updateBubblePosition());

    // 监听来自 Background / Popup 的指令
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.action === 'TOGGLE_QUICK_PANEL') {
        if (activeQuickModalEl) {
          closeQuickModal();
        } else {
          openQuickModal();
        }
        sendResponse({ status: 'ok' });
        return true;
      }
      if (msg.action === 'AUTOFILL_CREDENTIALS') {
        const success = autofillPageCredentials(msg.username, msg.password);
        if (success) {
          showInPageToast('⚡ 凭据已成功自动填充！');
          closeQuickModal();
        }
        sendResponse({ success });
        return true;
      }
      return false;
    });

    // 首次扫描并启动 DOM 变动监听器
    scanAndBindInputs();
    const observer = new MutationObserver(() => scanAndBindInputs());
    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true,
    });
  },
});
