/**
 * 密诀 MantraKey Android - 移动端主控台与自愈中枢
 *
 * 1. 核心密码派生置顶：纯端侧确定性 PBKDF2 + HKDF-Expand 密码学生成引擎
 * 2. 系统注入服务状态：感知系统自动填充服务 (AutofillService) 与穿透键盘 (PenetrationIME)
 * 3. 首次启动新手引导：清晰阐述接管自动填充与穿透键盘的设计初衷与操作指南
 * 4. GitHub Releases 自动在线更新服务
 * 5. Debug 变体原生挂载 @lylyuanliang/agent-feedback-client 悬浮胶囊与「📦 本地包」扩展
 * 6. Release 变体通过 AST 常量折叠达成 100% Zero-DCE 自动剥离
 */

import { fetchLatestRelease, compareVersions, CURRENT_APP_VERSION, type VersionMetadata } from './services/updateService';
import { deriveSitePassword, computeCanary, RULE_PRESETS, type RulePreset } from './services/cryptoEngine';
import {
  getSavedWebDAVConfig,
  saveWebDAVConfig,
  getLocalManifest,
  getSyncStatusInfo,
  recordDomainRule,
  recordDomainAccount,
  removeDomainRule,
  removeDomainAccount,
  testWebDAVConnection,
  performWebDAVSync,
  type WebDAVConfig
} from './services/webdavSyncService';

/**
 * 移动端主口令内存会话管理器 (15分钟 TTL 安全生命周期)
 */
let sessionMasterMantra = '';
let sessionMantraTimer: any = null;

export function getSessionMasterMantra(): string {
  const topInput = document.getElementById('input-mantra') as HTMLInputElement | null;
  if (topInput && topInput.value.trim()) {
    sessionMasterMantra = topInput.value.trim();
  }
  return sessionMasterMantra;
}

export function setSessionMasterMantra(mantra: string) {
  sessionMasterMantra = mantra.trim();
  const topInput = document.getElementById('input-mantra') as HTMLInputElement | null;
  if (topInput && topInput.value !== mantra) {
    topInput.value = mantra;
    // 触发金丝雀校验更新
    const tagCanary = document.getElementById('tag-canary');
    if (tagCanary) {
      if (mantra.trim()) {
        computeCanary(mantra).then((canary) => {
          tagCanary.textContent = `校验码: ${canary}`;
        });
      } else {
        tagCanary.textContent = '校验码: --';
      }
    }
  }
  if (sessionMantraTimer) clearTimeout(sessionMantraTimer);
  if (sessionMasterMantra) {
    sessionMantraTimer = setTimeout(() => {
      sessionMasterMantra = '';
      if (topInput) topInput.value = '';
      showToast('⏳ 15分钟会话保护期已过，主口令已自动隐蔽');
      (window as any).__refreshWebDAVRulesList?.();
    }, 15 * 60 * 1000);
  }
}

/**
 * RFC 3492 Punycode 解码器，用于将 xn-- 开头的国际化域名还原为人类可读的 Unicode 中文
 */
function decodePunycodePart(input: string): string {
  const maxInt = 2147483647;
  const base = 36;
  const tMin = 1;
  const tMax = 26;
  const skew = 38;
  const damp = 700;
  const initialBias = 72;
  const initialN = 128;
  const delimiter = '-';

  function adapt(delta: number, numPoints: number, firstTime: boolean): number {
    let k = 0;
    delta = firstTime ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) {
      delta = Math.floor(delta / (base - tMin));
    }
    return Math.floor(k + ((base - tMin + 1) * delta) / (delta + skew));
  }

  function decodeDigit(cp: number): number {
    return cp - 48 < 10 ? cp - 22 : cp - 65 < 26 ? cp - 65 : cp - 97 < 26 ? cp - 97 : base;
  }

  const output: number[] = [];
  const basic = input.lastIndexOf(delimiter);
  let n = initialN;
  let i = 0;
  let bias = initialBias;

  if (basic > 0) {
    for (let j = 0; j < basic; ++j) {
      output.push(input.charCodeAt(j));
    }
  }

  let index = basic > 0 ? basic + 1 : 0;
  while (index < input.length) {
    const oldi = i;
    let w = 1;
    for (let k = base; ; k += base) {
      if (index >= input.length) return input;
      const digit = decodeDigit(input.charCodeAt(index++));
      if (digit >= base) return input;
      if (digit > Math.floor((maxInt - i) / w)) return input;
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      if (w > Math.floor(maxInt / (base - t))) return input;
      w *= base - t;
    }
    const out = output.length + 1;
    bias = adapt(i - oldi, out, oldi === 0);
    if (Math.floor(i / out) > maxInt - n) return input;
    n += Math.floor(i / out);
    i %= out;
    output.splice(i++, 0, n);
  }
  return String.fromCodePoint(...output);
}

export function toUnicodeDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') return '';
  return domain
    .split('.')
    .map((part) => (part.startsWith('xn--') ? decodePunycodePart(part.slice(4)) : part))
    .join('.');
}

/**
 * 优雅的全局浮动 Toast 通知
 */
