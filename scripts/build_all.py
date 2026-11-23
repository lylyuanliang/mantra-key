#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
密诀 MantraKey - 全端构建产物统一汇聚与发版流水线
支持一键打包与发布：
1. 浏览器扩展 (Chrome Web Store MV3 生产标准 ZIP + 解压调试包)
2. 桌面客户端与原生代理 (Windows x64 ZIP + 一键注册脚本)
3. 移动端 (Android Release & Debug APK)
4. 计算全产物 SHA-256 安全散列表 (SHA256SUMS.txt) 与发版元数据 (version.json)
"""

import os
import sys
import json
import shutil
import hashlib
import zipfile
import subprocess
from datetime import datetime

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
RELEASES_DIR = os.path.join(ROOT_DIR, "releases")
VERSION = "0.1.0"

def log(msg, color="\033[92m"):
    reset = "\033[0m"
    print(f"{color}[MantraKey Release] {msg}{reset}")

def make_crlf_gbk_bytes(text: str) -> bytes:
    """强制使用 Windows CRLF 换行符与 GBK 编码，确保 Windows cmd.exe 打开百分之百不乱码、不截断指令"""
    crlf_text = text.replace("\r\n", "\n").replace("\n", "\r\n")
    return crlf_text.encode("gbk", errors="replace")

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

def build_extension():
    log("=== 1. 构建与打包 Chrome MV3 浏览器扩展 ===", "\033[96m")
    ext_dir = os.path.join(ROOT_DIR, "apps", "extension")

    # 编译
    log("正在编译浏览器扩展 (pnpm --filter @mantra-key/extension build)...")
    res = subprocess.run(["pnpm", "--filter", "@mantra-key/extension", "build"], cwd=ROOT_DIR, shell=True)
    if res.returncode != 0:
        raise RuntimeError("浏览器扩展编译失败！")

    # 打包 zip
    log("正在打包 Chrome MV3 发布 ZIP (pnpm --filter @mantra-key/extension zip)...")
    res = subprocess.run(["pnpm", "--filter", "@mantra-key/extension", "zip"], cwd=ROOT_DIR, shell=True)
    if res.returncode != 0:
        raise RuntimeError("浏览器扩展 ZIP 打包失败！")

    out_dir = os.path.join(ext_dir, ".output")
    # 寻找生成的 zip
    zip_candidates = [f for f in os.listdir(out_dir) if f.endswith(".zip")]
    if not zip_candidates:
        raise RuntimeError("未在 .output 中检测到生成的 ZIP 文件！")

    src_zip = os.path.join(out_dir, zip_candidates[0])
    target_zip = os.path.join(RELEASES_DIR, f"mantra-key-chrome-extension-v{VERSION}.zip")
    latest_zip = os.path.join(RELEASES_DIR, "mantra-key-chrome-extension-latest.zip")

    # 复制与补充 Native 自动更新辅助组件至发布 ZIP 包中
    proxy_exe = os.path.join(ROOT_DIR, "target", "release", "mantra-native-proxy.exe")
    enable_update_bat = """@echo off
title 密诀 MantraKey - 启用扩展自动更新
echo ========================================================
echo   密诀 MantraKey - 原生自动更新服务一键配置
echo ========================================================
echo.
echo 正在检测并注册本地 Native 代理到 Chrome 与 Edge 注册表...
"%~dp0mantra-native-proxy.exe" --register
echo.
pause
"""

    readme_txt = f"""密诀 MantraKey - 浏览器扩展安装与自动更新指南 (v{VERSION})
======================================================

【第一步：解压并保存】
将本 ZIP 压缩包解压到一个固定的本地文件夹（例如：D:\\Tools\\MantraKey-Extension），
请勿放在临时目录，后续自动更新将直接在此目录下原地热覆盖升级。

【第二步：加载到浏览器】
1. 打开 Chrome 浏览器，在地址栏输入：chrome://extensions 并按回车；
2. 在页面右上角打开「开发者模式」开关；
3. 点击左上角的「加载已解压的扩展程序」按钮；
4. 选择刚刚解压的这个文件夹。

