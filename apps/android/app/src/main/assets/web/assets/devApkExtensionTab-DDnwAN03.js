import { isAuthorized, authorize, openFeedbackModal, getApiBase, setApiBase, deauthorize } from "./dist-B6armV2R.js";
const devApkExtensionTab = {
  id: "mantra-dev-apk",
  label: "本地包",
  icon: "📦",
  render(container) {
    let unmounted = false;
    function formatBytes(bytes) {
      if (!bytes || bytes <= 0) return "0 B";
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
      return (bytes / (1024 * 1024)).toFixed(2) + " MB";
    }
    container.innerHTML = `
      <div class="dev-apk-container" style="
        display: flex;
        flex-direction: column;
        gap: 12px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #f1f5f9;
        padding: 4px 0 16px 0;
        box-sizing: border-box;
      ">
        <div id="dev-apk-content"></div>
      </div>
    `;
    const contentEl = container.querySelector("#dev-apk-content");
    let isEditingTunnel = false;
    let authError = "";
    let isVerifying = false;
    let artifactInfo = null;
    let loadingArtifact = false;
    let artifactError = "";
    let downloadState = null;
    const prevProgressHandler = window.onMantraDownloadProgress;
    window.onMantraDownloadProgress = (payload) => {
      if (typeof prevProgressHandler === "function") {
        try {
          prevProgressHandler(payload);
        } catch {
        }
      }
      if (unmounted) return;
      downloadState = {
        isDownloading: (payload == null ? void 0 : payload.status) === "downloading" || (payload == null ? void 0 : payload.status) === "verifying",
        status: (payload == null ? void 0 : payload.status) || "downloading",
        percent: Math.max(0, Math.min(100, Number(payload == null ? void 0 : payload.percent) || 0)),
        receivedBytes: Number(payload == null ? void 0 : payload.receivedBytes) || 0,
        totalBytes: Number(payload == null ? void 0 : payload.totalBytes) || 0,
        message: (payload == null ? void 0 : payload.message) || ""
      };
      renderView();
    };
    function renderView() {
      if (unmounted) return;
      const authorized = isAuthorized();
      if (!authorized) {
        contentEl.innerHTML = `
          <div style="
            background: #111726;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 12px;
          ">
            <div style="font-size: 24px; text-align: center;">🔒</div>
            <div style="font-size: 14px; font-weight: 700; text-align: center; color: #fff;">开发机本地联调受限</div>
            <div style="font-size: 11px; color: #94a3b8; line-height: 1.5; text-align: center;">
              本地构建 APK 直连下载专为内部联调与自愈测试设计。请输入开发机配对密钥以解锁访问。
            </div>

            <div style="display: flex; flex-direction: column; gap: 8px;">
              <input
                id="input-pairing-secret"
                type="password"
                placeholder="输入开发机配对密钥 (mk-...)"
                style="
                  width: 100%;
                  padding: 8px 10px;
                  background: #0b0f17;
                  border: 1px solid rgba(255, 255, 255, 0.15);
                  border-radius: 7px;
                  color: #fff;
                  font-family: monospace;
                  font-size: 12px;
                  outline: none;
                  box-sizing: border-box;
                "
              />
              <div style="display: flex; gap: 8px;">
                <button
                  id="btn-confirm-pairing"
                  type="button"
                  style="
                    flex: 1;
                    padding: 8px;
                    border-radius: 7px;
                    background: linear-gradient(135deg, #10b981 0%, #00f0ff 100%);
                    border: none;
                    color: #0b0f17;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                  "
                >
                  ${isVerifying ? "验证中..." : "立即配对解锁"}
                </button>
                <button
                  id="btn-goto-settings"
                  type="button"
                  style="
                    padding: 8px 12px;
                    border-radius: 7px;
                    background: rgba(255, 255, 255, 0.06);
                    border: 1px solid rgba(255, 255, 255, 0.12);
                    color: #cbd5e1;
                    font-size: 11px;
                    cursor: pointer;
                  "
                >
                  ⚙️ 联调设置
                </button>
              </div>
              ${authError ? `<div style="font-size: 11px; color: #ef4444;">⚠️ ${authError}</div>` : ""}
            </div>

            <div style="
              font-size: 10px;
              color: #94a3b8;
              line-height: 1.5;
              background: rgba(0, 0, 0, 0.25);
              padding: 8px 10px;
              border-radius: 6px;
              border: 1px dashed rgba(255, 255, 255, 0.08);
            ">
              💡 密钥生成并存放于电脑端开发机项目根目录：<br/>
              <code style="color: #00f0ff;">scratch/.agent-feedback-secret</code>
            </div>
          </div>
        `;
        const inputSecret = contentEl.querySelector("#input-pairing-secret");
        const btnConfirm = contentEl.querySelector("#btn-confirm-pairing");
        const btnSettings = contentEl.querySelector("#btn-goto-settings");
        btnConfirm == null ? void 0 : btnConfirm.addEventListener("click", async () => {
          var _a;
          const secret = (_a = inputSecret == null ? void 0 : inputSecret.value) == null ? void 0 : _a.trim();
          if (!secret) {
            authError = "请输入配对密钥";
            renderView();
            return;
          }
          isVerifying = true;
          authError = "";
          renderView();
          try {
            const ok = await authorize(secret);
            if (ok) {
              authError = "";
              renderView();
              fetchArtifacts();
            } else {
              authError = "配对密钥不匹配，请核对 scratch/.agent-feedback-secret";
              renderView();
            }
          } catch (e) {
            authError = (e == null ? void 0 : e.message) || "验证失败";
            renderView();
          } finally {
            isVerifying = false;
          }
        });
        btnSettings == null ? void 0 : btnSettings.addEventListener("click", () => {
          openFeedbackModal("settings");
        });
        return;
      }
      const apiBase = getApiBase() || (typeof window !== "undefined" ? window.location.origin : "");
      const isNative = typeof window !== "undefined" && !!window.MantraNative;
      contentEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <!-- 联调穿透状态 -->
          <div style="
            background: #111726;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 8px;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700;">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></span>
                <span>开发机直连通道</span>
              </div>
              <div style="display: flex; gap: 6px; align-items: center;">
                <span style="font-size: 9.5px; background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(16, 185, 129, 0.3);">🟢 已配对</span>
                <span style="font-size: 9.5px; background: rgba(255, 255, 255, 0.06); color: #94a3b8; padding: 1px 6px; border-radius: 4px;">${isNative ? "Android 原生" : "Web 环境"}</span>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #94a3b8;">
                <span>穿透基地址：</span>
                ${!isEditingTunnel ? `<button id="btn-edit-tunnel" type="button" style="background:none; border:none; color:#00f0ff; font-size:10px; cursor:pointer;">✎ 修改</button>` : ""}
              </div>

              ${isEditingTunnel ? `
                <div style="display: flex; gap: 6px;">
                  <input
                    id="input-tunnel"
                    type="text"
                    value="${apiBase}"
                    style="flex: 1; padding: 4px 8px; background: #0b0f17; border: 1px solid rgba(0, 240, 255, 0.3); border-radius: 5px; color: #fff; font-size: 11px; outline: none;"
                  />
                  <button id="btn-save-tunnel" type="button" style="padding: 4px 8px; background: #10b981; border: none; border-radius: 5px; color: #0b0f17; font-weight: 700; font-size: 10.5px; cursor: pointer;">保存</button>
                  <button id="btn-cancel-tunnel" type="button" style="padding: 4px 6px; background: rgba(255,255,255,0.08); border: none; border-radius: 5px; color: #cbd5e1; font-size: 10.5px; cursor: pointer;">取消</button>
                </div>
              ` : `
                <div style="padding: 6px 8px; background: rgba(0, 0, 0, 0.3); border-radius: 6px; font-family: monospace; font-size: 10.5px; color: #e2e8f0; word-break: break-all;">
                  ${apiBase || "未配置 (默认同源)"}
                </div>
              `}
            </div>

            <div style="display: flex; justify-content: flex-end; margin-top: 2px;">
              <button id="btn-deauthorize" type="button" style="background: none; border: none; color: #64748b; font-size: 9.5px; text-decoration: underline; cursor: pointer;">解除当前设备密钥配对</button>
            </div>
          </div>

          <!-- 本地最新构建产物卡片 -->
          <div style="
            background: #111726;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 12px;
            padding: 12px 14px;
            display: flex;
            flex-direction: column;
            gap: 10px;
          ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 12px; font-weight: 700; color: #fff;">📦 开发机产物 (免发布直传)</span>
              <button id="btn-refresh-artifact" type="button" style="background: none; border: none; color: #00f0ff; font-size: 10.5px; cursor: pointer;">🔄 刷新</button>
            </div>

            ${loadingArtifact ? `
              <div style="text-align: center; padding: 12px; font-size: 11px; color: #94a3b8;">正在探测开发机产物接口...</div>
            ` : artifactError ? `
              <div style="padding: 8px 10px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; font-size: 10.5px; color: #f87171; line-height: 1.4;">
                ${artifactError}
              </div>
            ` : artifactInfo ? `
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 10.5px;">
                <div style="grid-column: span 2; display: flex; flex-direction: column; gap: 2px;">
                  <span style="color: #64748b;">产物包名</span>
                  <span style="font-family: monospace; color: #f1f5f9; word-break: break-all;">${artifactInfo.apkName || "mantra-key-debug.apk"}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="color: #64748b;">体积大小</span>
                  <span style="color: #00f0ff; font-weight: 700;">${artifactInfo.fileSize || "未知"}</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="color: #64748b;">编译时间</span>
                  <span style="color: #cbd5e1;">${artifactInfo.updateTime || "刚刚"}</span>
                </div>
              </div>

              <div style="display: flex; gap: 8px; margin-top: 4px;">
                <button
                  id="btn-dl-debug"
                  type="button"
                  style="
                    flex: 1.3;
                    padding: 9px;
                    border-radius: 7px;
                    background: linear-gradient(135deg, #10b981 0%, #00f0ff 100%);
                    border: none;
                    color: #0b0f17;
                    font-size: 11.5px;
                    font-weight: 700;
                    cursor: pointer;
                  "
                >
                  ⬇️ 下载本地 Debug APK
                </button>
                <button
                  id="btn-dl-release"
                  type="button"
                  style="
                    flex: 1;
                    padding: 9px;
                    border-radius: 7px;
                    background: rgba(0, 240, 255, 0.08);
                    border: 1px solid rgba(0, 240, 255, 0.25);
                    color: #00f0ff;
                    font-size: 11px;
                    font-weight: 600;
                    cursor: pointer;
                  "
                >
                  ⬇️ Release APK
                </button>
              </div>

              ${downloadState ? `
                <div style="
                  margin-top: 4px;
                  background: #0b0f17;
                  border: 1px solid ${downloadState.status === "error" ? "rgba(239, 68, 68, 0.4)" : downloadState.status === "success" ? "rgba(16, 185, 129, 0.4)" : "rgba(0, 240, 255, 0.3)"};
                  border-radius: 8px;
                  padding: 10px 12px;
                  display: flex;
                  flex-direction: column;
                  gap: 8px;
                ">
                  <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
                    <span style="font-weight: 600; color: #fff;">
                      ${downloadState.status === "success" ? "✅ 下载完成，正在调起系统安装器" : downloadState.status === "error" ? "❌ 下载中断" : downloadState.status === "verifying" ? "🔍 正在校验 SHA-256 完整性..." : downloadState.status === "pending_permission" ? "⚠️ 需要应用安装权限，请在设置中允许" : "⬇️ 正在下载本地安装包..."}
                    </span>
                    <span style="font-family: monospace; color: #00f0ff; font-weight: 700;">
                      ${downloadState.percent}%
                    </span>
                  </div>

                  <!-- 动态高光进度条 -->
                  <div style="width: 100%; height: 7px; background: rgba(255, 255, 255, 0.08); border-radius: 4px; overflow: hidden;">
                    <div style="
                      width: ${Math.max(2, Math.min(100, downloadState.percent))}%;
                      height: 100%;
                      background: ${downloadState.status === "error" ? "#ef4444" : "linear-gradient(90deg, #10b981 0%, #00f0ff 100%)"};
                      border-radius: 4px;
                      transition: width 0.15s ease;
                      box-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
                    "></div>
                  </div>

                  <div style="display: flex; justify-content: space-between; font-size: 9.5px; color: #94a3b8;">
                    <span>${formatBytes(downloadState.receivedBytes)} / ${formatBytes(downloadState.totalBytes)}</span>
                    <span style="color: ${downloadState.status === "error" ? "#f87171" : "#cbd5e1"};">
                      ${downloadState.message || (downloadState.status === "downloading" ? "正在通过穿透隧道高速传输..." : "")}
                    </span>
                  </div>

                  ${downloadState.status === "error" ? `
                    <div style="display: flex; gap: 8px; margin-top: 2px;">
                      <button
                        id="btn-retry-download"
                        type="button"
                        style="
                          flex: 1;
                          padding: 6px;
                          background: rgba(239, 68, 68, 0.15);
                          border: 1px solid rgba(239, 68, 68, 0.3);
                          border-radius: 5px;
                          color: #fca5a5;
                          font-size: 10.5px;
                          font-weight: 600;
                          cursor: pointer;
                        "
                      >
                        🔄 重新下载
                      </button>
                    </div>
                  ` : ""}
                </div>
              ` : ""}
            ` : `
              <div style="text-align: center; padding: 10px; font-size: 11px; color: #94a3b8;">暂未检测到开发机构建包，请点击上方“刷新”探测。</div>
            `}
          </div>
        </div>
      `;
      const btnEditTunnel = contentEl.querySelector("#btn-edit-tunnel");
      btnEditTunnel == null ? void 0 : btnEditTunnel.addEventListener("click", () => {
        isEditingTunnel = true;
        renderView();
      });
      const btnCancelTunnel = contentEl.querySelector("#btn-cancel-tunnel");
      btnCancelTunnel == null ? void 0 : btnCancelTunnel.addEventListener("click", () => {
        isEditingTunnel = false;
        renderView();
      });
      const btnSaveTunnel = contentEl.querySelector("#btn-save-tunnel");
      btnSaveTunnel == null ? void 0 : btnSaveTunnel.addEventListener("click", () => {
        const inputT = contentEl.querySelector("#input-tunnel");
        let val = ((inputT == null ? void 0 : inputT.value) || "").trim().replace(/\/+$/, "");
        if (val && !/^https?:\/\//i.test(val)) {
          val = "http://" + val;
        }
        setApiBase(val);
        try {
          localStorage.setItem("af_api_base", val);
          localStorage.setItem("mk_debug_tunnel_url", val);
        } catch {
        }
        isEditingTunnel = false;
        renderView();
        fetchArtifacts();
      });
      const btnDeauth = contentEl.querySelector("#btn-deauthorize");
      btnDeauth == null ? void 0 : btnDeauth.addEventListener("click", () => {
        deauthorize();
        renderView();
      });
      const btnRefresh = contentEl.querySelector("#btn-refresh-artifact");
      btnRefresh == null ? void 0 : btnRefresh.addEventListener("click", () => {
        fetchArtifacts();
      });
      const btnDlDebug = contentEl.querySelector("#btn-dl-debug");
      btnDlDebug == null ? void 0 : btnDlDebug.addEventListener("click", () => downloadApk("debug"));
      const btnDlRelease = contentEl.querySelector("#btn-dl-release");
      btnDlRelease == null ? void 0 : btnDlRelease.addEventListener("click", () => downloadApk("release"));
      const btnRetry = contentEl.querySelector("#btn-retry-download");
      btnRetry == null ? void 0 : btnRetry.addEventListener("click", () => downloadApk("debug"));
    }
    async function fetchArtifacts() {
      loadingArtifact = true;
      artifactError = "";
      renderView();
      const base = getApiBase() || (typeof window !== "undefined" ? window.location.origin : "");
      if (!base || base.includes("localhost") && window.MantraNative) {
        loadingArtifact = false;
        artifactError = "手机真机请点击上方修改穿透地址，填入开发机局域网 IP（例如 http://192.168.1.xxx:5173）或穿透域名。";
        renderView();
        return;
      }
      try {
        const res = await fetch(`${base.replace(/\/+$/, "")}/api/app-update?t=${Date.now()}`, {
          signal: AbortSignal.timeout(6e3)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        artifactInfo = data;
        artifactError = "";
      } catch (e) {
        artifactError = (e == null ? void 0 : e.message) || "无法连接开发机 /api/app-update 接口";
      } finally {
        loadingArtifact = false;
        renderView();
      }
    }
    function downloadApk(variant) {
      var _a;
      const base = (getApiBase() || window.location.origin).replace(/\/+$/, "");
      const downloadUrl = variant === "debug" && (artifactInfo == null ? void 0 : artifactInfo.downloadUrl) ? artifactInfo.downloadUrl : `${base}/releases/mantra-key-latest-${variant}.apk`;
      downloadState = {
        isDownloading: true,
        status: "downloading",
        percent: 0,
        receivedBytes: 0,
        totalBytes: 0,
        message: "正在建立连接并准备下载..."
      };
      renderView();
      if (typeof window !== "undefined" && ((_a = window.MantraNative) == null ? void 0 : _a.downloadAndInstallApk)) {
        window.MantraNative.downloadAndInstallApk(downloadUrl, `dev-${variant}-${Date.now()}`, null);
        return;
      }
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `mantra-key-${variant}.apk`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
    renderView();
    if (isAuthorized()) {
      fetchArtifacts();
    }
    return () => {
      unmounted = true;
    };
  }
};
export {
  devApkExtensionTab
};