function showToast(message: string, duration = 2500): void {
  const existing = document.querySelector('.toast-container');
  if (existing) {
    existing.remove();
  }
  const toast = document.createElement('div');
  toast.className = 'toast-container';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// 页面 DOM 骨架初始化
function mountApp() {
  const appRoot = document.getElementById('app');
  if (!appRoot || appRoot.hasAttribute('data-mounted')) return;
  appRoot.setAttribute('data-mounted', 'true');

  appRoot.innerHTML = `
    <div class="mobile-container">
      <!-- 顶部品牌导航 -->
      <header class="app-header">
        <div class="brand-row">
          <div class="logo-box">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14c-2.76 0-5-2.24-5-5s2.24-5 5-5c2.42 0 4.44 1.72 4.9 4h6.1l2 2-2 2h-2l-1 1-1-1h-2.1c-.46 2.28-2.48 4-4.9 4zm0-8C5.34 6 4 7.34 4 9s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </div>
          <div class="brand-info">
            <h1 class="brand-title">密诀</h1>
            <span class="brand-sub">零存储物理架构 · 确定性无状态密码引擎</span>
          </div>
          <span class="enclave-badge">ENCLAVE</span>
        </div>
      </header>

      <main class="app-main">
        <!-- 1. 已存站点与密码速查清单 (有记录时置顶作为一等公民核心区) -->
        <section class="card vault-card" id="card-vault-list">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="card-title">📚 已存站点与密码速查</span>
              <span class="vault-count-badge" id="count-synced-rules">0</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button type="button" class="btn-vault-header-action btn-jump-to-create" id="btn-scroll-to-create" title="录入新站点与账号">➕ 录入新账号</button>
              <button type="button" class="btn-vault-header-action" id="btn-refresh-vault" title="刷新列表">🔄 刷新</button>
            </div>
          </div>

          <div class="vault-body">
            <!-- 实时快速搜索行 -->
            <div class="vault-search-row">
              <span class="vault-search-icon">🔍</span>
              <input
                type="text"
                id="input-vault-search"
                class="vault-search-input"
                placeholder="搜索域名、别名、用户名或规则..."
              />
              <button type="button" class="btn-clear-vault-search" id="btn-clear-vault-search" style="display: none;">✕</button>
            </div>

            <!-- 站点清单容器 (默认展开，触手可及) -->
            <div class="vault-sites-list" id="synced-rules-list">
              <!-- 动态渲染站点卡片 -->
            </div>
          </div>
        </section>

        <!-- 2. 录入新账号与确定性密码现场派生 (位于清单下方) -->
        <section class="card crypto-card" id="card-generator">
          <div class="card-header">
            <span class="card-title">➕ 录入新账号与现场派生</span>
            <span class="badge-dim">本地纯计算 · 零存储</span>
          </div>

          <div class="crypto-body">
            <!-- 目标站点/账户标识 -->
            <div class="input-group">
              <label class="input-label" for="input-domain">目标站点或服务域名 <span class="required-star">*</span></label>
              <input
                type="text"
                id="input-domain"
                class="cyber-input"
                placeholder="例如: github.com, weixin, 13800138000..."
                value=""
              />
              <div class="domain-chips">
                <span class="chip-item" data-val="github.com">GitHub</span>
                <span class="chip-item" data-val="google.com">Google</span>
                <span class="chip-item" data-val="alipay.com">支付宝</span>
                <span class="chip-item" data-val="wechat">微信</span>
                <span class="chip-item" data-val="apple.com">Apple ID</span>
              </div>
            </div>

            <!-- 别名与账号 (可选) -->
            <div class="input-row-flex">
              <div class="input-group" style="flex: 1;">
                <label class="input-label" for="input-domain-alias">站点别名/备注名 (可选)</label>
                <input
                  type="text"
                  id="input-domain-alias"
                  class="cyber-input"
                  placeholder="例如: 三毛专线、公司内部"
                  value=""
                />
              </div>
              <div class="input-group" style="flex: 1;">
                <label class="input-label" for="input-domain-user">登录账号/用户名 (可选)</label>
                <input
                  type="text"
                  id="input-domain-user"
                  class="cyber-input"
                  placeholder="例如: admin / 手机号"
                  value=""
                />
              </div>
            </div>

            <!-- 规则预设选择 -->
            <div class="input-group">
              <label class="input-label">密码规则规格</label>
              <div class="preset-selector" id="preset-selector">
                <button type="button" class="preset-btn active" data-preset="standard-16">16位标准</button>
                <button type="button" class="preset-btn" data-preset="secure-20">20位高强</button>
                <button type="button" class="preset-btn" data-preset="super-32">32位极高</button>
                <button type="button" class="preset-btn" data-preset="alphanumeric-16">无符号</button>
                <button type="button" class="preset-btn" data-preset="pin-6">6位PIN</button>
              </div>
            </div>

            <!-- 主口令输入 -->
            <div class="input-group">
              <div class="input-header">
                <label class="input-label" for="input-mantra">主口令 (Master Mantra)</label>
                <span class="canary-tag" id="tag-canary" title="金丝雀防手抖校验码">校验码: --</span>
              </div>
              <div class="input-with-action">
                <input
                  type="password"
                  id="input-mantra"
                  class="cyber-input"
                  placeholder="输入您的唯一记忆口令..."
                  autocomplete="off"
                  value=""
                />
                <button type="button" class="btn-toggle-visibility" id="btn-toggle-pwd" title="点击显示明文">🙈</button>
              </div>
            </div>

            <!-- 派生结果卡片 -->
            <div class="derived-result-box">
              <div class="derived-meta">
                <span class="derived-label">计算派生密码</span>
                <span class="derived-strength" id="text-rule-desc">字母+数字+特殊符号 (16位)</span>
              </div>
              <div class="derived-output-row">
                <span class="derived-val" id="text-derived-pwd" style="color: #64748b; font-size: 13px;">等待输入主口令与目标站点...</span>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <button type="button" class="btn-save-rule" id="btn-save-rule" title="保存此规则与账号至多端清单">
                    📌 记住账号规则
                  </button>
                  <button type="button" class="btn-copy-pwd" id="btn-copy-pwd" title="一键复制" disabled>
                    📋 复制
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 3. WebDAV 多端端到端加密同步面板 (E2EE + CRDT) -->
        <section class="card sync-card" id="card-webdav-sync">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="card-title">🌐 WebDAV 多端加密同步</span>
              <span class="sync-status-tag" id="badge-sync-status">未同步</span>
            </div>
            <button type="button" class="btn-toggle-card" id="btn-toggle-sync-config">⚙️ 配置</button>
          </div>

          <div class="sync-body">
            <!-- 同步摘要与立即同步行 -->
            <div class="sync-summary-row">
              <div class="sync-info-col">
                <span class="sync-sub-title">端到端 AES-256-GCM 密文同步</span>
                <span class="sync-last-time" id="text-sync-last-time">上次同步: 尚未同步</span>
              </div>
              <button type="button" class="btn-sync-now" id="btn-sync-now">
                🔄 立即双向同步
              </button>
            </div>

            <!-- WebDAV 配置表单 (折叠面板) -->
            <div class="sync-config-form" id="sync-config-form" style="display: none;">
              <div class="input-group">
                <label class="input-label" for="input-webdav-url">WebDAV 服务器根地址</label>
                <input
                  type="text"
                  id="input-webdav-url"
                  class="cyber-input"
                  placeholder="例如: https://dav.jianguoyun.com/dav/mantra-key"
                  value=""
                />
              </div>

              <div class="sync-form-row">
                <div class="input-group" style="flex: 1;">
                  <label class="input-label" for="input-webdav-user">用户名 / 账号</label>
                  <input
                    type="text"
                    id="input-webdav-user"
                    class="cyber-input"
                    placeholder="WebDAV 账号"
                    value=""
                  />
                </div>

                <div class="input-group" style="flex: 1;">
                  <label class="input-label" for="input-webdav-pass">应用密码 / Token</label>
                  <input
                    type="password"
                    id="input-webdav-pass"
                    class="cyber-input"
                    placeholder="应用独立密码"
                    value=""
                  />
                </div>
              </div>

              <div class="input-group">
                <label class="input-label" for="input-webdav-file">远程密文文件名</label>
                <input
                  type="text"
                  id="input-webdav-file"
                  class="cyber-input"
                  placeholder="mantra_sync.mkey"
                  value="mantra_sync.mkey"
                />
              </div>

              <div class="input-group">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <label class="input-label" for="input-webdav-sync-pass">同步加密密码 (可选端到端 E2EE)</label>
                  <span style="font-size: 11px; color: var(--text-dim);">留空存明文 · 填写享金融级加密</span>
                </div>
                <div class="input-with-action">
                  <input
                    type="password"
                    id="input-webdav-sync-pass"
                    class="cyber-input"
                    placeholder="可留空，或输入独立同步密码..."
                    value=""
                  />
                  <button type="button" class="btn-toggle-visibility" id="btn-toggle-sync-pass" title="显隐密码">🙈</button>
                </div>
              </div>

              <div class="sync-actions-row">
                <button type="button" class="btn-secondary" id="btn-test-webdav">
                  ⚡ 测试连通性
                </button>
                <button type="button" class="btn-secondary" id="btn-save-webdav">
                  💾 保存配置
                </button>
              </div>

              <div class="sync-hint-box">
                💡 <strong>独立同步加密保障：</strong>支持设置独立同步加密密码。若填写，清单在本地使用 AES-256-GCM 强加密后再上传至云端；若留空，则以明文信封存储。多端支持无缝平滑自适应合并与升格。
              </div>
            </div>
          </div>
        </section>

        <!-- 2. 系统注入服务状态面板 -->
        <section class="card status-card">
          <div class="card-header">
            <span class="card-title">📱 系统注入服务状态</span>
            <button type="button" class="btn-help-guide" id="btn-open-onboarding">📖 开启指引说明</button>
          </div>

          <div class="service-item">
            <div class="service-meta">
              <div class="service-title-row">
                <span class="service-name">系统级自动填充服务 (AutofillService)</span>
                <span class="service-status-badge checking" id="badge-autofill">检测中...</span>
              </div>
              <div class="service-desc">适配标准网页与常规 App 账号密码框自动浮动建议，免切屏复制</div>
            </div>
            <button type="button" class="btn-service" id="btn-open-autofill-settings">去设置 ➔</button>
          </div>

          <div class="service-item">
            <div class="service-meta">
              <div class="service-title-row">
                <span class="service-name">辅助穿透输入法 (PenetrationIME)</span>
                <span class="service-status-badge checking" id="badge-ime">检测中...</span>
              </div>
              <div class="service-desc">100% 击穿银行、证券等金融 App 防填充与自绘安全键盘</div>
            </div>
            <button type="button" class="btn-service" id="btn-open-ime-settings">去设置 ➔</button>
          </div>
        </section>

        <!-- 3. 在线更新卡片 (GitHub Releases) -->
        <section class="card update-card" id="update-card">
          <div class="card-header">
            <span class="card-title">🚀 版本与在线更新</span>
            <span class="update-status" id="update-status-badge">就绪</span>
          </div>

          <div class="update-body">
            <div class="version-compare-row">
              <div class="ver-col">
                <span class="ver-label">当前运行版本</span>
                <span class="ver-val" id="text-current-ver">v${CURRENT_APP_VERSION}</span>
              </div>
              <div class="ver-arrow">➔</div>
              <div class="ver-col">
                <span class="ver-label">线上最新版本</span>
                <span class="ver-val" id="text-latest-ver">检测中...</span>
              </div>
            </div>

            <!-- 检测到更新时的详情区域 -->
            <div class="update-detail-box" id="update-detail-box" style="display: none;">
              <div class="release-title" id="text-release-title"></div>
              <div class="release-notes" id="text-release-notes"></div>
              <div class="download-progress-row" id="download-progress-row" style="display: none;">
                <div class="progress-bar-bg">
                  <div class="progress-bar-fill" id="update-progress-fill" style="width: 0%;"></div>
                </div>
                <div class="progress-text" id="update-progress-text">0%</div>
              </div>
              <button type="button" class="btn-update-action" id="btn-action-update">
                ⚡ 立即下载并安装新版本
              </button>
            </div>

            <button type="button" class="btn-check-update" id="btn-check-update">
              🔄 检查线上更新 (GitHub Releases)
            </button>
          </div>
        </section>
      </main>

      <footer class="app-footer">
        <span>密诀 MantraKey · 移动端端侧中枢</span>
        <span>无明文存储 · 安全确定性</span>
      </footer>

      <!-- 4. 初次启动引导 / 权限配置说明模态弹窗 -->
      <div class="onboarding-overlay" id="onboarding-overlay" style="display: none;">
        <div class="onboarding-modal">
          <div class="onboarding-header">
            <div class="onboarding-title">🛡️ 密诀 Android 权限与注入配置指引</div>
            <button type="button" class="btn-close-onboarding" id="btn-close-onboarding">✕</button>
          </div>

          <div class="onboarding-content">
            <div class="guide-item">
              <div class="guide-q">Q: 为什么要开启「系统级自动填充服务」？</div>
              <div class="guide-a">
                <strong>免切屏、免复制：</strong>在任意网页或 App 账号密码框点击时，Android 系统将自动弹出密诀安全气泡，一键派生填充。<br/>
                <strong>物理级隐私安全：</strong>密诀是纯本地计算、零网络传输，不会保存您的明文密码，开启系统填充既便捷又杜绝剪贴板被其他应用窥探窃取的风险。
              </div>
              <button type="button" class="btn-guide-action" id="btn-guide-autofill">前往系统设置开启自动填充 ➔</button>
            </div>

            <div class="guide-item">
              <div class="guide-q">Q: 为什么要开启「辅助穿透输入法」？</div>
              <div class="guide-a">
                <strong>攻克银行与金融 App 防御：</strong>国内各大手机银行、证券投资、政务类 App 普遍禁用了系统自动填充，并弹出自绘防截屏键盘，导致常规密码软件全部失效。<br/>
                <strong>无坚不摧的安全注入：</strong>密诀专属辅助键盘直接将安全派生密码嵌入在键盘上层。遇到强防御 App 时，只需在输入法选择器中切换到密诀键盘，即可一键将生成的密码打穿并注入输入框！
              </div>
              <button type="button" class="btn-guide-action" id="btn-guide-ime">前往输入法设置开启穿透键盘 ➔</button>
            </div>
          </div>

          <div class="onboarding-footer">
            <button type="button" class="btn-confirm-onboarding" id="btn-confirm-onboarding">
              ✅ 我已知晓，开启安全体验
            </button>
          </div>
        </div>
      </div>

      <!-- 就地同步加密密码输入弹窗 (当检测到云端加密而本地未配置时触发) -->
      <div id="sync-pass-modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 10000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
        <div style="background: #111827; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 12px; padding: 20px; width: 90%; max-width: 380px; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
            <span style="font-size: 20px;">🔐</span>
            <h3 style="margin: 0; font-size: 16px; color: #fff; font-weight: 600;">云端数据已加密</h3>
          </div>
          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 16px;">
            检测到 WebDAV 云端备份已启用端到端加密（0x01 密文信封），请输入同步加密密码以完成数据解密与双向合并：
          </p>
          <div class="input-group" style="margin-bottom: 20px;">
            <input
              type="password"
              id="modal-sync-pass-input"
              class="cyber-input"
              placeholder="输入此云端备份的同步加密密码..."
              style="width: 100%; box-sizing: border-box;"
            />
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" class="btn-secondary" id="btn-modal-sync-cancel" style="padding: 8px 16px; font-size: 13px;">取消</button>
            <button type="button" class="btn-primary" id="btn-modal-sync-confirm" style="padding: 8px 18px; font-size: 13px; background: linear-gradient(135deg, #10b981 0%, #00f0ff 100%); color: #0b0f17; font-weight: 600; border: none; border-radius: 6px;">确认解密并保存</button>
          </div>
        </div>
      </div>
    </div>
  `;

  setupPasswordGenerator();
  setupWebDAVSync();
  setupServiceButtons();
  setupUpdateChecker();
  checkFirstLaunchGuide();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}

// -----------------------------------------------------------------------------
// 1. 密码生成与现场派生引擎交互
// -----------------------------------------------------------------------------
function setupPasswordGenerator() {
  const inputMantra = document.getElementById('input-mantra') as HTMLInputElement | null;
  const inputDomain = document.getElementById('input-domain') as HTMLInputElement | null;
  const inputDomainAlias = document.getElementById('input-domain-alias') as HTMLInputElement | null;
  const inputDomainUser = document.getElementById('input-domain-user') as HTMLInputElement | null;
  const btnTogglePwd = document.getElementById('btn-toggle-pwd') as HTMLButtonElement | null;
  const tagCanary = document.getElementById('tag-canary') as HTMLElement | null;
  const textDerivedPwd = document.getElementById('text-derived-pwd') as HTMLElement | null;
  const textRuleDesc = document.getElementById('text-rule-desc') as HTMLElement | null;
  const btnCopyPwd = document.getElementById('btn-copy-pwd') as HTMLButtonElement | null;
  const btnSaveRule = document.getElementById('btn-save-rule') as HTMLButtonElement | null;
  const presetSelector = document.getElementById('preset-selector');
  const chipItems = document.querySelectorAll('.chip-item');

  let currentPreset: RulePreset = 'standard-16';

  // 绑定头部快捷跳转录入按钮
  document.getElementById('btn-scroll-to-create')?.addEventListener('click', () => {
    document.getElementById('card-generator')?.scrollIntoView({ behavior: 'smooth' });
    inputDomain?.focus();
  });

  // 计算并渲染派生结果
  async function compute() {
    if (!inputDomain || !textDerivedPwd) return;
    const mantra = (inputMantra?.value || getSessionMasterMantra() || '').trim();
    const domain = (inputDomain.value || '').trim();
    const user = (inputDomainUser?.value || '').trim();

    // 更新金丝雀校验码
    if (tagCanary) {
      if (mantra) {
        const canary = await computeCanary(mantra);
        tagCanary.textContent = `校验码: ${canary}`;
      } else {
        tagCanary.textContent = '校验码: --';
      }
    }

    if (!mantra || !domain) {
      if (!mantra && !domain) {
        textDerivedPwd.textContent = '等待输入主口令与目标站点...';
      } else if (!mantra) {
        textDerivedPwd.textContent = '等待输入主口令...';
      } else {
        textDerivedPwd.textContent = '等待输入目标标识...';
      }
      textDerivedPwd.style.color = '#64748b';
      if (btnCopyPwd) btnCopyPwd.disabled = true;
      return;
    }

    try {
      const derived = await deriveSitePassword(mantra, domain, user, 1, currentPreset);
      textDerivedPwd.textContent = derived;
      textDerivedPwd.style.color = '#00f0ff';
      if (btnCopyPwd) btnCopyPwd.disabled = false;
    } catch (e: any) {
      textDerivedPwd.textContent = '派生失败: ' + (e?.message || '未知错误');
      textDerivedPwd.style.color = '#ef4444';
      if (btnCopyPwd) btnCopyPwd.disabled = true;
    }
  }

  // 绑定输入变动与主口令内存缓存
  inputMantra?.addEventListener('input', () => {
    if (inputMantra.value) {
      setSessionMasterMantra(inputMantra.value);
    }
    compute();
  });

  inputDomainUser?.addEventListener('input', compute);
  inputDomainAlias?.addEventListener('input', compute);

  inputDomain?.addEventListener('input', () => {
    const dVal = (inputDomain.value || '').trim().toLowerCase();
    const manifest = getLocalManifest();
    if (dVal && manifest.domains[dVal]) {
      const savedPreset = manifest.domains[dVal].rulePreset as RulePreset;
      if (savedPreset && RULE_PRESETS[savedPreset] && savedPreset !== currentPreset) {
        currentPreset = savedPreset;
        presetSelector?.querySelectorAll('.preset-btn').forEach((b) => {
          if (b.getAttribute('data-preset') === savedPreset) {
            b.classList.add('active');
          } else {
            b.classList.remove('active');
          }
        });
        if (textRuleDesc) {
          textRuleDesc.textContent = RULE_PRESETS[savedPreset].description + ' (已匹配保存规则)';
        }
      }
      if (manifest.domains[dVal].displayName && inputDomainAlias && !inputDomainAlias.value) {
        inputDomainAlias.value = manifest.domains[dVal].displayName;
      }
    }
    compute();
  });

  // 切换密码显隐（规范：睁眼状态对应明文，闭眼状态对应密文）
  btnTogglePwd?.addEventListener('click', () => {
    if (!inputMantra) return;
    if (inputMantra.type === 'password') {
      inputMantra.type = 'text';
      btnTogglePwd.textContent = '👁️';
      btnTogglePwd.title = '点击隐藏口令';
    } else {
      inputMantra.type = 'password';
      btnTogglePwd.textContent = '🙈';
      btnTogglePwd.title = '点击显示明文';
    }
  });

  // 记住当前规则与账号至同步清单
  btnSaveRule?.addEventListener('click', () => {
    const dVal = (inputDomain?.value || '').trim();
    if (!dVal) {
      showToast('⚠️ 请先输入目标站点或服务域名（例如 github.com）');
      inputDomain?.focus();
      return;
    }
    const aliasVal = (inputDomainAlias?.value || '').trim();
    const userVal = (inputDomainUser?.value || '').trim();
    if (userVal) {
      recordDomainAccount(dVal, userVal, 1, currentPreset, aliasVal);
    } else {
      recordDomainRule(dVal, currentPreset, aliasVal);
    }
    btnSaveRule.textContent = '✅ 已记住！';
    (window as any).__refreshWebDAVRulesList?.();
    showToast(`🎉 成功保存站点 [${aliasVal || dVal}] 规则！`);
    setTimeout(() => {
      btnSaveRule.textContent = '📌 记住账号规则';
      document.getElementById('card-vault-list')?.scrollIntoView({ behavior: 'smooth' });
    }, 700);
  });

  // 绑定快速站点标签
  chipItems.forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = chip.getAttribute('data-val');
      if (val && inputDomain) {
        inputDomain.value = val;
        // 触发自动匹配规则
        const manifest = getLocalManifest();
        const dKey = val.toLowerCase();
        if (manifest.domains[dKey]) {
          const savedPreset = manifest.domains[dKey].rulePreset as RulePreset;
          if (savedPreset && RULE_PRESETS[savedPreset]) {
            currentPreset = savedPreset;
            presetSelector?.querySelectorAll('.preset-btn').forEach((b) => {
              if (b.getAttribute('data-preset') === savedPreset) {
                b.classList.add('active');
              } else {
                b.classList.remove('active');
              }
            });
            if (textRuleDesc) {
              textRuleDesc.textContent = RULE_PRESETS[savedPreset].description + ' (已匹配保存规则)';
            }
          }
        }
        compute();
      }
    });
  });

  // 绑定规格切换
  presetSelector?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const preset = target.getAttribute('data-preset') as RulePreset | null;
    if (preset && RULE_PRESETS[preset]) {
      currentPreset = preset;
      presetSelector.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
      target.classList.add('active');
      if (textRuleDesc) {
        textRuleDesc.textContent = RULE_PRESETS[preset].description;
      }
      compute();
    }
  });

  // 绑定复制按钮
  btnCopyPwd?.addEventListener('click', async () => {
    const pwd = textDerivedPwd?.textContent;
    if (!pwd || pwd.includes('...') || pwd.includes('失败') || pwd.includes('等待')) {
      return;
    }

    try {
      await navigator.clipboard.writeText(pwd);
      btnCopyPwd.textContent = '✅ 已复制！';
      btnCopyPwd.classList.add('copied');
      setTimeout(() => {
        btnCopyPwd.textContent = '📋 复制';
        btnCopyPwd.classList.remove('copied');
      }, 1500);
    } catch {
      alert('已派生密码: ' + pwd);
    }
  });

  // 初始计算
  compute();
}