【第三步：开启静默自动更新（仅需一次）】
在解压文件夹中，双击运行「启用自动更新.bat」。
注册表将自动登记该目录下的 Native 代理服务（写入当前用户注册表，无需管理员权限）。

大功告成！
以后当 GitHub 发布新版本时，在插件主面板点击「⚡ 一键更新」，
本地 Native 代理将自动下载最新版本并原地覆盖，浏览器扩展秒级自动热重载！
"""

    # 读取原本由 wxt zip 生成的内容，并写入辅助组件生成全功能分发 ZIP
    with zipfile.ZipFile(src_zip, 'r') as zin, zipfile.ZipFile(target_zip, 'w', zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            zout.writestr(item, zin.read(item.filename))
        if os.path.exists(proxy_exe):
            zout.write(proxy_exe, "mantra-native-proxy.exe")
        zout.writestr("启用自动更新.bat", make_crlf_gbk_bytes(enable_update_bat))
        zout.writestr("README_安装与自动更新说明.txt", make_crlf_gbk_bytes(readme_txt))

    shutil.copy2(target_zip, latest_zip)

    # 同时复制解压版本供开发者直接加载
    unpacked_src = os.path.join(out_dir, "chrome-mv3")
    unpacked_dest = os.path.join(RELEASES_DIR, "extension", "chrome-mv3")
    if os.path.exists(unpacked_dest):
        shutil.rmtree(unpacked_dest)
    if os.path.exists(unpacked_src):
        shutil.copytree(unpacked_src, unpacked_dest)
        if os.path.exists(proxy_exe):
            shutil.copy2(proxy_exe, os.path.join(unpacked_dest, "mantra-native-proxy.exe"))
        with open(os.path.join(unpacked_dest, "启用自动更新.bat"), "wb") as bf:
            bf.write(make_crlf_gbk_bytes(enable_update_bat))
        with open(os.path.join(unpacked_dest, "README_安装与自动更新说明.txt"), "wb") as rf:
            rf.write(make_crlf_gbk_bytes(readme_txt))

    log(f"Chrome 扩展发布包已就绪: {target_zip} ({format_size(os.path.getsize(target_zip))})")
    return target_zip

def build_desktop():
    log("=== 2. 构建与打包 Windows 桌面客户端与 Native 代理 ===", "\033[96m")

    desktop_exe = os.path.join(ROOT_DIR, "target", "release", "mantra-desktop.exe")
    proxy_exe = os.path.join(ROOT_DIR, "target", "release", "mantra-native-proxy.exe")

    # 检查是否已编译，未编译则构建
    if not (os.path.exists(desktop_exe) and os.path.exists(proxy_exe)):
        log("正在通过 Cargo 构建 Windows x64 生产二进制...")
        res = subprocess.run(["cargo", "build", "--release", "--bin", "mantra-desktop", "--bin", "mantra-native-proxy"], cwd=ROOT_DIR, shell=True)
        if res.returncode != 0:
            raise RuntimeError("Cargo 桌面端构建失败！")

    # 打包为 zip
    target_zip = os.path.join(RELEASES_DIR, f"mantra-key-desktop-v{VERSION}-windows-x64.zip")
    latest_zip = os.path.join(RELEASES_DIR, "mantra-key-desktop-latest-windows-x64.zip")

    # 动态创建打包内容
    host_manifest = {
        "name": "org.mantrakey.native_proxy",
        "description": "MantraKey Native Messaging Host for Chrome & Edge",
        "path": "mantra-native-proxy.exe",
        "type": "stdio",
        "allowed_origins": [
            "chrome-extension://bggcaoiaeleahlgnglcglifibgolhief/",
            "chrome-extension://*/"
        ]
    }

    install_bat = """@echo off
