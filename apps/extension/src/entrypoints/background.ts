import {
  buildRequestEnvelope,
  HeartbeatManager,
  ResponseEnvelope,
} from '../utils/protocol';
import { extractDomain } from '../utils/domain';
import { PasswordGatekeeper, StagedPasswordChange } from '../utils/gatekeeper';
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
  setDomainDisplayName,
} from '../utils/storage';
import { deriveSitePassword, RulePreset } from '../utils/crypto';
import { checkExtensionUpdate } from '../utils/update';

export default defineBackground(() => {
  console.log('[MantraKey Ext] Background Service Worker 启动');

  // 周期性与启动时检查更新（针对非 Chrome Web Store 独立发布的扩展）
  checkExtensionUpdate().then((info) => {
    if (info?.hasUpdate) {
      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    }
  }).catch(() => {});

  let nativePort: chrome.runtime.Port | null = null;
  let heartbeatManager: HeartbeatManager | null = null;
  const gatekeeper = new PasswordGatekeeper();

  // 待处理 Native 请求的回调映射
  const pendingRequests = new Map<string, (res: ResponseEnvelope) => void>();

  /**
   * 建立 Native Messaging 原生连接 (按需懒加载，避免未安装本地服务时启动报错)
   */
  function connectToNativeDaemon(): void {
    if (nativePort) return;
    try {
      nativePort = chrome.runtime.connectNative('org.mantrakey.native_proxy');

      nativePort.onDisconnect.addListener(() => {
        // 关键防护：必须读取并消费 chrome.runtime.lastError，通知 Chrome 运行时错误已受控处理，避免扩展管理页亮起红色“错误”按钮
        const _handledError = chrome.runtime.lastError;
        heartbeatManager?.stop();
        heartbeatManager = null;
        nativePort = null;
      });

      // 初始化 25 秒 PING/PONG 心跳管理器，防 Service Worker 冻结
      heartbeatManager = new HeartbeatManager(nativePort, 25000);
      heartbeatManager.start();

      nativePort.onMessage.addListener((message: unknown) => {
        const response = message as ResponseEnvelope;
        if (!response || typeof response !== 'object') {
          return;
        }

        // PONG 心跳回显
        if ((response as unknown as { action: string }).action === 'PONG') {
          return;
        }

        // 匹配待处理的请求 ID 回调
        if (response.id && pendingRequests.has(response.id)) {
          const callback = pendingRequests.get(response.id);
          pendingRequests.delete(response.id);
          callback?.(response);
        }
      });
    } catch {
      nativePort = null;
    }
  }

  /**
   * 向原生端发送请求帧，若未连接或超时则返回 null 交由内置引擎处理
   */
  function sendNativeRequest<T = unknown>(
    action: string,
    payload: Record<string, unknown> = {}
  ): Promise<ResponseEnvelope<T> | null> {
    return new Promise((resolve) => {
      const envelope = buildRequestEnvelope(action, payload);

      if (!nativePort) {
        resolve(null);
        return;
      }

      const timeoutMs = action === 'AUTO_UPDATE_EXTENSION' ? 60000 : 2500;
      const timer = setTimeout(() => {
        if (pendingRequests.has(envelope.id)) {
          pendingRequests.delete(envelope.id);
          resolve(null);
        }
      }, timeoutMs);

      pendingRequests.set(envelope.id, (res) => {
        clearTimeout(timer);
        resolve(res as ResponseEnvelope<T>);
      });

      try {
        nativePort.postMessage(envelope);
      } catch {
        clearTimeout(timer);
        pendingRequests.delete(envelope.id);
        resolve(null);
      }
    });
  }

  // 监听 Tab 切换与 URL 变更
  chrome.tabs.onActivated.addListener(async (activeInfo) => {
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab?.url) {
        const domain = extractDomain(tab.url);
        // 使用带回调的安全调用并就地消耗 runtime.lastError，杜绝 Chrome 报错
        chrome.tabs.sendMessage(activeInfo.tabId, {
          action: 'TAB_DOMAIN_ACTIVATED',
          domain,
        }, () => {
          const _safe = chrome.runtime.lastError;
        });
      }
    } catch {
      // 目标页面未载入 content script 或无权限时安全忽略
    }
  });

  // 监听来自 Content Script 和 Popup 的消息
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const { action, payload } = message || {};

    // 1. 获取当前活动标签页真实域名与网页标题
    if (action === 'GET_CURRENT_DOMAIN') {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        const rawUrl = tab?.url || '';
        let domain = extractDomain(rawUrl);
        if (!domain && rawUrl.startsWith('chrome://')) {
          domain = 'chrome.internal';
        } else if (!domain) {
          domain = 'localhost';
        }
        sendResponse({ domain, tabId: tab?.id, title: tab?.title || '' });
      }).catch((err) => {
        sendResponse({ domain: 'localhost', error: err?.message });
      });
      return true;
    }

    // 1.1 获取当前激活的主题 (light / dark)
    if (action === 'GET_THEME') {
      chrome.storage.local.get(['mantra_theme']).then((res) => {
        sendResponse({ theme: res?.mantra_theme || 'light' });
      });
      return true;
    }

    // 2. 查询主口令安全会话状态
    if (action === 'QUERY_SESSION') {
      sendNativeRequest('QUERY_SESSION', payload).then(async (nativeRes) => {
        if (nativeRes && nativeRes.status === 'ok') {
          sendResponse(nativeRes);
          return;
        }

        // 纯浏览器独立运行模式
        const session = await getSessionState();
        sendResponse({
          status: 'ok',
          code: 200,
          data: {
            session_state: session.isUnlocked ? 'unlocked' : 'locked',
            ttl_remaining: session.ttlRemaining,
            canary: session.canary,
          },
        });
      }).catch(async () => {
        const session = await getSessionState();
        sendResponse({
          status: 'ok',
          code: 200,
          data: {
            session_state: session.isUnlocked ? 'unlocked' : 'locked',
            ttl_remaining: session.ttlRemaining,
            canary: session.canary,
          },
        });
      });
      return true;
    }

    // 3. 实时派生强密码
    if (action === 'DERIVE_CREDENTIAL') {
      const domain = (payload?.domain as string) || '';
      const serviceKey = (payload?.serviceKey as string) || '';
      const username = (payload?.username as string) || '';
      const version = (payload?.version as number) || 1;
      const rulePreset = (payload?.rule_preset as RulePreset) || 'standard-16';

      // 核心解耦：若指定了统一服务标识 (如 "三毛机场")，优先以 serviceKey 作为派生盐基准，彻底消除镜像域名漂移导致密码变化
      const derivationBase = serviceKey.trim() || domain.trim();

      sendNativeRequest('DERIVE_CREDENTIAL', { ...payload, domain: derivationBase }).then(async (nativeRes) => {
        if (nativeRes && nativeRes.status === 'ok' && (nativeRes.data as { derived_password?: string })?.derived_password) {
          sendResponse(nativeRes);
          return;
        }

        const session = await getSessionState();
        if (!session.isUnlocked || !session.mantra) {
          sendResponse({
            status: 'error',
            code: 401,
            message: '记忆口令未就绪，请先输入记忆口令',
          });
          return;
        }

        try {
          const derivedPassword = await deriveSitePassword(
            session.mantra,
            derivationBase,
            username,
            version,
            rulePreset
          );
          sendResponse({
            status: 'ok',
            code: 200,
            data: {
              derived_password: derivedPassword,
              canary: session.canary,
            },
          });
        } catch (err) {
          sendResponse({
            status: 'error',
            code: 500,
            message: (err as Error).message,
          });
        }
      }).catch(async () => {
        sendResponse({ status: 'error', message: '派生异常' });
      });
      return true;
    }

    // 4. 读取指定域名的账号列表 (支持域名与标题联动识别)
    if (action === 'GET_ACCOUNTS_FOR_DOMAIN') {
      const domain = (payload?.domain as string) || '';
      const title = (payload?.title as string) || '';
      getAccountsForDomain(domain, title).then((accounts) => {
        sendResponse({ status: 'ok', accounts });
      }).catch(() => {
        sendResponse({ status: 'ok', accounts: [] });
      });
      return true;
    }

    // 5. 保存或更新账号
    if (action === 'SAVE_ACCOUNT') {
      const domain = (payload?.domain as string) || '';
      const account = payload?.account;
      if (!domain || !account) {
        sendResponse({ status: 'error', message: '参数缺失' });
        return false;
      }
      saveAccountForDomain(domain, account).then((saved) => {
        sendResponse({ status: 'ok', account: saved });
      }).catch((err) => {
        sendResponse({ status: 'error', message: err?.message });
      });
      return true;
    }

    // 6. 删除账号
    if (action === 'DELETE_ACCOUNT') {
      const domain = (payload?.domain as string) || '';
      const username = (payload?.username as string) || '';
      deleteAccountFromDomain(domain, username).then(() => {
        sendResponse({ status: 'ok' });
      }).catch(() => {
        sendResponse({ status: 'error' });
      });
      return true;
    }

    // 7. 更新版本号
    if (action === 'UPDATE_VERSION') {
      const domain = (payload?.domain as string) || '';
      const username = (payload?.username as string) || '';
      const newVersion = (payload?.newVersion as number) || 1;
      updateAccountVersion(domain, username, newVersion).then((updated) => {
        sendResponse({ status: 'ok', account: updated });
      }).catch(() => {
        sendResponse({ status: 'error' });
      });
      return true;
    }

    // 8. 锁定会话
    if (action === 'LOCK_NOW') {
      lockSession().then(() => {
        sendResponse({ status: 'ok' });
      });
      return true;
    }

    // 8.1 就地解锁会话 (支持网页气泡直接就地解锁，免去来回点击右上角)
    if (action === 'UNLOCK_SESSION') {
      const mantra = (payload?.mantra as string) || '';
      if (!mantra) {
        sendResponse({ status: 'error', message: '记忆口令不能为空' });
        return false;
      }
      unlockSession(mantra, 900).then((session) => {
        sendResponse({ status: 'ok', session });
      }).catch((err) => {
        sendResponse({ status: 'error', message: err?.message });
      });
      return true;
    }

    // 8.2 获取全量账号清单 (供内嵌气泡与 Popup 浏览)
    if (action === 'GET_ALL_MANIFEST') {
      getAllAccountsManifest().then((groups) => {
        sendResponse({ status: 'ok', groups });
      }).catch(() => {
        sendResponse({ status: 'ok', groups: [] });
      });
      return true;
    }

    // 8.3 快速关联当前网页至已有站点 (支持镜像域名秒级对齐)
    if (action === 'LINK_DOMAIN') {
      const targetDomain = (payload?.targetDomain as string) || '';
      const sourceDomain = (payload?.sourceDomain as string) || '';
      linkDomainToExisting(targetDomain, sourceDomain).then((ok) => {
        sendResponse({ status: ok ? 'ok' : 'error', ok });
      }).catch((err) => {
        sendResponse({ status: 'error', message: err?.message });
      });
      return true;
    }

    // 8.4 修改站点别名/备注名称
    if (action === 'SET_DOMAIN_DISPLAY_NAME') {
      const domain = (payload?.domain as string) || '';
      const displayName = (payload?.displayName as string) || '';
      setDomainDisplayName(domain, displayName).then(() => {
        sendResponse({ status: 'ok' });
      }).catch((err) => {
        sendResponse({ status: 'error', message: err?.message });
      });
      return true;
    }

    // 8.5 检查扩展最新版本与下载直链
    if (action === 'CHECK_EXTENSION_UPDATE') {
      checkExtensionUpdate().then((info) => {
        sendResponse({ status: 'ok', data: info });
      }).catch((err) => {
        sendResponse({ status: 'error', message: err?.message });
      });
      return true;
    }

    // 8.6 执行扩展一键自动更新 (优先尝试 Native Host 原生覆写与热重载)
    if (action === 'EXECUTE_EXTENSION_AUTO_UPDATE') {
      if (!nativePort) {
        connectToNativeDaemon();
      }

      sendNativeRequest('AUTO_UPDATE_EXTENSION', payload).then((nativeRes) => {
        if (nativeRes && nativeRes.status === 'ok') {
          sendResponse({
            status: 'ok',
            isNative: true,
            message: nativeRes.message || '原生静默更新完成',
            data: nativeRes.data
          });
        } else {
          sendResponse({
            status: 'error',
            isNative: false,
            message: nativeRes?.message || 'Native Host 不可用或返回失败'
          });
        }
      }).catch((err) => {
        sendResponse({ status: 'error', isNative: false, message: err?.message });
      });
      return true;
    }

    // 9. 一键填充到当前激活网页
    if (action === 'AUTOFILL_ACTIVE_TAB') {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:') || tab.url.startsWith('chrome-extension://')) {
          sendResponse({ status: 'error', message: '当前为内部或受保护页面，无法注入填充' });
          return;
        }
        chrome.tabs.sendMessage(tab.id, {
          action: 'AUTOFILL_CREDENTIALS',
          username: payload?.username,
          password: payload?.password,
        }, (res) => {
          const err = chrome.runtime.lastError;
          if (err) {
            sendResponse({ status: 'error', message: '网页尚未载入填充脚本或为受保护页面' });
          } else {
            sendResponse({ status: 'ok', res });
          }
        });
      }).catch((err) => {
        sendResponse({ status: 'error', message: err?.message });
      });
      return true;
    }

    // 10. 两阶段改密安全暂存
    if (action === 'STAGE_CHANGE_PWD') {
      gatekeeper.stage(payload as StagedPasswordChange);
      sendNativeRequest('STAGE_CHANGE_PWD', payload).then((res) => {
        sendResponse(res || { status: 'ok', code: 200 });
      }).catch(() => {
        sendResponse({ status: 'ok', code: 200 });
      });
      return true;
    }

    if (action === 'GET_STAGED_CHANGE') {
      const staged = gatekeeper.getStaged(payload.domain, payload.username);
      sendResponse({ staged });
      return false;
    }

    if (action === 'COMMIT_CHANGE_PWD') {
      const result = gatekeeper.commit(payload.domain, payload.username);
      sendNativeRequest('COMMIT_CHANGE_PWD', payload).then((res) => {
        sendResponse({ ...(res || { status: 'ok' }), gatekeeperResult: result });
      }).catch(() => {
        sendResponse({ status: 'ok', gatekeeperResult: result });
      });
      return true;
    }

    if (action === 'ROLLBACK_CHANGE_PWD') {
      const result = gatekeeper.rollback(payload.domain, payload.username);
      sendResponse({ success: true, rollback: result });
      return false;
    }

    return false;
  });
});