// -----------------------------------------------------------------------------
// 2. WebDAV 端到端加密多端同步逻辑
// -----------------------------------------------------------------------------
function setupWebDAVSync() {
  const btnToggleConfig = document.getElementById('btn-toggle-sync-config');
  const syncConfigForm = document.getElementById('sync-config-form');
  const btnSyncNow = document.getElementById('btn-sync-now');
  const badgeSyncStatus = document.getElementById('badge-sync-status');
  const textSyncLastTime = document.getElementById('text-sync-last-time');

  const inputUrl = document.getElementById('input-webdav-url') as HTMLInputElement | null;
  const inputUser = document.getElementById('input-webdav-user') as HTMLInputElement | null;
  const inputPass = document.getElementById('input-webdav-pass') as HTMLInputElement | null;
  const inputFile = document.getElementById('input-webdav-file') as HTMLInputElement | null;
  const inputSyncPass = document.getElementById('input-webdav-sync-pass') as HTMLInputElement | null;
  const btnToggleSyncPass = document.getElementById('btn-toggle-sync-pass') as HTMLButtonElement | null;

  const btnTest = document.getElementById('btn-test-webdav');
  const btnSave = document.getElementById('btn-save-webdav');

  const btnToggleRules = document.getElementById('btn-toggle-rules-list');
  const syncedRulesList = document.getElementById('synced-rules-list');
  const arrowRules = document.getElementById('arrow-rules-list');
  const countRulesEl = document.getElementById('count-synced-rules');

  const inputMantra = document.getElementById('input-mantra') as HTMLInputElement | null;

  function normalizeJianguoyunUrl(url: string): string {
    const trimmed = (url || '').trim();
    if (/^https?:\/\/dav\.jianguoyun\.com\/dav\/?$/i.test(trimmed)) {
      return 'https://dav.jianguoyun.com/dav/mantra-key';
    }
    return trimmed;
  }

  // 载入保存的配置
  const cfg = getSavedWebDAVConfig();
  if (inputUrl) inputUrl.value = cfg.serverUrl || 'https://dav.jianguoyun.com/dav/mantra-key';
  if (inputUser) inputUser.value = cfg.username || '';
  if (inputPass) inputPass.value = cfg.password || '';
  if (inputFile) inputFile.value = cfg.remoteFileName || 'mantra_sync.mkey';
  if (inputSyncPass) inputSyncPass.value = cfg.syncPassword || '';

  btnToggleSyncPass?.addEventListener('click', () => {
    if (!inputSyncPass) return;
    const isPwd = inputSyncPass.type === 'password';
    inputSyncPass.type = isPwd ? 'text' : 'password';
    btnToggleSyncPass.textContent = isPwd ? '👀' : '🙈';
  });

  inputUrl?.addEventListener('blur', () => {
    if (inputUrl.value) {
      inputUrl.value = normalizeJianguoyunUrl(inputUrl.value);
    }
  });

  // 刷新状态与标签
  function refreshStatusView() {
    const info = getSyncStatusInfo();
    const manifest = getLocalManifest();
    const count = Object.keys(manifest.domains || {}).length;

    if (countRulesEl) countRulesEl.textContent = String(count);

    if (textSyncLastTime) {
      textSyncLastTime.textContent = info.lastSyncTime ? `上次同步: ${info.lastSyncTime}` : '上次同步: 尚未同步';
    }

    if (badgeSyncStatus) {
      badgeSyncStatus.className = 'sync-status-tag ' + (info.status || 'idle');
      if (info.status === 'success') {
        badgeSyncStatus.textContent = '🟢 已同步';
      } else if (info.status === 'syncing') {
        badgeSyncStatus.textContent = '🔄 同步中...';
      } else if (info.status === 'error') {
        badgeSyncStatus.textContent = '🔴 同步失败';
      } else {
        badgeSyncStatus.textContent = cfg.serverUrl ? '⚪ 待同步' : '⚪ 未配置';
      }
    }
  }

  const inputVaultSearch = document.getElementById('input-vault-search') as HTMLInputElement | null;
  const btnClearVaultSearch = document.getElementById('btn-clear-vault-search') as HTMLButtonElement | null;
  const btnRefreshVault = document.getElementById('btn-refresh-vault') as HTMLButtonElement | null;

  let vaultSearchKeyword = '';

  // 绑定速查清单搜索与刷新
  inputVaultSearch?.addEventListener('input', () => {
    vaultSearchKeyword = (inputVaultSearch.value || '').trim().toLowerCase();
    if (btnClearVaultSearch) {
      btnClearVaultSearch.style.display = vaultSearchKeyword ? 'block' : 'none';
    }
    renderRulesList();
  });

  btnClearVaultSearch?.addEventListener('click', () => {
    if (inputVaultSearch) inputVaultSearch.value = '';
    vaultSearchKeyword = '';
    if (btnClearVaultSearch) btnClearVaultSearch.style.display = 'none';
    renderRulesList();
    inputVaultSearch?.focus();
  });

  btnRefreshVault?.addEventListener('click', () => {
    renderRulesList();
    showToast('已刷新站点清单');
  });

  // 渲染规则清单
  function renderRulesList() {
    if (!syncedRulesList) return;
    const manifest = getLocalManifest();
    const allDomains = manifest.domains || {};
    let domainKeys = Object.keys(allDomains);

    if (countRulesEl) {
      countRulesEl.textContent = String(domainKeys.length);
    }

    // 搜索过滤逻辑
    if (vaultSearchKeyword) {
      domainKeys = domainKeys.filter((k) => {
        const item = allDomains[k];
        if (!item) return false;
        const unicodeDom = toUnicodeDomain(item.canonicalDomain).toLowerCase();
        const rawDom = (item.canonicalDomain || '').toLowerCase();
        const disp = (item.displayName || '').toLowerCase();
        const preset = (item.rulePreset || '').toLowerCase();
        const accs = Object.keys(item.accounts || {}).join(' ').toLowerCase();

        return (
          unicodeDom.includes(vaultSearchKeyword) ||
          rawDom.includes(vaultSearchKeyword) ||
          disp.includes(vaultSearchKeyword) ||
          preset.includes(vaultSearchKeyword) ||
          accs.includes(vaultSearchKeyword)
        );
      });
    }

    if (domainKeys.length === 0) {
      if (vaultSearchKeyword) {
        syncedRulesList.innerHTML = `
          <div class="vault-empty-state">
            <span class="empty-icon">🔍</span>
            <div class="empty-title">未找到匹配站点</div>
            <div class="empty-text">没有与 "${vaultSearchKeyword}" 匹配的域名或账号</div>
            <button type="button" class="btn-reset-search" id="btn-reset-search-empty">清空搜索词</button>
          </div>
        `;
        document.getElementById('btn-reset-search-empty')?.addEventListener('click', () => {
          if (inputVaultSearch) inputVaultSearch.value = '';
          vaultSearchKeyword = '';
          if (btnClearVaultSearch) btnClearVaultSearch.style.display = 'none';
          renderRulesList();
        });
      } else {
        syncedRulesList.innerHTML = `
          <div class="vault-empty-state">
            <span class="empty-icon">📂</span>
            <div class="empty-title">暂无已保存的站点与账号</div>
            <div class="empty-text">
              在下方录入新站点并点击「📌 记住账号规则」即可加入清单；<br/>
              或配置 WebDAV 一键双向同步即可同步全量密码库！
            </div>
            <button type="button" class="btn-quick-new-entry" id="btn-empty-create-site">➕ 立即录入新账号</button>
          </div>
        `;
        document.getElementById('btn-empty-create-site')?.addEventListener('click', () => {
          document.getElementById('card-generator')?.scrollIntoView({ behavior: 'smooth' });
          const inpDom = document.getElementById('input-domain') as HTMLInputElement | null;
          inpDom?.focus();
        });
      }
      return;
    }

    // 排序并渲染
    syncedRulesList.innerHTML = domainKeys
      .sort((a, b) => {
        const itemA = allDomains[a];
        const itemB = allDomains[b];
        return (itemB.updatedAt || 0) - (itemA.updatedAt || 0);
      })
      .map((k) => {
        const item = allDomains[k];
        const unicodeDomain = toUnicodeDomain(item.canonicalDomain);
        const hasCustomAlias = Boolean(item.displayName && item.displayName !== item.canonicalDomain && item.displayName !== unicodeDomain);
        const displayTitle = hasCustomAlias ? item.displayName : unicodeDomain;
        const subDomainText = hasCustomAlias ? unicodeDomain : (unicodeDomain !== item.canonicalDomain ? item.canonicalDomain : '');
        const presetObj = RULE_PRESETS[item.rulePreset as RulePreset] || RULE_PRESETS['standard-16'];
        const presetName = presetObj?.name || item.rulePreset;

        const accounts = Object.values(item.accounts || {}).filter((a) => !a.isDeleted);
        const safeDomainId = item.canonicalDomain.replace(/[^a-zA-Z0-9_-]/g, '_');

        let accountsHtml = '';
        if (accounts.length > 0) {
          accountsHtml = accounts.map((acc, accIdx) => {
            const accSafeId = `${safeDomainId}_acc_${accIdx}`;
            return `
              <div class="vault-account-row">
                <div class="acc-meta-left">
                  <span class="acc-user-badge">👤 ${acc.username}</span>
                  <span class="acc-ver-badge">v${acc.version || 1}</span>
                  ${acc.serviceKey ? `<span class="acc-tag-badge">🏷️ ${acc.serviceKey}</span>` : ''}
                </div>
                <div class="acc-actions-right">
                  <button type="button" class="btn-acc-action btn-load-to-panel" data-domain="${item.canonicalDomain}" data-user="${acc.username}" data-preset="${item.rulePreset}" data-name="${item.displayName || ''}" title="载入到下方表单">
                    ⚡ 载入
                  </button>
                  <button type="button" class="btn-acc-action btn-copy-site-pwd" data-domain="${item.canonicalDomain}" data-user="${acc.username}" data-ver="${acc.version || 1}" data-preset="${item.rulePreset}" data-title="${displayTitle}" data-unlock="unlock-${accSafeId}" title="直接计算并复制密码">
                    📋 复制密码
                  </button>
                  <button type="button" class="btn-acc-action btn-peek-site-pwd" data-target="peek-${accSafeId}" data-domain="${item.canonicalDomain}" data-user="${acc.username}" data-ver="${acc.version || 1}" data-preset="${item.rulePreset}" data-unlock="unlock-${accSafeId}" title="查看计算密码">
                    👁️
                  </button>
                </div>
              </div>
              <!-- 专属内联主口令现场解锁条 (会话未解锁时点击复制或查看就地展开) -->
              <div class="vault-inline-unlock-row" id="unlock-${accSafeId}" style="display: none;">
                <div class="unlock-header-tip">
                  <span>🔑 输入主口令派生此记录</span>
                  <span class="unlock-canary-badge" id="canary-unlock-${accSafeId}">校验码: --</span>
                </div>
                <div class="unlock-input-wrap">
                  <input type="password" class="unlock-mantra-input cyber-input" id="input-unlock-${accSafeId}" placeholder="输入主口令..." autocomplete="off" />
                  <button type="button" class="btn-toggle-unlock-pwd" data-input="input-unlock-${accSafeId}" title="显隐">🙈</button>
                  <button type="button" class="btn-submit-unlock" data-input="input-unlock-${accSafeId}" data-domain="${item.canonicalDomain}" data-user="${acc.username}" data-ver="${acc.version || 1}" data-preset="${item.rulePreset}" data-target-peek="peek-${accSafeId}" data-unlock="unlock-${accSafeId}">派生查看</button>
                  <button type="button" class="btn-submit-unlock-copy" data-input="input-unlock-${accSafeId}" data-domain="${item.canonicalDomain}" data-user="${acc.username}" data-ver="${acc.version || 1}" data-preset="${item.rulePreset}" data-title="${displayTitle}" data-unlock="unlock-${accSafeId}">派生复制</button>
                  <button type="button" class="btn-cancel-unlock" data-unlock="unlock-${accSafeId}">✕</button>
                </div>
              </div>
              <div class="vault-peek-pwd-bar" id="peek-${accSafeId}" style="display: none;">
                <span class="peek-pwd-val">••••••••••••••••</span>
                <span class="peek-pwd-timer">5秒后自动隐蔽</span>
              </div>
            `;
          }).join('');
        } else {
          const defaultSafeId = `${safeDomainId}_default`;
          accountsHtml = `
            <div class="vault-account-row">
              <div class="acc-meta-left">
                <span class="acc-user-badge default-key">默认凭据 (未指定账号)</span>
              </div>
              <div class="acc-actions-right">
                <button type="button" class="btn-acc-action btn-load-to-panel" data-domain="${item.canonicalDomain}" data-user="" data-preset="${item.rulePreset}" data-name="${item.displayName || ''}" title="载入到下方表单">
                  ⚡ 载入
                </button>
                <button type="button" class="btn-acc-action btn-copy-site-pwd" data-domain="${item.canonicalDomain}" data-user="" data-ver="1" data-preset="${item.rulePreset}" data-title="${displayTitle}" data-unlock="unlock-${defaultSafeId}" title="直接计算并复制密码">
                  📋 复制密码
                </button>
                <button type="button" class="btn-acc-action btn-peek-site-pwd" data-target="peek-${defaultSafeId}" data-domain="${item.canonicalDomain}" data-user="" data-ver="1" data-preset="${item.rulePreset}" data-unlock="unlock-${defaultSafeId}" title="查看计算密码">
                  👁️
                </button>
              </div>
            </div>
            <!-- 专属内联主口令现场解锁条 (会话未解锁时点击复制或查看就地展开) -->
            <div class="vault-inline-unlock-row" id="unlock-${defaultSafeId}" style="display: none;">
              <div class="unlock-header-tip">
                <span>🔑 输入主口令派生此记录</span>
                <span class="unlock-canary-badge" id="canary-unlock-${defaultSafeId}">校验码: --</span>
              </div>
              <div class="unlock-input-wrap">
                <input type="password" class="unlock-mantra-input cyber-input" id="input-unlock-${defaultSafeId}" placeholder="输入主口令..." autocomplete="off" />
                <button type="button" class="btn-toggle-unlock-pwd" data-input="input-unlock-${defaultSafeId}" title="显隐">🙈</button>
                <button type="button" class="btn-submit-unlock" data-input="input-unlock-${defaultSafeId}" data-domain="${item.canonicalDomain}" data-user="" data-ver="1" data-preset="${item.rulePreset}" data-target-peek="peek-${defaultSafeId}" data-unlock="unlock-${defaultSafeId}">派生查看</button>
                <button type="button" class="btn-submit-unlock-copy" data-input="input-unlock-${defaultSafeId}" data-domain="${item.canonicalDomain}" data-user="" data-ver="1" data-preset="${item.rulePreset}" data-title="${displayTitle}" data-unlock="unlock-${defaultSafeId}">派生复制</button>
                <button type="button" class="btn-cancel-unlock" data-unlock="unlock-${defaultSafeId}">✕</button>
              </div>
            </div>
            <div class="vault-peek-pwd-bar" id="peek-${defaultSafeId}" style="display: none;">
              <span class="peek-pwd-val">••••••••••••••••</span>
              <span class="peek-pwd-timer">5秒后自动隐蔽</span>
            </div>
          `;
        }

        return `
          <div class="vault-site-card" data-domain="${item.canonicalDomain}">
            <div class="vault-site-header">
              <div class="vault-site-info">
                <div class="vault-site-title-row" id="title-row-${safeDomainId}">
                  <span class="vault-site-name" id="name-label-${safeDomainId}">${hasCustomAlias ? '🏷️ ' : '🌐 '}${displayTitle}</span>
                  <button type="button" class="btn-edit-alias-inline" data-domain="${item.canonicalDomain}" data-name="${item.displayName || ''}" data-target="title-row-${safeDomainId}" title="修改站点别名/备注">✏️</button>
                </div>
                ${subDomainText ? `<span class="vault-site-sub">🌐 ${subDomainText}</span>` : ''}
              </div>
              <div class="vault-site-meta">
                <span class="vault-preset-pill">${presetName}</span>
                <button type="button" class="btn-del-site-rule" data-del="${item.canonicalDomain}" data-target="del-bar-${safeDomainId}" title="从清单移除">✕</button>
              </div>
            </div>
            <!-- 删除二次确认条 (就地展开，免原生 confirm) -->
            <div class="vault-del-confirm-bar" id="del-bar-${safeDomainId}" style="display: none;">
              <span class="del-confirm-text">确定移除 [${displayTitle}] 吗？</span>
              <div class="del-confirm-actions">
                <button type="button" class="btn-confirm-del-btn btn-do-del" data-del="${item.canonicalDomain}" data-name="${displayTitle}">确认移除</button>
                <button type="button" class="btn-confirm-del-btn btn-cancel-del" data-target="del-bar-${safeDomainId}">取消</button>
              </div>
            </div>
            <div class="vault-accounts-box">
              ${accountsHtml}
            </div>
          </div>
        `;
      })
      .join('');

    // 事件绑定: 载入主面板 (彻底修复 inputDomain is not defined)
    syncedRulesList.querySelectorAll('.btn-load-to-panel').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dom = btn.getAttribute('data-domain') || '';
        const preset = (btn.getAttribute('data-preset') as RulePreset) || 'standard-16';
        const user = btn.getAttribute('data-user') || '';
        const name = btn.getAttribute('data-name') || '';

        const inpDomain = document.getElementById('input-domain') as HTMLInputElement | null;
        const inpAlias = document.getElementById('input-domain-alias') as HTMLInputElement | null;
        const inpUser = document.getElementById('input-domain-user') as HTMLInputElement | null;
        const inpMantra = document.getElementById('input-mantra') as HTMLInputElement | null;
        const presetSelector = document.getElementById('preset-selector');
        const textRuleDesc = document.getElementById('text-rule-desc');

        if (inpDomain) inpDomain.value = dom;
        if (inpAlias) inpAlias.value = name;
        if (inpUser) inpUser.value = user;

        if (RULE_PRESETS[preset]) {
          presetSelector?.querySelectorAll('.preset-btn').forEach((b) => {
            if (b.getAttribute('data-preset') === preset) b.classList.add('active');
            else b.classList.remove('active');
          });
          if (textRuleDesc) {
            textRuleDesc.textContent = RULE_PRESETS[preset].description + ' (已匹配站点规则)';
          }
        }

        inpDomain?.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('card-generator')?.scrollIntoView({ behavior: 'smooth' });
        if (!getSessionMasterMantra()) {
          inpMantra?.focus();
          showToast(`已载入站点 [${dom}]，请输入主口令现场派生`);
        } else {
          showToast(`已载入站点 [${dom}]，密码已现场计算`);
        }
      });
    });

    // 事件绑定: 现场计算并复制密码 (支持卡片内专属解锁)
    syncedRulesList.querySelectorAll('.btn-copy-site-pwd').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const mantra = getSessionMasterMantra();
        const unlockId = btn.getAttribute('data-unlock') || '';
        const unlockEl = unlockId ? document.getElementById(unlockId) : null;
        const dom = btn.getAttribute('data-domain') || '';
        const user = btn.getAttribute('data-user') || '';
        const ver = parseInt(btn.getAttribute('data-ver') || '1', 10);
        const preset = (btn.getAttribute('data-preset') as RulePreset) || 'standard-16';
        const title = btn.getAttribute('data-title') || dom;

        if (!mantra) {
          if (unlockEl) {
            unlockEl.style.display = unlockEl.style.display === 'none' ? 'flex' : 'none';
            const inp = unlockEl.querySelector('.unlock-mantra-input') as HTMLInputElement | null;
            inp?.focus();
          }
          showToast('🔑 请输入主口令现场派生此记录');
          return;
        }

        try {
          const originalText = btn.textContent;
          btn.textContent = '⏳ 计算中...';
          const pwd = await deriveSitePassword(mantra, dom, user, ver, preset);
          await navigator.clipboard.writeText(pwd);
          btn.textContent = '✅ 已复制！';
          btn.classList.add('copied');
          showToast(`🎉 已成功计算并复制 [${title}${user ? ` - ${user}` : ''}] 的密码！`);
          setTimeout(() => {
            btn.textContent = originalText;
            btn.classList.remove('copied');
          }, 2000);
        } catch (err: any) {
          showToast(`❌ 密码计算失败: ${err?.message || '未知错误'}`);
        }
      });
    });

    // 事件绑定: 睁眼查看计算密码 (5秒后自动隐蔽，支持卡片内专属解锁)
    syncedRulesList.querySelectorAll('.btn-peek-site-pwd').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const mantra = getSessionMasterMantra();
        const unlockId = btn.getAttribute('data-unlock') || '';
        const unlockEl = unlockId ? document.getElementById(unlockId) : null;
        const dom = btn.getAttribute('data-domain') || '';
        const user = btn.getAttribute('data-user') || '';
        const ver = parseInt(btn.getAttribute('data-ver') || '1', 10);
        const preset = (btn.getAttribute('data-preset') as RulePreset) || 'standard-16';
        const targetId = btn.getAttribute('data-target') || '';
        const targetEl = document.getElementById(targetId);

        if (!mantra) {
          if (unlockEl) {
            unlockEl.style.display = unlockEl.style.display === 'none' ? 'flex' : 'none';
            const inp = unlockEl.querySelector('.unlock-mantra-input') as HTMLInputElement | null;
            inp?.focus();
          }
          showToast('🔑 请输入主口令现场派生此记录');
          return;
        }

        if (!targetEl) return;

        if (targetEl.style.display !== 'none') {
          targetEl.style.display = 'none';
          btn.textContent = '👁️';
          return;
        }

        try {
          const pwd = await deriveSitePassword(mantra, dom, user, ver, preset);
          const valEl = targetEl.querySelector('.peek-pwd-val');
          if (valEl) valEl.textContent = pwd;
          targetEl.style.display = 'flex';
          btn.textContent = '🙈';

          // 5秒倒计时自动隐藏
          let leftSec = 5;
          const timerEl = targetEl.querySelector('.peek-pwd-timer');
          const interval = setInterval(() => {
            leftSec--;
            if (timerEl) timerEl.textContent = `${leftSec}秒后自动隐蔽`;
            if (leftSec <= 0) {
              clearInterval(interval);
              targetEl.style.display = 'none';
              btn.textContent = '👁️';
              if (valEl) valEl.textContent = '••••••••••••••••';
            }
          }, 1000);
        } catch (err: any) {
          showToast(`❌ 密码派生异常: ${err?.message || '未知错误'}`);
        }
      });
    });

    // 事件绑定: 卡片内专属内联解锁交互 (输入口令、实时金丝雀、派生查看/复制)
    syncedRulesList.querySelectorAll('.vault-inline-unlock-row').forEach((row) => {
      const inpMantra = row.querySelector('.unlock-mantra-input') as HTMLInputElement | null;
      const canaryBadge = row.querySelector('.unlock-canary-badge') as HTMLElement | null;
      const btnToggle = row.querySelector('.btn-toggle-unlock-pwd') as HTMLButtonElement | null;
      const btnUnlockPeek = row.querySelector('.btn-submit-unlock') as HTMLButtonElement | null;
      const btnUnlockCopy = row.querySelector('.btn-submit-unlock-copy') as HTMLButtonElement | null;
      const btnCancel = row.querySelector('.btn-cancel-unlock') as HTMLButtonElement | null;

      // 实时金丝雀校验
      inpMantra?.addEventListener('input', async () => {
        const val = (inpMantra.value || '').trim();
        if (canaryBadge) {
          if (val) {
            const canary = await computeCanary(val);
            canaryBadge.textContent = `校验码: ${canary}`;
          } else {
            canaryBadge.textContent = '校验码: --';
          }
        }
      });

      // 切换显隐
      btnToggle?.addEventListener('click', () => {
        if (!inpMantra) return;
        const isPwd = inpMantra.type === 'password';
        inpMantra.type = isPwd ? 'text' : 'password';
        btnToggle.textContent = isPwd ? '👁️' : '🙈';
      });

      // 取消关闭
      btnCancel?.addEventListener('click', () => {
        (row as HTMLElement).style.display = 'none';
      });

      // 派生查看
      btnUnlockPeek?.addEventListener('click', async () => {
        const val = (inpMantra?.value || '').trim();
        if (!val) {
          showToast('⚠️ 请先输入您的主口令');
          inpMantra?.focus();
          return;
        }
        setSessionMasterMantra(val);
        (row as HTMLElement).style.display = 'none';

        const dom = btnUnlockPeek.getAttribute('data-domain') || '';
        const user = btnUnlockPeek.getAttribute('data-user') || '';
        const ver = parseInt(btnUnlockPeek.getAttribute('data-ver') || '1', 10);
        const preset = (btnUnlockPeek.getAttribute('data-preset') as RulePreset) || 'standard-16';
        const targetPeekId = btnUnlockPeek.getAttribute('data-target-peek') || '';
        const targetEl = document.getElementById(targetPeekId);

        if (!targetEl) return;
        try {
          const pwd = await deriveSitePassword(val, dom, user, ver, preset);
          const valEl = targetEl.querySelector('.peek-pwd-val');
          if (valEl) valEl.textContent = pwd;
          targetEl.style.display = 'flex';

          let leftSec = 5;
          const timerEl = targetEl.querySelector('.peek-pwd-timer');
          const interval = setInterval(() => {
            leftSec--;
            if (timerEl) timerEl.textContent = `${leftSec}秒后自动隐蔽`;
            if (leftSec <= 0) {
              clearInterval(interval);
              targetEl.style.display = 'none';
              if (valEl) valEl.textContent = '••••••••••••••••';
            }
          }, 1000);
          showToast('✅ 会话已解锁，密码已现场派生！');
        } catch (err: any) {
          showToast(`❌ 密码派生异常: ${err?.message || '未知错误'}`);
        }
      });

      // 派生复制
      btnUnlockCopy?.addEventListener('click', async () => {
        const val = (inpMantra?.value || '').trim();
        if (!val) {
          showToast('⚠️ 请先输入您的主口令');
          inpMantra?.focus();
          return;
        }
        setSessionMasterMantra(val);
        (row as HTMLElement).style.display = 'none';

        const dom = btnUnlockCopy.getAttribute('data-domain') || '';
        const user = btnUnlockCopy.getAttribute('data-user') || '';
        const ver = parseInt(btnUnlockCopy.getAttribute('data-ver') || '1', 10);
        const preset = (btnUnlockCopy.getAttribute('data-preset') as RulePreset) || 'standard-16';
        const title = btnUnlockCopy.getAttribute('data-title') || dom;

        try {
          const pwd = await deriveSitePassword(val, dom, user, ver, preset);
          await navigator.clipboard.writeText(pwd);
          showToast(`🎉 已成功派生并复制 [${title}${user ? ` - ${user}` : ''}] 的密码！`);
        } catch (err: any) {
          showToast(`❌ 密码派生异常: ${err?.message || '未知错误'}`);
        }
      });
    });

    // 事件绑定: 站点别名内联就地编辑 (彻底解决手机端 prompt 失效问题)
    syncedRulesList.querySelectorAll('.btn-edit-alias-inline').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const d = btn.getAttribute('data-domain') || '';
        const curName = btn.getAttribute('data-name') || '';
        const targetRowId = btn.getAttribute('data-target') || '';
        const targetRow = document.getElementById(targetRowId);

        if (!targetRow) return;

        targetRow.innerHTML = `
          <div class="inline-alias-editor">
            <input type="text" class="inline-alias-input cyber-input" id="alias-edit-${d}" value="${curName}" placeholder="设置别名 (如: 三毛专线)" autocomplete="off" />
            <button type="button" class="btn-save-inline-alias" id="btn-save-alias-${d}">保存</button>
            <button type="button" class="btn-cancel-inline-alias" id="btn-cancel-alias-${d}">取消</button>
          </div>
        `;

        const editInput = document.getElementById(`alias-edit-${d}`) as HTMLInputElement | null;
        const btnSave = document.getElementById(`alias-edit-${d}`)?.parentElement?.querySelector('.btn-save-inline-alias');
        const btnCancel = document.getElementById(`alias-edit-${d}`)?.parentElement?.querySelector('.btn-cancel-inline-alias');

        editInput?.focus();
        editInput?.select();

        const saveHandler = () => {
          const newAlias = (editInput?.value || '').trim();
          const item = manifest.domains[d];
          if (item) {
            recordDomainRule(d, item.rulePreset, newAlias);
            renderRulesList();
            refreshStatusView();
            showToast(`✅ 已更新站点 [${d}] 的别名`);
          }
        };

        btnSave?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          saveHandler();
        });

        btnCancel?.addEventListener('click', (ev) => {
          ev.stopPropagation();
          renderRulesList();
        });

        editInput?.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            saveHandler();
          } else if (ev.key === 'Escape') {
            ev.preventDefault();
            renderRulesList();
          }
        });
      });
    });

    // 事件绑定: 站点删除就地确认 (彻底解决手机端 confirm 失效问题)
    syncedRulesList.querySelectorAll('.btn-del-site-rule').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetBarId = btn.getAttribute('data-target') || '';
        const targetBar = document.getElementById(targetBarId);
        if (targetBar) {
          targetBar.style.display = targetBar.style.display === 'none' ? 'flex' : 'none';
        }
      });
    });

    syncedRulesList.querySelectorAll('.btn-do-del').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const delDomain = btn.getAttribute('data-del');
        const siteName = btn.getAttribute('data-name') || delDomain;
        if (delDomain) {
          removeDomainRule(delDomain);
          renderRulesList();
          refreshStatusView();
          showToast(`已移除站点 [${siteName}]`);
        }
      });
    });

    syncedRulesList.querySelectorAll('.btn-cancel-del').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const targetBarId = btn.getAttribute('data-target') || '';
        const targetBar = document.getElementById(targetBarId);
        if (targetBar) targetBar.style.display = 'none';
      });
    });
  }

  (window as any).__refreshWebDAVRulesList = () => {
    renderRulesList();
    refreshStatusView();
  };

  // 折叠配置表单
  btnToggleConfig?.addEventListener('click', () => {
    if (!syncConfigForm) return;
    const isHidden = syncConfigForm.style.display === 'none';
    syncConfigForm.style.display = isHidden ? 'flex' : 'none';
    if (btnToggleConfig) {
      btnToggleConfig.textContent = isHidden ? '✕ 收起' : '⚙️ 配置';
    }
  });

  // 折叠规则列表
  btnToggleRules?.addEventListener('click', () => {
    if (!syncedRulesList || !arrowRules) return;
    const isHidden = syncedRulesList.style.display === 'none';
    syncedRulesList.style.display = isHidden ? 'flex' : 'none';
    arrowRules.textContent = isHidden ? '▲' : '▼';
  });

  // 保存 WebDAV 配置
  btnSave?.addEventListener('click', () => {
    const currentCfg: WebDAVConfig = {
      serverUrl: normalizeJianguoyunUrl(inputUrl?.value || ''),
      username: inputUser?.value?.trim() || '',
      password: inputPass?.value?.trim() || '',
      remoteFileName: inputFile?.value?.trim() || 'mantra_sync.mkey',
      syncPassword: inputSyncPass?.value?.trim() || ''
    };
    saveWebDAVConfig(currentCfg);
    refreshStatusView();
    if (btnSave) {
      btnSave.textContent = '✅ 已保存配置！';
      setTimeout(() => (btnSave.textContent = '💾 保存配置'), 1500);
    }
  });

  // 测试 WebDAV 连通性
  btnTest?.addEventListener('click', async () => {
    const currentCfg: WebDAVConfig = {
      serverUrl: inputUrl?.value?.trim() || '',
      username: inputUser?.value?.trim() || '',
      password: inputPass?.value?.trim() || '',
      remoteFileName: inputFile?.value?.trim() || 'mantra_sync.mkey',
      syncPassword: inputSyncPass?.value?.trim() || ''
    };
    if (btnTest) btnTest.textContent = '⏳ 正在探测...';
    try {
      const res = await testWebDAVConnection(currentCfg);
      alert(res.ok ? `✅ ${res.message}` : `❌ ${res.message}`);
    } catch (e: any) {
      alert(`❌ 探测异常: ${e?.message || '未知错误'}`);
    } finally {
      if (btnTest) btnTest.textContent = '⚡ 测试连通性';
    }
  });

  // 就地请求同步加密密码异步对话框
  function promptSyncPasswordModal(): Promise<string> {
    return new Promise((resolve) => {
      const overlay = document.getElementById('sync-pass-modal-overlay');
      const input = document.getElementById('modal-sync-pass-input') as HTMLInputElement | null;
      const btnCancel = document.getElementById('btn-modal-sync-cancel');
      const btnConfirm = document.getElementById('btn-modal-sync-confirm');

      if (!overlay || !input) {
        const pass = prompt('检测到云端文件已加密，请输入同步加密密码：');
        resolve(pass || '');
        return;
      }

      input.value = '';
      overlay.style.display = 'flex';
      input.focus();

      const cleanup = () => {
        overlay.style.display = 'none';
        btnCancel?.removeEventListener('click', onCancel);
        btnConfirm?.removeEventListener('click', onConfirm);
      };

      const onCancel = () => {
        cleanup();
        resolve('');
      };

      const onConfirm = () => {
        const val = input.value.trim();
        cleanup();
        resolve(val);
      };

      btnCancel?.addEventListener('click', onCancel);
      btnConfirm?.addEventListener('click', onConfirm);
    });
  }

  // 执行立即同步
  btnSyncNow?.addEventListener('click', async () => {
    const currentCfg: WebDAVConfig = {
      serverUrl: inputUrl?.value?.trim() || '',
      username: inputUser?.value?.trim() || '',
      password: inputPass?.value?.trim() || '',
      remoteFileName: inputFile?.value?.trim() || 'mantra_sync.mkey',
      syncPassword: inputSyncPass?.value?.trim() || ''
    };

    if (!currentCfg.serverUrl) {
      if (syncConfigForm) syncConfigForm.style.display = 'flex';
      alert('请先在「⚙️ 配置」中填入您的 WebDAV 服务器地址与账号密码');
      return;
    }

    if (badgeSyncStatus) {
      badgeSyncStatus.className = 'sync-status-tag syncing';
      badgeSyncStatus.textContent = '🔄 同步中...';
    }
    if (btnSyncNow) {
      btnSyncNow.textContent = '⏳ 同步中...';
    }

    try {
      const res = await performWebDAVSync(currentCfg, promptSyncPasswordModal);
      if (res.upgradedToEncrypted && inputSyncPass) {
        inputSyncPass.value = currentCfg.syncPassword || '';
      }
      refreshStatusView();
      renderRulesList();
      alert(res.ok ? `🎉 ${res.message}` : `⚠️ 同步未完成: ${res.message}`);
    } catch (e: any) {
      alert(`❌ 同步发生异常: ${e?.message || '未知错误'}`);
      refreshStatusView();
    } finally {
      if (btnSyncNow) btnSyncNow.textContent = '🔄 立即双向同步';
      refreshStatusView();
    }
  });

  // 初次渲染
  refreshStatusView();
  renderRulesList();
}

