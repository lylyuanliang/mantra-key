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
  removeDomainRule,
  testWebDAVConnection,
  performWebDAVSync,
  type WebDAVConfig
} from './services/webdavSyncService';

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
        <!-- 1. 核心主要功能置顶：确定性密码现场生成与派生 -->
        <section class="card crypto-card" id="card-generator">
          <div class="card-header">
            <span class="card-title">🔑 密码生成与现场派生</span>
            <span class="badge-dim">本地纯计算 · 零存储</span>
          </div>

          <div class="crypto-body">
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

            <!-- 目标站点/账户标识 -->
            <div class="input-group">
              <label class="input-label" for="input-domain">目标站点或账号标识</label>
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

            <!-- 派生结果卡片 -->
            <div class="derived-result-box">
              <div class="derived-meta">
                <span class="derived-label">计算派生密码</span>
                <span class="derived-strength" id="text-rule-desc">字母+数字+特殊符号 (16位)</span>
              </div>
              <div class="derived-output-row">
                <span class="derived-val" id="text-derived-pwd" style="color: #64748b; font-size: 13px;">等待输入主口令与目标站点...</span>
                <div style="display: flex; gap: 6px; align-items: center;">
                  <button type="button" class="btn-save-rule" id="btn-save-rule" title="保存此规则至多端同步清单">
                    📌 记住规则
                  </button>
                  <button type="button" class="btn-copy-pwd" id="btn-copy-pwd" title="一键复制" disabled>
                    📋 复制
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- 2. WebDAV 多端端到端加密同步面板 (E2EE + CRDT) -->
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
                  placeholder="例如: https://dav.jianguoyun.com/dav/"
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

              <div class="sync-actions-row">
                <button type="button" class="btn-secondary" id="btn-test-webdav">
                  ⚡ 测试连通性
                </button>
                <button type="button" class="btn-secondary" id="btn-save-webdav">
                  💾 保存配置
                </button>
              </div>

              <div class="sync-hint-box">
                💡 <strong>零知识加密保障：</strong>同步前在本地使用您的主口令派生高强密钥，WebDAV 云端仅保存 <code>.mkey</code> 二进制密文，坚果云或 Nextcloud 管理员无法逆向出您的任何站点信息。
              </div>
            </div>

            <!-- 已同步规则清单折叠区 -->
            <div class="synced-rules-section">
              <div class="synced-rules-header" id="btn-toggle-rules-list">
                <span class="synced-rules-title">📑 已保存的站点规则清单 (<span id="count-synced-rules">0</span>)</span>
                <span class="synced-rules-arrow" id="arrow-rules-list">▼</span>
              </div>
              <div class="synced-rules-list" id="synced-rules-list" style="display: none;">
                <!-- 动态渲染站点规则项 -->
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
  const btnTogglePwd = document.getElementById('btn-toggle-pwd') as HTMLButtonElement | null;
  const tagCanary = document.getElementById('tag-canary') as HTMLElement | null;
  const textDerivedPwd = document.getElementById('text-derived-pwd') as HTMLElement | null;
  const textRuleDesc = document.getElementById('text-rule-desc') as HTMLElement | null;
  const btnCopyPwd = document.getElementById('btn-copy-pwd') as HTMLButtonElement | null;
  const btnSaveRule = document.getElementById('btn-save-rule') as HTMLButtonElement | null;
  const presetSelector = document.getElementById('preset-selector');
  const chipItems = document.querySelectorAll('.chip-item');

  let currentPreset: RulePreset = 'standard-16';

  // 计算并渲染派生结果
  async function compute() {
    if (!inputMantra || !inputDomain || !textDerivedPwd) return;
    const mantra = inputMantra.value || '';
    const domain = inputDomain.value || '';

    // 更新金丝雀校验码
    if (tagCanary) {
      if (mantra.trim()) {
        const canary = await computeCanary(mantra);
        tagCanary.textContent = `校验码: ${canary}`;
      } else {
        tagCanary.textContent = '校验码: --';
      }
    }

    if (!mantra.trim() || !domain.trim()) {
      if (!mantra.trim() && !domain.trim()) {
        textDerivedPwd.textContent = '等待输入主口令与目标站点...';
      } else if (!mantra.trim()) {
        textDerivedPwd.textContent = '等待输入主口令...';
      } else {
        textDerivedPwd.textContent = '等待输入目标标识...';
      }
      textDerivedPwd.style.color = '#64748b';
      if (btnCopyPwd) btnCopyPwd.disabled = true;
      return;
    }

    try {
      const derived = await deriveSitePassword(mantra, domain, '', 1, currentPreset);
      textDerivedPwd.textContent = derived;
      textDerivedPwd.style.color = '#00f0ff';
      if (btnCopyPwd) btnCopyPwd.disabled = false;
    } catch (e: any) {
      textDerivedPwd.textContent = '派生失败: ' + (e?.message || '未知错误');
      textDerivedPwd.style.color = '#ef4444';
      if (btnCopyPwd) btnCopyPwd.disabled = true;
    }
  }

  // 绑定输入变动
  inputMantra?.addEventListener('input', compute);

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

  // 记住当前规则至同步清单
  btnSaveRule?.addEventListener('click', () => {
    const dVal = (inputDomain?.value || '').trim();
    if (!dVal) {
      alert('请先输入目标站点或账号标识（例如 github.com）');
      return;
    }
    recordDomainRule(dVal, currentPreset);
    btnSaveRule.textContent = '✅ 已记住！';
    (window as any).__refreshWebDAVRulesList?.();
    setTimeout(() => {
      btnSaveRule.textContent = '📌 记住规则';
    }, 1500);
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

  const btnTest = document.getElementById('btn-test-webdav');
  const btnSave = document.getElementById('btn-save-webdav');

  const btnToggleRules = document.getElementById('btn-toggle-rules-list');
  const syncedRulesList = document.getElementById('synced-rules-list');
  const arrowRules = document.getElementById('arrow-rules-list');
  const countRulesEl = document.getElementById('count-synced-rules');

  const inputMantra = document.getElementById('input-mantra') as HTMLInputElement | null;

  // 载入保存的配置
  const cfg = getSavedWebDAVConfig();
  if (inputUrl) inputUrl.value = cfg.serverUrl || '';
  if (inputUser) inputUser.value = cfg.username || '';
  if (inputPass) inputPass.value = cfg.password || '';
  if (inputFile) inputFile.value = cfg.remoteFileName || 'mantra_sync.mkey';

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

  // 渲染规则清单
  function renderRulesList() {
    if (!syncedRulesList) return;
    const manifest = getLocalManifest();
    const domainKeys = Object.keys(manifest.domains || {});

    if (countRulesEl) countRulesEl.textContent = String(domainKeys.length);

    if (domainKeys.length === 0) {
      syncedRulesList.innerHTML = `
        <div style="font-size: 11px; color: #64748b; text-align: center; padding: 10px 0;">
          暂无已记录站点规则。在上方计算派生密码后，点击「📌 记住规则」即可加入多端同步清单。
        </div>
      `;
      return;
    }

    syncedRulesList.innerHTML = domainKeys
      .sort()
      .map((k) => {
        const item = manifest.domains[k];
        return `
          <div class="rule-item-row" data-domain="${item.canonicalDomain}">
            <div style="display: flex; align-items: center;">
              <span class="rule-item-domain">${item.canonicalDomain}</span>
              <span class="rule-item-preset">${item.rulePreset}</span>
            </div>
            <button type="button" class="btn-del-rule" data-del="${item.canonicalDomain}" title="从同步清单移除">✕</button>
          </div>
        `;
      })
      .join('');

    // 绑定删除按钮
    syncedRulesList.querySelectorAll('.btn-del-rule').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const delDomain = btn.getAttribute('data-del');
        if (delDomain) {
          removeDomainRule(delDomain);
          renderRulesList();
          refreshStatusView();
        }
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
      serverUrl: inputUrl?.value?.trim() || '',
      username: inputUser?.value?.trim() || '',
      password: inputPass?.value?.trim() || '',
      remoteFileName: inputFile?.value?.trim() || 'mantra_sync.mkey'
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
      remoteFileName: inputFile?.value?.trim() || 'mantra_sync.mkey'
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

  // 执行立即同步
  btnSyncNow?.addEventListener('click', async () => {
    const mantra = inputMantra?.value?.trim();
    if (!mantra) {
      alert('同步安全约束：多端同步前需要在本地通过主口令进行端到端加密与解密，请先在上方输入您的主口令！');
      inputMantra?.focus();
      return;
    }

    const currentCfg: WebDAVConfig = {
      serverUrl: inputUrl?.value?.trim() || '',
      username: inputUser?.value?.trim() || '',
      password: inputPass?.value?.trim() || '',
      remoteFileName: inputFile?.value?.trim() || 'mantra_sync.mkey'
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
      const res = await performWebDAVSync(mantra, currentCfg);
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
