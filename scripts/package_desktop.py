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

# 确保控制台字符集为 UTF-8，防止在 Windows CI/CD Runner 上打印中文字符报 UnicodeEncodeError
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

def make_crlf_gbk_bytes(text: str) -> bytes:
    """强制使用 Windows CRLF 换行符与 GBK 编码，确保 Windows cmd.exe 打开百分之百不乱码、不截断指令"""
    crlf_text = text.replace("\r\n", "\n").replace("\n", "\r\n")
    return crlf_text.encode("gbk", errors="replace")

def package_desktop(desktop_exe, proxy_exe, output_zip, version="0.1.0"):
    desktop_exe = os.path.normpath(desktop_exe)
    proxy_exe = os.path.normpath(proxy_exe)
    output_zip = os.path.normpath(output_zip)

    if not os.path.exists(desktop_exe):
        raise FileNotFoundError(f"未找到桌面端执行程序: {desktop_exe}")
    if not os.path.exists(proxy_exe):
        raise FileNotFoundError(f"未找到原生代理桩执行程序: {proxy_exe}")

    os.makedirs(os.path.dirname(os.path.abspath(output_zip)), exist_ok=True)

    host_manifest = {
        "name": "org.mantrakey.native_proxy",
        "description": "MantraKey Native Messaging Host for Chrome & Edge",
        "path": "mantra-native-proxy.exe",
        "type": "stdio",
        "allowed_origins": [
            "chrome-extension://hejmkhaefdlhkhebpjnijplphhabkbgh/",
            "chrome-extension://maocgdjdlppoipddolffccjbnniijbne/",
            "chrome-extension://bggcaoiaeleahlgnglcglifibgolhief/",
            "chrome-extension://fpceefangimjbfppoomcngkcdekfnloi/"
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
if %errorlevel% neq 0 goto :manual_reg
goto :end

:manual_reg
echo.
echo [提示] 尝试通过系统注册表直接登记原生通道...
REG ADD "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\org.mantrakey.native_proxy" /ve /t REG_SZ /d "%~dp0org.mantrakey.native_proxy.json" /f >nul 2>&1
REG ADD "HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\org.mantrakey.native_proxy" /ve /t REG_SZ /d "%~dp0org.mantrakey.native_proxy.json" /f >nul 2>&1
echo [OK] 注册表原生通道已直接登记完成。

:end
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
        z.writestr("org.mantrakey.native_proxy.json", json.dumps(host_manifest, indent=2, ensure_ascii=False))
        z.writestr("install_host.bat", make_crlf_gbk_bytes(install_bat))
        z.writestr("uninstall_host.bat", make_crlf_gbk_bytes(uninstall_bat))
        z.writestr("README.txt", make_crlf_gbk_bytes(readme_txt))

    print(f"[PackageDesktop] 成功打包桌面分发包: {output_zip} ({os.path.getsize(output_zip)} 字节)")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Package MantraKey Desktop & Proxy into zip")
    parser.add_argument("--desktop", default="target/release/mantra-desktop.exe", help="Path to mantra-desktop.exe")
    parser.add_argument("--proxy", default="target/release/mantra-native-proxy.exe", help="Path to mantra-native-proxy.exe")
    parser.add_argument("--output", required=True, help="Output zip file path")
    parser.add_argument("--version", default="0.1.0", help="Release version")
    args = parser.parse_args()

    package_desktop(args.desktop, args.proxy, args.output, args.version)
