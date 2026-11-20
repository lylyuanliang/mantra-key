#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
密诀 MantraKey - Windows 桌面端与 Native 代理打包辅助工具
将编译好的 mantra-desktop.exe 与 mantra-native-proxy.exe 以及注册脚本打包为标准 ZIP 包。
"""

import os
import sys
import json
import zipfile
import argparse

def package_desktop(desktop_exe, proxy_exe, output_zip, version="0.1.0"):
    if not os.path.exists(desktop_exe):
        raise FileNotFoundError(f"未找到桌面端执行程序: {desktop_exe}")
    if not os.path.exists(proxy_exe):
        raise FileNotFoundError(f"未找到原生代理桩执行程序: {proxy_exe}")

    os.makedirs(os.path.dirname(os.path.abspath(output_zip)), exist_ok=True)

    host_manifest = {
        "name": "com.mantrakey.proxy",
        "description": "MantraKey Native Messaging Host for Chrome & Edge",
        "path": "mantra-native-proxy.exe",
        "type": "stdio",
        "allowed_origins": [
            "chrome-extension://*/"
        ]
    }

    install_bat = """@echo off
chcp 65001 >nul
echo [MantraKey] 正在注册 Native Messaging Host 到当前用户注册表...
set HOST_PATH=%~dp0com.mantrakey.proxy.json
echo 配置清单路径: %HOST_PATH%

REG ADD "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.mantrakey.proxy" /ve /t REG_SZ /d "%HOST_PATH%" /f >nul
REG ADD "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.mantrakey.proxy" /ve /t REG_SZ /d "%HOST_PATH%" /f >nul

if %ERRORLEVEL% EQU 0 (
    echo [成功] MantraKey 本地原生代理桩已成功注册到 Chrome 与 Edge！
) else (
    echo [失败] 注册表写入失败，请检查权限。
)
pause
"""

    uninstall_bat = """@echo off
chcp 65001 >nul
echo [MantraKey] 正在卸载 Native Messaging Host 注册表配置...
REG DELETE "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\com.mantrakey.proxy" /f >nul 2>&1
REG DELETE "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\com.mantrakey.proxy" /f >nul 2>&1
echo [完成] 原生代理桩注册表项已移除。
pause
"""

    readme_txt = f"""密诀 MantraKey - Windows 桌面中枢与原生代理 (v{version})
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

    with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as z:
        z.write(desktop_exe, "mantra-desktop.exe")
        z.write(proxy_exe, "mantra-native-proxy.exe")
        z.writestr("com.mantrakey.proxy.json", json.dumps(host_manifest, indent=2, ensure_ascii=False))
        z.writestr("install_host.bat", install_bat)
        z.writestr("uninstall_host.bat", uninstall_bat)
        z.writestr("README.txt", readme_txt)

    print(f"[PackageDesktop] 成功打包桌面分发包: {output_zip} ({os.path.getsize(output_zip)} 字节)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Package MantraKey Desktop & Proxy into zip")
    parser.add_argument("--desktop", default="target/release/mantra-desktop.exe", help="Path to mantra-desktop.exe")
    parser.add_argument("--proxy", default="target/release/mantra-native-proxy.exe", help="Path to mantra-native-proxy.exe")
    parser.add_argument("--output", required=True, help="Output zip file path")
    parser.add_argument("--version", default="0.1.0", help="Release version")
    args = parser.parse_args()

    package_desktop(args.desktop, args.proxy, args.output, args.version)
