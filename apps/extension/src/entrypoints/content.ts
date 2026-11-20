import '../styles/content.css';
import { extractDomain, toUnicodeDomain } from '../utils/domain';
import { computeCanary } from '../utils/crypto';

export default defineContentScript({
  matches: ['*://*/*'],
  main() {
    console.log('[MantraKey Ext] Content Script 挂载就绪');

    const rawDomain = extractDomain(window.location.href) || window.location.hostname;
    const currentDomain = rawDomain;
    const displayDomain = toUnicodeDomain(rawDomain);

    let activeBubbleEl: HTMLElement | null = null;
    let activeBannerEl: HTMLElement | null = null;
    let activeToastEl: HTMLElement | null = null;
    let currentAnchorInput: HTMLInputElement | null = null;

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
     * 弹出 Screen 01 悬浮内嵌气泡卡片 (100% 挂载在 body 上，彻底防裁剪)
     */
    async function renderAutofillBubble(anchorInput: HTMLInputElement) {
      closeBubble();
      currentAnchorInput = anchorInput;

      const bubble = document.createElement('div');
      bubble.className = 'mantra-bubble-container';
      bubble.id = 'mantra-autofill-bubble';

      // 查询会话状态与本站点真实已存账号
      const [sessionRes, accountsRes] = await Promise.all([
        new Promise<{ data?: { session_state?: string; ttl_remaining?: number; canary?: string } }>((res) => {
          chrome.runtime.sendMessage({ action: 'QUERY_SESSION' }, res);
        }),
        new Promise<{ accounts?: Array<{ username: string; version: number; rulePreset: string; tag?: string }> }>((res) => {
          chrome.runtime.sendMessage({ action: 'GET_ACCOUNTS_FOR_DOMAIN', payload: { domain: currentDomain } }, res);
        }),
      ]);

      const isUnlocked = sessionRes?.data?.session_state === 'unlocked';
      const ttlMinutes = Math.floor((sessionRes?.data?.ttl_remaining || 0) / 60);
      const canaryText = sessionRes?.data?.canary ? `[${sessionRes.data.canary}]` : '未解锁';
      const accounts = accountsRes?.accounts || [];

      let accountsHtml = '';
      if (!isUnlocked) {
        accountsHtml = `
          <div class="mantra-inline-unlock-box">
            <div class="mantra-inline-unlock-header">
              <span class="mantra-inline-title">🔑 就地解锁主口令</span>
              <span class="mantra-inline-canary" id="bubble-canary-badge">--------</span>
            </div>
            <div class="mantra-inline-input-wrap">
              <input
                type="password"
                id="bubble-input-mantra"
                class="mantra-bubble-input"
                data-mantra-internal="true"
                data-mantra-bound="true"
                placeholder="输入主口令，回车立即解锁并填充..."
                autocomplete="off"
                spellcheck="false"
              />
              <button type="button" class="mantra-bubble-btn-eye" id="bubble-btn-eye" title="切换明文">👁️</button>
            </div>
            <button type="button" class="mantra-bubble-btn-unlock" id="bubble-btn-unlock">
              ⚡ 立即解锁会话并自动填充
            </button>
          </div>
        `;
      } else if (accounts.length === 0) {
        accountsHtml = `
          <div class="mantra-inline-unlock-box">
            <div style="font-size: 11px; color: #94a3b8; line-height: 1.4;">
              当前站点 <strong style="color: #00f0ff;">${displayDomain}</strong> 暂未保存账号，直接录入即可秒级填充：
            </div>
            <div style="display: flex; gap: 6px; margin-top: 4px;">
              <input type="text" id="bubble-quick-user" class="mantra-bubble-input" placeholder="输入账号或邮箱 (如 user@domain.com)" />
              <button type="button" class="mantra-bubble-btn-unlock" id="bubble-quick-fill-btn" style="width: auto; padding: 0 14px; white-space: nowrap;">⚡ 派生并填充</button>
            </div>
          </div>
        `;
      } else {
        accountsHtml = accounts.map((acc, idx) => `
          <div class="mantra-card ${idx === 0 ? 'active' : ''}" data-user="${acc.username}" data-version="${acc.version}" data-rule="${acc.rulePreset}">
            <div class="mantra-card-strip"></div>
            <div class="mantra-card-left">
              <div class="mantra-card-user-row">
                <span class="mantra-card-username">${acc.username}</span>
                <span class="mantra-card-badge ${acc.tag === 'Work' ? 'mantra-badge-enterprise' : 'mantra-badge-primary'}">${acc.tag || 'v' + acc.version}</span>
              </div>
              <div class="mantra-card-sub-row">
                <span class="mantra-rule-preset">${acc.rulePreset} (v${acc.version})</span>
                <span class="mantra-mask-preview">••••••••</span>
              </div>
            </div>
            <div class="mantra-card-right">
              <button type="button" class="mantra-shortcut-pill">⚡ 填充</button>
            </div>
          </div>
        `).join('');
      }

      bubble.innerHTML = `
        <div class="mantra-bubble-header">
          <div class="mantra-bubble-domain-tag">
            <span class="mantra-domain-icon">${ICONS.lock}</span>
            <span class="mantra-domain-title">${displayDomain}</span>
          </div>
          <div class="mantra-session-status">
            <span class="mantra-pulse-dot" style="${isUnlocked ? '' : 'background-color: #ef4444; box-shadow: none;'}"></span>
            <span>${isUnlocked ? 'Session Active' : 'Locked'}</span>
          </div>
        </div>

        <div class="mantra-cards-list">
          ${accountsHtml}
        </div>

        <div class="mantra-bubble-footer">
          <div class="mantra-telemetry-item">
            <span>TTL: <span class="mantra-telemetry-highlight">${isUnlocked ? `${ttlMinutes}m` : '锁定'}</span></span>
          </div>
          <div>•</div>
          <div class="mantra-telemetry-item">
            <span>金丝雀: <span class="mantra-telemetry-primary">${canaryText}</span></span>
          </div>
          <div>•</div>
          <div>零存储派生</div>
        </div>
      `;

      // 永远直接挂载到 body，彻底防止任意容器的 overflow: hidden 裁剪
      document.body.appendChild(bubble);
      activeBubbleEl = bubble;
      updateBubblePosition();

      // 阻止气泡内部点击冒泡到 document 触发关闭
      bubble.addEventListener('click', (e) => e.stopPropagation());
      bubble.addEventListener('mousedown', (e) => e.stopPropagation());

      // 1. 就地解锁事件绑定
      const bubbleInput = bubble.querySelector<HTMLInputElement>('#bubble-input-mantra');
      const bubbleEye = bubble.querySelector<HTMLButtonElement>('#bubble-btn-eye');
      const bubbleCanary = bubble.querySelector<HTMLElement>('#bubble-canary-badge');
      const bubbleUnlockBtn = bubble.querySelector<HTMLButtonElement>('#bubble-btn-unlock');

      if (bubbleInput && bubbleUnlockBtn) {
        setTimeout(() => bubbleInput.focus(), 50);

        bubbleInput.addEventListener('input', async (e) => {
          e.stopPropagation();
          const val = bubbleInput.value;
          if (val && bubbleCanary) {
            const canary = await computeCanary(val);
            bubbleCanary.textContent = canary;
          } else if (bubbleCanary) {
            bubbleCanary.textContent = '--------';
          }
        });

        bubbleInput.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            bubbleUnlockBtn.click();
          }
        });

        let isEyeOpen = false;
        bubbleEye?.addEventListener('click', (e) => {
          e.stopPropagation();
          isEyeOpen = !isEyeOpen;
          bubbleInput.type = isEyeOpen ? 'text' : 'password';
          bubbleEye.textContent = isEyeOpen ? '🔒' : '👁️';
        });

        bubbleUnlockBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const val = bubbleInput.value.trim();
          if (!val) {
            showInPageToast('请输入主口令');
            bubbleInput.focus();
            return;
          }

          chrome.runtime.sendMessage({
            action: 'UNLOCK_SESSION',
            payload: { mantra: val },
          }, async (res) => {
            if (res?.status === 'ok') {
              showInPageToast(`⚡ 会话已就地解锁！金丝雀: [${res.session?.canary || ''}]`);
              if (accounts.length > 0) {
                const firstAcc = accounts[0];
                chrome.runtime.sendMessage({
                  action: 'DERIVE_CREDENTIAL',
                  payload: {
                    domain: currentDomain,
                    username: firstAcc.username,
                    version: firstAcc.version,
                    rule_preset: firstAcc.rulePreset,
                  },
                }, (deriveRes) => {
                  const pwd = deriveRes?.data?.derived_password;
                  if (pwd) {
                    injectInputValue(anchorInput, pwd);
                    showInPageToast(`⚡ 已秒级填入 [${firstAcc.username}] 密码`);
                    closeBubble();
                  } else {
                    renderAutofillBubble(anchorInput);
                  }
                });
              } else {
                renderAutofillBubble(anchorInput);
              }
            } else {
              showInPageToast('❌ 解锁失败: ' + (res?.message || '未知错误'));
            }
          });
        });
      }

      // 2. 无账号时就地快速录入并填充绑定
      const quickUser = bubble.querySelector<HTMLInputElement>('#bubble-quick-user');
      const quickBtn = bubble.querySelector<HTMLButtonElement>('#bubble-quick-fill-btn');
      if (quickUser && quickBtn) {
        setTimeout(() => quickUser.focus(), 50);

        const triggerQuickFill = () => {
          const user = quickUser.value.trim() || 'default';
          chrome.runtime.sendMessage({
            action: 'DERIVE_CREDENTIAL',
            payload: {
              domain: currentDomain,
              username: user,
              version: 1,
              rule_preset: 'standard-16',
            },
          }, (deriveRes) => {
            const pwd = deriveRes?.data?.derived_password;
            if (pwd) {
              injectInputValue(anchorInput, pwd);
              showInPageToast(`⚡ 已派生并填入 [${user}] 强密码`);
              chrome.runtime.sendMessage({
                action: 'SAVE_ACCOUNT',
                payload: {
                  domain: currentDomain,
                  account: {
                    username: user,
                    version: 1,
                    rulePreset: 'standard-16',
                    tag: 'Personal',
                  },
                },
              });
              closeBubble();
            }
          });
        };

        quickBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          triggerQuickFill();
        });

        quickUser.addEventListener('keydown', (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            triggerQuickFill();
          }
        });
      }

      // 绑定卡片点选填充事件
      const cardEls = bubble.querySelectorAll<HTMLElement>('.mantra-card');
      cardEls.forEach((card) => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          const user = card.dataset.user;
          const ver = parseInt(card.dataset.version || '1', 10);
          const rule = card.dataset.rule || 'standard-16';

          if (!user) return;

          chrome.runtime.sendMessage({
            action: 'DERIVE_CREDENTIAL',
            payload: {
              domain: currentDomain,
              username: user,
              version: ver,
              rule_preset: rule,
            },
          }, (res) => {
            const pwd = res?.data?.derived_password;
            if (pwd) {
              injectInputValue(anchorInput, pwd);
              showInPageToast(`⚡ 已成功派生并填入 [${user}] 强密码`);
              closeBubble();
            } else {
              showInPageToast('❌ 派生失败: ' + (res?.message || '未知错误'));
            }
          });
        });
      });
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
      badge.innerHTML = ICONS.key;

      // 强制垂直绝对居中，避免错位
      badge.style.position = 'absolute';
      badge.style.top = '50%';
      badge.style.transform = 'translateY(-50%)';
      badge.style.right = `${rightOffset}px`;
      badge.style.zIndex = '2147483645';

      // 阻止 mousedown 抢夺输入框焦点
      badge.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });

      // 仅在完整的 click 事件中触发气泡展开/折叠，彻底防止按下出现、松开关闭的双触发问题
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (activeBubbleEl) {
          closeBubble();
        } else {
          renderAutofillBubble(input);
        }
      });

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

    // 全局点击监听：点击外部关闭输入框小气泡
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (
        activeBubbleEl &&
        !activeBubbleEl.contains(target) &&
        !target.closest('.mantra-in-input-badge')
      ) {
        closeBubble();
      }
    });

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
