#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
密诀 MantraKey - GitHub Release 发版日志与安全指纹生成器
参考 weekly-mountain 实践，自动提取版本信息、产物规格、SHA-256 哈希表，生成精美格式的 release_notes.md。
"""

import os
import sys
import json
import hashlib
import argparse

def get_file_sha256(filepath):
    sha = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            sha.update(chunk)
    return sha.hexdigest().lower()

def format_size(bytes_size):
    if bytes_size >= 1024 * 1024:
        return f"{bytes_size / (1024 * 1024):.2f} MB"
    elif bytes_size >= 1024:
        return f"{bytes_size / 1024:.1f} KB"
    return f"{bytes_size} B"

def generate_notes(artifacts_dir, output_path, tag="v0.1.0", version_json_path="releases/version.json"):
    version_info = {}
    if os.path.exists(version_json_path):
        try:
            with open(version_json_path, "r", encoding="utf-8") as f:
                version_info = json.load(f)
        except Exception as e:
            print(f"Warning: failed to read {version_json_path}: {e}")

    title = f"密诀 MantraKey {tag} 全端正式发布版"
    changelog = version_info.get("changelog", (
        "1. 达成 Google Chrome Web Store MV3 商店规范 100% 合规与 ZIP 格式封装；\n"
        "2. 新增 Windows 桌面中枢与浏览器原生代理桩一键部署包 (install_host.bat)；\n"
        "3. Android 移动端具备 Zero-DCE 纯净精简构建与双向安全输入法/自动填充服务；\n"
        "4. 提供全端构建产物统一汇聚管理 (releases/) 与 SHA-256 完整性防篡改指纹校验。"
    ))

    # 扫描产物并提取大小与 SHA256
    files_in_dir = os.listdir(artifacts_dir) if os.path.exists(artifacts_dir) else []

    # 查找对应四个标准产物（优先选择包含 tag 或版本号的文件，避免被 latest 覆盖）
    def pick_artifact(match_fn):
        candidates = [f for f in files_in_dir if match_fn(f)]
        if not candidates:
            return None
        # 优先匹配带有 tag/version 的，次选排除 latest 的
        for c in candidates:
            if tag in c or (tag.lstrip('v') in c and 'latest' not in c):
                return c
        non_latest = [c for c in candidates if 'latest' not in c]
        return non_latest[0] if non_latest else candidates[0]

    ext_file = pick_artifact(lambda f: "chrome-extension" in f and f.endswith(".zip"))
    desk_file = pick_artifact(lambda f: "desktop" in f and f.endswith(".zip"))
    apk_rel_file = pick_artifact(lambda f: f.endswith(".apk") and "release" in f)
    apk_dbg_file = pick_artifact(lambda f: f.endswith(".apk") and "debug" in f)

    artifacts_data = []

    def add_artifact_info(display_name, filename, desc):
        if not filename:
            return
        fp = os.path.join(artifacts_dir, filename)
        sz = os.path.getsize(fp) if os.path.exists(fp) else 0
        sha = get_file_sha256(fp) if os.path.exists(fp) else ""
        artifacts_data.append({
            "display": display_name,
            "filename": filename,
            "sizeText": format_size(sz),
            "sha256": sha,
            "desc": desc
        })

    add_artifact_info("🌐 **Chrome 浏览器扩展**", ext_file, "**Google Chrome / Edge**：符合 Web Store 规范，ZIP 根路径直含 manifest 与四规格 Icon，支持商店后台直接上传或解压测试。")
    add_artifact_info("💻 **Windows 桌面中枢**", desk_file, "**Windows 10/11 x64**：内置桌面密码派生引擎、Native 消息中继桩与一键注册脚本 `install_host.bat`。")
    add_artifact_info("📱 **Android 正式版**", apk_rel_file, "**日常推荐使用**：Zero-DCE 纯净精简构建，集成原生 Autofill 自动填充框架与系统级安全输入法。")
    add_artifact_info("🛠️ **Android 调试版**", apk_dbg_file, "**内测排障版**：集成移动端真机诊断中枢与悬浮反馈球，便于开发者快速反馈与问题追踪。")

    # 构建 Markdown 表格
    lines = [
        f"## 🔐 {title}",
        "",
        "> 💡 **确定性无状态密码管理器**：零存储物理派生、WebDAV 零知识端到端加密同步、动态域名智能泛匹配与全终端安全沙箱联动。",
        "",
        "### 📝 核心更新",
        changelog,
        "",
        "---",
        "",
        "### 📦 全端客户端安装包下载指引",
        "",
        "| 客户端形态 | 安装包文件名 | 文件大小 | 适用平台与场景指引 |",
        "| :--- | :--- | :--- | :--- |"
    ]

    for item in artifacts_data:
        lines.append(f"| {item['display']} | `{item['filename']}` | `{item['sizeText']}` | {item['desc']} |")

    lines.extend([
        "",
        "---",
        "",
        "### 🛡️ 安装包 SHA-256 安全完整性指纹",
        "> 💡 *所有发布文件均经过 SHA-256 原生哈希校验，杜绝第三方镜像篡改与传输损坏：*",
        "",
        "| 文件名 | SHA-256 安全散列值 (小写 64 位) |",
        "| :--- | :--- |"
    ])

    for item in artifacts_data:
        lines.append(f"| `{item['filename']}` | `{item['sha256']}` |")

    lines.extend([
        "",
        "---",
        "",
        "### 🚀 各端使用与部署指南",
        "- 🌐 **Chrome 商店与开发者加载**：下载扩展 ZIP 包后，在 Chrome 访问 `chrome://extensions/`，开启右上角“开发者模式”后将 ZIP 拖入或解压后点击“加载已解压的扩展程序”；亦可直接将本 ZIP 提交至 [Google Chrome Web Store 开发者控制台](https://chrome.google.com/webstore/devconsole/) 发布上线。",
        "- 💻 **Windows 桌面端与代理桩**：解压桌面 ZIP 至固定目录，双击运行 `install_host.bat`，即可一键将原生通道注册至系统 Chrome / Edge，与浏览器扩展建立零拷贝 IPC 信道。",
        "- 📱 **Android 端安装**：在 Android 设备上直接下载 `.apk` 文件安装（若系统提示“未知来源应用安装”，选择“允许来自此来源的应用安装”即可）。",
        ""
    ])

    notes_content = "\n".join(lines)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(notes_content)

    print(f"[ReleaseNotes] 成功生成发版说明: {output_path}")

    # GitHub Actions 输出
    github_output = os.environ.get("GITHUB_OUTPUT")
    if github_output and os.path.exists(github_output):
        with open(github_output, "a", encoding="utf-8") as f:
            f.write(f"title={title}\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate release notes for MantraKey")
    parser.add_argument("--artifacts-dir", default="releases", help="Directory containing release artifacts")
    parser.add_argument("--output", default="release_notes.md", help="Output release notes markdown file")
    parser.add_argument("--tag", default="v0.1.0", help="Release tag")
    parser.add_argument("--version-json", default="releases/version.json", help="Path to version.json")
    args = parser.parse_args()

    generate_notes(args.artifacts_dir, args.output, args.tag, args.version_json)