title 密诀 MantraKey - 注册原生代理通道
echo ========================================================
echo   密诀 MantraKey - 桌面中枢与浏览器原生代理一键配置
echo ========================================================
echo.
echo 正在检测扩展并注册原生代理服务...
"%~dp0mantra-native-proxy.exe" --register
echo.
pause
"""

    uninstall_bat = """@echo off
title 密诀 MantraKey - 卸载原生服务
echo ========================================================
echo   密诀 MantraKey - 原生代理服务卸载
echo ========================================================
echo.
echo 正在移除 Chrome 与 Edge 的原生代理注册表项...
REG DELETE "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\org.mantrakey.native_proxy" /f >nul 2>&1
REG DELETE "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\org.mantrakey.native_proxy" /f >nul 2>&1
echo [完成] 原生代理服务注册表已安全移除。
echo.
pause
"""

    readme_txt = f"""密诀 MantraKey - Windows 桌面中枢与原生代理 (v{VERSION})
=====================================================

包含组件：
1. mantra-desktop.exe       - 密诀桌面中枢服务与全局快捷键面板
2. mantra-native-proxy.exe  - 浏览器原生消息 (Native Messaging) 中继代理桩
3. install_host.bat         - 双击一键将代理桩注册至系统 Chrome / Edge 浏览器
4. uninstall_host.bat       - 卸载代理桩注册表项

