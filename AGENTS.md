# MantraKey 项目级开发与发版规范

> 本文件作为 `mantra-key` 仓库的项目级协作基线，与用户全局规范协同生效（全局安全红线与 Git 提交流程具有最高优先级）。

## 1. 版本号与 Tag 发布规范

本项目全端统一采用 **4 段式版本号**：`<Major>.<Minor>.<Patch>.<BuildTimestamp>`（例如 `0.1.2.202611251120`）。

1. **Tag 正式发布规则**：
   - **每次推送新的发布 Tag 时，前三位（`Major.Minor.Patch`）至少有一位必须迭代**（依据变更性质递增 `Major` / `Minor` / `Patch`，例如 `0.1.1 -> 0.1.2` 或 `0.2.0`）。
   - 严禁在连续发布多个正式 Tag 时前三位保持不变、仅修改第 4 位时间戳。
2. **本地构建规则**：
   - 本地开发构建、打包与发版同步时，**仍须持续维护第 4 位构建时间戳**（格式 `YYYYMMDDHHMM`），用于区分本地测试构建批次并兼容各端 `compareVersions` 的增量更新判定。
3. **版本同步清单**（发版或本地构建升级版本时需全端对齐）：
   - [package.json](package.json)（`version`）
   - [apps/extension/package.json](apps/extension/package.json)（`version`）与 [apps/extension/wxt.config.ts](apps/extension/wxt.config.ts)（`rawVersion`；`manifest.version` 自动取前 3 位以符合 Chrome MV3 每段 `<= 65535` 要求，`version_name` 保留完整 4 位）
   - [apps/android/app/build.gradle.kts](apps/android/app/build.gradle.kts)（`versionCode` 递增、`versionName` 同步完整 4 位）
   - [apps/android/web/package.json](apps/android/web/package.json) 与 [apps/android/web/src/config/update.json](apps/android/web/src/config/update.json)
   - [public/version.json](public/version.json)（`version`、`versionTag`、`title` 与产物链接）

## 2. GitHub Release 发布规范

1. **Release 标题格式**：统一精简为 **`MantraKey <tag>`**（例如 `MantraKey v0.1.2.202611251120`）。
   - 相关脚本与工作流：[release.yml](.github/workflows/release.yml)、[generate_release_notes.py](scripts/generate_release_notes.py)、[build_all.py](scripts/build_all.py)、[build_android.ps1](scripts/build_android.ps1)、[public/version.json](public/version.json)。
2. **SHA-256 指纹对齐**：Release 资产以 GitHub Actions CI 产出的 `SHA256SUMS.txt` 为权威指纹源，并由 CI 自动回写至 `public/version.json`。

## 3. 端侧研发与兼容性红线

1. **Chrome 扩展 MV3 CSP 合规**：
   - 严禁在扩展 HTML 或动态拼接的 `innerHTML` 中使用任何内联事件属性（如 `onclick`、`onmouseover`、`onmouseout` 等），须使用纯 CSS 伪类或 `addEventListener` 绑定。
   - 所有 `chrome.runtime.sendMessage`、`chrome.tabs.sendMessage` 与 `nativePort.onDisconnect` 回调必须读取并消费 `chrome.runtime.lastError`，并过滤 `chrome://` / `edge://` / `about:` / `chrome-extension://` 等受保护页面。
2. **Windows 批处理脚本编码**：
   - 分发给 Windows `cmd.exe` 执行的 `.bat` 脚本（如 `install_host.bat`）必须保存为 **ANSI / GBK (`CP936`) + CRLF (`\r\n`)**，不得使用 `chcp 65001` 与带中文的多行括号语句块，防止字节偏移截断与终端乱码。
3. **Android WebView 交互兼容**：
   - 不得单独依赖浏览器原生 `window.prompt` / `window.confirm` 承担核心编辑或确认流程，优先使用页面内联组件并在原生 `WebChromeClient` 中保留弹窗兜底实现。

## 4. Agent Feedback 工单闭环硬门禁

1. **严禁直接手改反馈 JSON 文件**：
   - 严禁手动编辑 `scratch/feedback/feedback_*.json` 来改写工单状态，避免遗漏 `feedback_queue.json` 同步或误填前端不识别的状态枚举（如误填 `resolved` 导致客户端 `renderStatusBadge` 落入 `default` 分支显示为“⏱ 排队中”）。
2. **唯一合法状态枚举**：
   - 合法完成/终态值以 `@lylyuanliang/agent-feedback-client` 与 `@lylyuanliang/agent-feedback-sentinel` 规范为准：**`completed`**（`✓ 修复完成`）、`rejected`（`✕ 安全驳回`）、`ignored`（`已忽略`），处理中为 `processing`。
3. **必须通过官方 CLI / API 回写并核验**：
   - 完成任何端侧反馈工单排查与修复后，交付前**必须执行**官方 CLI 同步更新分片与队列：
     `node node_modules/.pnpm/@lylyuanliang+agent-feedback-sentinel@1.5.1/node_modules/@lylyuanliang/agent-feedback-sentinel/bin/cli.js update-status <id> completed "<修复说明>" --dir scratch/feedback`（或调用 `POST /api/__agent_feedback/status`）。
   - 执行完毕后须核验 `scratch/feedback/feedback_queue.json` 与所有 `feedback_YYYY-MM-DD.json` 中已修复工单状态均已变更为 `completed`。