// -----------------------------------------------------------------------------
// 2. 原生系统注入服务状态感知与指引跳转
// -----------------------------------------------------------------------------
function setupServiceButtons() {
  const btnAutofill = document.getElementById('btn-open-autofill-settings');
  const btnIme = document.getElementById('btn-open-ime-settings');
  const badgeAutofill = document.getElementById('badge-autofill');
  const badgeIme = document.getElementById('badge-ime');

  // 刷新系统服务开启状态
  function refreshStatus() {
    const native = typeof window !== 'undefined' ? (window as any).MantraNative : null;

    if (badgeAutofill) {
      if (native?.isAutofillEnabled) {
        const isEnabled = native.isAutofillEnabled();
        if (isEnabled) {
          badgeAutofill.textContent = '🟢 运行中';
          badgeAutofill.className = 'service-status-badge active';
        } else {
          badgeAutofill.textContent = '⚠️ 未开启';
          badgeAutofill.className = 'service-status-badge inactive';
        }
      } else {
        badgeAutofill.textContent = '系统管理';
        badgeAutofill.className = 'service-status-badge checking';
      }
    }

    if (badgeIme) {
      if (native?.isImeEnabled) {
        const isEnabled = native.isImeEnabled();
        if (isEnabled) {
          badgeIme.textContent = '🟢 已就绪';
          badgeIme.className = 'service-status-badge active';
        } else {
          badgeIme.textContent = '⚠️ 未开启';
          badgeIme.className = 'service-status-badge inactive';
        }
      } else {
        badgeIme.textContent = '系统管理';
        badgeIme.className = 'service-status-badge checking';
      }
    }
  }

  // 暴露给原生 Activity onResume 自动调用
  if (typeof window !== 'undefined') {
    (window as any).onMantraResume = () => {
      refreshStatus();
    };
  }

  btnAutofill?.addEventListener('click', () => {
    if (typeof window !== 'undefined' && (window as any).MantraNative?.openAutofillSettings) {
      (window as any).MantraNative.openAutofillSettings();
    } else {
      alert('请前往 Android 系统设置 -> 辅助功能 / 自动填充服务 中启用「密诀」');
    }
  });

  btnIme?.addEventListener('click', () => {
    if (typeof window !== 'undefined' && (window as any).MantraNative?.openImeSettings) {
      (window as any).MantraNative.openImeSettings();
    } else {
      alert('请前往 Android 系统设置 -> 语言与输入法 中勾选并激活「密诀辅助键盘」');
    }
  });

  // 绑定引导说明弹窗按钮
  const btnOpenGuide = document.getElementById('btn-open-onboarding');
  const overlay = document.getElementById('onboarding-overlay');
  const btnCloseGuide = document.getElementById('btn-close-onboarding');
  const btnConfirmGuide = document.getElementById('btn-confirm-onboarding');
  const btnGuideAutofill = document.getElementById('btn-guide-autofill');
  const btnGuideIme = document.getElementById('btn-guide-ime');

  btnOpenGuide?.addEventListener('click', () => {
    if (overlay) overlay.style.display = 'flex';
  });

  btnCloseGuide?.addEventListener('click', () => {
    if (overlay) overlay.style.display = 'none';
  });

  btnConfirmGuide?.addEventListener('click', () => {
    if (overlay) overlay.style.display = 'none';
    localStorage.setItem('mk_onboarding_guided', 'true');
    if (typeof window !== 'undefined' && (window as any).MantraNative?.setFirstLaunchCompleted) {
      (window as any).MantraNative.setFirstLaunchCompleted();
    }
  });

  btnGuideAutofill?.addEventListener('click', () => {
    if (typeof window !== 'undefined' && (window as any).MantraNative?.openAutofillSettings) {
      (window as any).MantraNative.openAutofillSettings();
    }
  });

  btnGuideIme?.addEventListener('click', () => {
    if (typeof window !== 'undefined' && (window as any).MantraNative?.openImeSettings) {
      (window as any).MantraNative.openImeSettings();
    }
  });

  // 初始检测一次
  refreshStatus();
}

