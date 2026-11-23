#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
密诀 MantraKey - 原生宿主 (Native Messaging Host) 注册安装脚本
支持一键自动将 org.mantrakey.native_proxy 注册到 Chrome 与 Edge 注册表中。
"""

import sys
import os
import json
import glob
import winreg

HOST_NAME = "org.mantrakey.native_proxy"
SCRIPT_DIR = os.path.abspath(os.path.dirname(__file__))

def get_installed_extension_ids():
    """扫描本地 Chrome/Edge 配置，自动获取已安装的 MantraKey 扩展 ID"""
    found_ids = set()
    found_ids.add("bggcaoiaeleahlgnglcglifibgolhief") # 当前默认工作区 ID

    search_patterns = [
        os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\User Data\*\Secure Preferences'),
        os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\User Data\*\Preferences'),
        os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\Edge\User Data\*\Secure Preferences'),
        os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\Edge\User Data\*\Preferences'),
    ]

    for pattern in search_patterns:
        for pref_file in glob.glob(pattern):
            try:
                with open(pref_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                settings = data.get('extensions', {}).get('settings', {})
                for ext_id, ext_info in settings.items():
                    ext_path = ext_info.get('path', '')
                    if ext_path and ('mantra-key' in ext_path.lower() or 'chrome-mv3' in ext_path.lower()):
                        found_ids.add(ext_id)
            except Exception:
                continue

    return list(found_ids)

def install():
    python_exe = sys.executable
    script_path = os.path.join(SCRIPT_DIR, "mantra_native_host.py")
    bat_path = os.path.join(SCRIPT_DIR, "mantra_native_host.bat")
    manifest_json_path = os.path.join(SCRIPT_DIR, f"{HOST_NAME}.json")

    # 1. 生成 .bat 包装启动器作为备用
    bat_content = f"""@echo off
"{python_exe}" -u "{script_path}"
"""
    with open(bat_path, "w", encoding="utf-8") as f:
        f.write(bat_content)

    # 优先使用编译生成的原生独立二进制 .exe，避免任何环境或控制台窗口问题
    exe_candidate = os.path.join(SCRIPT_DIR, "mantra-native-proxy.exe")
    repo_exe_candidate = os.path.abspath(os.path.join(SCRIPT_DIR, "..", "..", "target", "release", "mantra-native-proxy.exe"))

    if os.path.exists(exe_candidate):
        target_exec_path = exe_candidate
    elif os.path.exists(repo_exe_candidate):
        target_exec_path = repo_exe_candidate
    else:
        target_exec_path = bat_path

    # 2. 搜集允许连接的 Extension ID 列表
    ext_ids = get_installed_extension_ids()
    allowed_origins = [f"chrome-extension://{eid}/" for eid in ext_ids]

    # 3. 生成 Native Messaging Host 清单
    manifest_data = {
        "name": HOST_NAME,
        "description": "MantraKey Native Messaging Host for Chrome & Edge",
        "path": target_exec_path,
        "type": "stdio",
        "allowed_origins": allowed_origins
    }

    with open(manifest_json_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2, ensure_ascii=False)

    print(f"[1/3] 已生成 Native Host 清单: {manifest_json_path}")
    print(f"      指向执行文件: {target_exec_path}")
    print(f"      授权扩展白名单: {allowed_origins}")

    # 4. 注册到当前用户注册表 (HKCU 不需要管理员权限)
    reg_targets = [
        r"Software\Google\Chrome\NativeMessagingHosts",
        r"Software\Microsoft\Edge\NativeMessagingHosts"
    ]

    for target in reg_targets:
        try:
            key_path = f"{target}\\{HOST_NAME}"
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
                winreg.SetValue(key, "", winreg.REG_SZ, manifest_json_path)
            print(f"[2/3] 注册表项写入成功: HKCU\\{key_path} -> {manifest_json_path}")
        except Exception as e:
            print(f"[警告] 写入注册表 HKCU\\{target} 异常: {e}")

    print("[3/3] 🎉 MantraKey 原生代理服务注册完成！Chrome 与 Edge 扩展现已可与本地原生服务无缝通信。")

if __name__ == "__main__":
    install()