使用指引：
1. 将本压缩包解压至固定目录（如 C:\\Program Files\\MantraKey 或 D:\\soft\\MantraKey）；
2. 双击运行 install_host.bat 注册浏览器原生通道；
3. 打开 Chrome 扩展设置页，即可无缝与本地原生安全沙箱完成握手联动！
"""

    with zipfile.ZipFile(target_zip, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(desktop_exe, "mantra-desktop.exe")
        z.write(proxy_exe, "mantra-native-proxy.exe")
        z.writestr("org.mantrakey.native_proxy.json", json.dumps(host_manifest, indent=2, ensure_ascii=False))
        z.writestr("install_host.bat", make_crlf_gbk_bytes(install_bat))
        z.writestr("uninstall_host.bat", make_crlf_gbk_bytes(uninstall_bat))
        z.writestr("README.txt", make_crlf_gbk_bytes(readme_txt))

    shutil.copy2(target_zip, latest_zip)
    log(f"Windows 桌面端发布包已就绪: {target_zip} ({format_size(os.path.getsize(target_zip))})")
    return target_zip

def verify_android_apks():
    log("=== 3. 检查与汇总 Android 移动端 APK ===", "\033[96m")
    rel_apk = os.path.join(RELEASES_DIR, f"mantra-key-v{VERSION}-release.apk")
    dbg_apk = os.path.join(RELEASES_DIR, f"mantra-key-v{VERSION}-debug.apk")

    if not (os.path.exists(rel_apk) and os.path.exists(dbg_apk)):
        log("未检测到预存 APK，正在调用 scripts/build_android.ps1 进行编译...")
        res = subprocess.run(["pwsh", "-File", "scripts/build_android.ps1", "-NoPause"], cwd=ROOT_DIR, shell=True)
        if res.returncode != 0:
            log("警告: Android 本地构建未完成，请确认环境是否具备 Android SDK。跳过本地实时编译，使用已有包。", "\033[93m")

    results = []
    for apk_path in [rel_apk, dbg_apk]:
        if os.path.exists(apk_path):
            log(f"Android APK 已确认: {apk_path} ({format_size(os.path.getsize(apk_path))})")
            results.append(apk_path)
    return results

def generate_checksums_and_metadata():
    log("=== 4. 生成统一 SHA256SUMS.txt 与发版元数据 version.json ===", "\033[96m")

    # 汇总所有需要被分发和校验的产物文件
    target_files = [
        f"mantra-key-chrome-extension-v{VERSION}.zip",
        f"mantra-key-desktop-v{VERSION}-windows-x64.zip",
        f"mantra-key-v{VERSION}-release.apk",
        f"mantra-key-v{VERSION}-debug.apk"
    ]

    sums = []
    artifacts_meta = {}

    for filename in target_files:
        filepath = os.path.join(RELEASES_DIR, filename)
        if os.path.exists(filepath):
            sha = get_file_sha256(filepath)
            size = os.path.getsize(filepath)
            sums.append(f"{sha} *{filename}")
            artifacts_meta[filename] = {
                "name": filename,
                "sha256": sha,
                "size": size,
                "sizeText": format_size(size),
                "downloadUrl": f"https://github.com/lylyuanliang/mantra-key/releases/download/v{VERSION}/{filename}"
            }

    # 写入 SHA256SUMS.txt
    sums_file = os.path.join(RELEASES_DIR, "SHA256SUMS.txt")
    with open(sums_file, "w", encoding="utf-8") as f:
        f.write("\n".join(sums) + "\n")
    log(f"SHA256SUMS.txt 已生成: {sums_file}")

    # 读取或构建 version.json
    version_file = os.path.join(RELEASES_DIR, "version.json")
    v_data = {
        "version": VERSION,
        "versionTag": f"v{VERSION}",
        "title": f"密诀 MantraKey v{VERSION} 全端正式发布版",
        "changelog": "1. 达成 Chrome Web Store MV3 商店规范 100% 合规与 ZIP 格式封装\n2. 新增 Windows 桌面中枢与浏览器原生代理桩一键部署包\n3. Android 移动端具备 Zero-DCE 纯净精简构建与双向安全输入法\n4. 提供全端统一构建目录 releases/ 与 SHA-256 完整性防篡改校验",
        "publishedAt": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "htmlUrl": f"https://github.com/lylyuanliang/mantra-key/releases/tag/v{VERSION}",
        "artifacts": artifacts_meta,
        # 兼容旧版 Android 下载字段
        "releaseDownloadUrl": artifacts_meta.get(f"mantra-key-v{VERSION}-release.apk", {}).get("downloadUrl", ""),
        "debugDownloadUrl": artifacts_meta.get(f"mantra-key-v{VERSION}-debug.apk", {}).get("downloadUrl", ""),
        "releaseSha256": artifacts_meta.get(f"mantra-key-v{VERSION}-release.apk", {}).get("sha256", ""),
        "debugSha256": artifacts_meta.get(f"mantra-key-v{VERSION}-debug.apk", {}).get("sha256", ""),
        "extensionDownloadUrl": artifacts_meta.get(f"mantra-key-chrome-extension-v{VERSION}.zip", {}).get("downloadUrl", ""),
        "desktopDownloadUrl": artifacts_meta.get(f"mantra-key-desktop-v{VERSION}-windows-x64.zip", {}).get("downloadUrl", "")
    }

    with open(version_file, "w", encoding="utf-8") as f:
        json.dump(v_data, f, indent=4, ensure_ascii=False)
    log(f"version.json 已生成: {version_file}")

    # 同步至 Android web/public 目录供本地热启动直连下载
    web_public = os.path.join(ROOT_DIR, "apps", "android", "web", "public")
    if os.path.exists(web_public):
        shutil.copy2(sums_file, os.path.join(web_public, "SHA256SUMS.txt"))
        shutil.copy2(version_file, os.path.join(web_public, "version.json"))
        log(f"已同步元数据至 Android Web 资产目录: {web_public}")

def main():
    os.makedirs(RELEASES_DIR, exist_ok=True)
    log("=================================================================", "\033[95m")
    log(f"🚀 开始执行 密诀 MantraKey 全端聚合构建流水线 (v{VERSION})", "\033[95m")
    log(f"📂 统一产物输出目录: {RELEASES_DIR}", "\033[95m")
    log("=================================================================", "\033[95m")

    build_extension()
    build_desktop()
    verify_android_apks()
    generate_checksums_and_metadata()

    log("=================================================================", "\033[92m")
    log("🎉 全端构建与统一打包归档完成！所有产物已聚齐在 releases/ 目录下。", "\033[92m")
    log("=================================================================", "\033[92m")

if __name__ == "__main__":
    main()