// 首次启动引导逻辑
function checkFirstLaunchGuide() {
  const native = typeof window !== 'undefined' ? (window as any).MantraNative : null;
  const isFirst = native?.isFirstLaunch ? native.isFirstLaunch() : !localStorage.getItem('mk_onboarding_guided');

  if (isFirst && !localStorage.getItem('mk_onboarding_guided')) {
    setTimeout(() => {
      const overlay = document.getElementById('onboarding-overlay');
      if (overlay) overlay.style.display = 'flex';
    }, 600);
  }
}

// -----------------------------------------------------------------------------
// 3. 绑定版本检测与在线更新 (GitHub Releases)
// -----------------------------------------------------------------------------
function setupUpdateChecker() {
  const btnCheck = document.getElementById('btn-check-update');
  const textLatest = document.getElementById('text-latest-ver');
  const badgeStatus = document.getElementById('update-status-badge');
  const detailBox = document.getElementById('update-detail-box');
  const textTitle = document.getElementById('text-release-title');
  const textNotes = document.getElementById('text-release-notes');
  const btnAction = document.getElementById('btn-action-update');

  let latestRelease: VersionMetadata | null = null;

  async function check() {
    if (!textLatest || !badgeStatus) return;
    textLatest.textContent = '检查中...';
    badgeStatus.textContent = '检测中';
    badgeStatus.className = 'update-status checking';

    try {
      const isDebug = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === 'true';
      latestRelease = await fetchLatestRelease(isDebug);
      textLatest.textContent = latestRelease.versionTag;

      const cmp = compareVersions(CURRENT_APP_VERSION, latestRelease.version);
      if (cmp > 0) {
        // 有新版本
        badgeStatus.textContent = '发现新版本';
        badgeStatus.className = 'update-status has-update';
        if (detailBox && textTitle && textNotes) {
          detailBox.style.display = 'flex';
          textTitle.textContent = `${latestRelease.title} (${latestRelease.assetSizeText})`;
          textNotes.textContent = latestRelease.changelog;
        }
      } else {
        badgeStatus.textContent = '已是最新';
        badgeStatus.className = 'update-status latest';
        if (detailBox) detailBox.style.display = 'none';
      }
    } catch {
      textLatest.textContent = '检测超时';
      badgeStatus.textContent = '离线/超时';
      badgeStatus.className = 'update-status error';
    }
  }

  btnCheck?.addEventListener('click', check);
  setTimeout(check, 1000);

  btnAction?.addEventListener('click', () => {
    if (!latestRelease) return;
    const downloadUrl = latestRelease.downloadUrl;

    if (typeof window !== 'undefined' && (window as any).MantraNative?.downloadAndInstallApk) {
      (window as any).MantraNative.downloadAndInstallApk(downloadUrl, latestRelease.versionTag, latestRelease.sha256);
      return;
    }

    window.open(downloadUrl, '_blank');
  });

  if (typeof window !== 'undefined') {
    (window as any).onMantraDownloadProgress = (data: any) => {
      const progressRow = document.getElementById('download-progress-row');
      const progressFill = document.getElementById('update-progress-fill');
      const progressText = document.getElementById('update-progress-text');

      if (progressRow && progressFill && progressText) {
        progressRow.style.display = 'flex';
        const pct = Math.max(0, Math.min(100, data.percent || 0));
        progressFill.style.width = `${pct}%`;
        progressText.textContent = `${pct}% (${data.message || ''})`;
      }
    };
  }
}

// ==============================================================================
// 🌟 核心：条件引入 Agent Feedback 桥梁 (Zero-DCE 机制保障)
// ==============================================================================
const isDebugMode = import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEBUG === 'true';

if (isDebugMode) {
  Promise.all([
    import('@lylyuanliang/agent-feedback-client'),
    import('./debug/devApkExtensionTab')
  ]).then(([{ initAgentFeedback, registerExtensionTab, syncAccessControlFromServer }, { devApkExtensionTab }]) => {
    initAgentFeedback({
      appName: '密诀',
      showSettings: true,
      accessControl: {
        enabled: true,
        promptTitle: '受限访问保护',
        promptMessage: '此即时反馈通道仅对开发团队与受邀测试员开放。请输入开发机配对密钥以解锁访问。'
      },
      hostChannel: {
        name: 'GitHub Issues',
        url: 'https://github.com/lylyuanliang/mantra-key/issues'
      }
    });

    registerExtensionTab(devApkExtensionTab);
    syncAccessControlFromServer().catch(() => {});
    console.log('[MantraKey Debug] Agent Feedback client & DevApk extension registered.');
  }).catch((e) => {
    console.warn('[MantraKey Debug] Failed to initialize agent feedback:', e);
  });
}
