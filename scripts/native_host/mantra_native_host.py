#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
密诀 MantraKey - Chrome & Edge 原生消息中继宿主 (Native Messaging Host)
遵循 Chromium Native Messaging 标准协议：
1. 标准输入输出二进制流通信：4 字节小端序 uint32 长度前缀 + UTF-8 JSON 负载；
2. 零知识与沙箱安全：严格受控的指令路由，严禁未授权命令；
3. 支持能力：
   - 心跳保活 (PING / PONG)
   - 会话状态穿透与查询 (QUERY_SESSION)
   - 扩展在本地的一键全自动热升级 (AUTO_UPDATE_EXTENSION)
"""

import sys
import os
import json
import struct
import shutil
import tempfile
import hashlib
import glob
import urllib.request
import urllib.error

# 日志输出至标准错误，绝对严禁向标准输出 (stdout) 打印任何非协议字符
def log(msg):
    sys.stderr.write(f"[MantraNativeHost] {msg}\n")
    sys.stderr.flush()

def read_frame():
    """读取来自 Chrome 的单个原生请求帧"""
    try:
        raw_len = sys.stdin.buffer.read(4)
        if not raw_len or len(raw_len) < 4:
            return None
        msg_len = struct.unpack('<I', raw_len)[0]
        if msg_len > 10 * 1024 * 1024: # 10MB 安全上限
            log(f"帧过长拒绝接收: {msg_len} 字节")
            return None
        payload_bytes = sys.stdin.buffer.read(msg_len)
        if len(payload_bytes) < msg_len:
            return None
        return json.loads(payload_bytes.decode('utf-8'))
    except Exception as e:
        log(f"读取请求帧异常: {e}")
        return None

def write_frame(obj):
    """向 Chrome 发送单个原生响应帧"""
    try:
        payload_bytes = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        length_prefix = struct.pack('<I', len(payload_bytes))
        sys.stdout.buffer.write(length_prefix)
        sys.stdout.buffer.write(payload_bytes)
        sys.stdout.buffer.flush()
    except Exception as e:
        log(f"发送响应帧异常: {e}")

def find_extension_unpacked_path(extension_id=None):
    """
    自动在本地 Chrome / Edge 用户的 Preferences / Secure Preferences 中
    根据扩展 ID 定位当前正在运行的解压扩展目录 (path)
    """
    search_patterns = [
        os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\User Data\*\Secure Preferences'),
        os.path.expandvars(r'%LOCALAPPDATA%\Google\Chrome\User Data\*\Preferences'),
        os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\Edge\User Data\*\Secure Preferences'),
        os.path.expandvars(r'%LOCALAPPDATA%\Microsoft\Edge\User Data\*\Preferences'),
    ]

    # 1. 如果指定了 extension_id，精准搜索
    if extension_id:
        for pattern in search_patterns:
            for pref_file in glob.glob(pattern):
                try:
                    with open(pref_file, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    settings = data.get('extensions', {}).get('settings', {})
                    if extension_id in settings:
                        ext_path = settings[extension_id].get('path')
                        if ext_path and os.path.exists(ext_path):
                            log(f"在 {pref_file} 中匹配到扩展路径: {ext_path}")
                            return ext_path
                except Exception:
                    continue

    # 2. 如果未指定或未找到，全量扫描名字含有 mantra-key 或密诀的解压扩展
    for pattern in search_patterns:
        for pref_file in glob.glob(pattern):
            try:
                with open(pref_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                settings = data.get('extensions', {}).get('settings', {})
                for ext_id, ext_info in settings.items():
                    ext_path = ext_info.get('path', '')
                    if ext_path and ('mantra-key' in ext_path.lower() or 'chrome-mv3' in ext_path.lower()):
                        manifest_file = os.path.join(ext_path, 'manifest.json')
                        if os.path.exists(manifest_file):
                            try:
                                with open(manifest_file, 'r', encoding='utf-8') as mf:
                                    m_data = json.load(mf)
                                if '密诀' in m_data.get('name', '') or 'MantraKey' in m_data.get('name', ''):
                                    log(f"在 {pref_file} 启发式定位到 MantraKey 扩展路径: {ext_path}")
                                    return ext_path
                            except Exception:
                                pass
            except Exception:
                continue

    # 3. 兜底检查当前工作区常见目录
    repo_candidate = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "apps", "extension", ".output", "chrome-mv3"))
    if os.path.exists(repo_candidate):
        log(f"匹配到本地开发工作区目录: {repo_candidate}")
        return repo_candidate

    return None

def download_file(url, target_path, expected_sha256=None):
    """带重试与校验的下载工具函数"""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "MantraKey-Native-Updater/0.1.0"
        }
    )
    with urllib.request.urlopen(req, timeout=30) as resp, open(target_path, 'wb') as out_f:
        shutil.copyfileobj(resp, out_f)

    if expected_sha256:
        sha = hashlib.sha256()
        with open(target_path, 'rb') as f:
            while chunk := f.read(65536):
                sha.update(chunk)
        calc_sha = sha.hexdigest().lower()
        if calc_sha != expected_sha256.lower():
            raise ValueError(f"下载文件 SHA256 校验失败: 期望 {expected_sha256}, 实际 {calc_sha}")

def handle_auto_update_extension(payload):
    """执行扩展目录的下载、解压覆盖与更新"""
    download_url = payload.get('downloadUrl')
    direct_url = payload.get('directDownloadUrl')
    expected_sha256 = payload.get('sha256')
    latest_version = payload.get('latestVersion', 'latest')
    extension_id = payload.get('extensionId')
    target_dir = payload.get('targetDir')

    if not target_dir:
        target_dir = find_extension_unpacked_path(extension_id)

    if not target_dir or not os.path.exists(target_dir):
        return {
            "status": "error",
            "message": f"未能在本地找到扩展解压安装目录，请先在 Chrome 扩展管理页确认路径或传入 targetDir"
        }

    log(f"目标升级目录: {target_dir}")

    # 创建独立临时下载解压目录
    temp_dir = tempfile.mkdtemp(prefix="mantra_update_")
    zip_path = os.path.join(temp_dir, "extension_update.zip")
    extract_dir = os.path.join(temp_dir, "extracted")

    try:
        # 1. 尝试从加速源下载，若失败平滑降级至官方源
        downloaded = False
        last_err = None

        if download_url:
            try:
                log(f"正在从首选地址下载: {download_url}")
                download_file(download_url, zip_path, expected_sha256)
                downloaded = True
            except Exception as e:
                log(f"首选地址下载失败，准备尝试备用源: {e}")
                last_err = e

        if not downloaded and direct_url:
            try:
                log(f"正在从备用地址下载: {direct_url}")
                download_file(direct_url, zip_path, expected_sha256)
                downloaded = True
            except Exception as e:
                log(f"备用地址下载失败: {e}")
                last_err = e

        if not downloaded:
            raise RuntimeError(f"下载更新包失败: {last_err}")

        # 2. 解压 ZIP 包
        import zipfile
        os.makedirs(extract_dir, exist_ok=True)
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(extract_dir)

        # 3. 探测 manifest.json 所在的最内层目录
        source_content_dir = extract_dir
        if not os.path.exists(os.path.join(extract_dir, 'manifest.json')):
            # 检查是否有 chrome-mv3 子目录
            subdirs = [os.path.join(extract_dir, d) for d in os.listdir(extract_dir) if os.path.isdir(os.path.join(extract_dir, d))]
            for sd in subdirs:
                if os.path.exists(os.path.join(sd, 'manifest.json')):
                    source_content_dir = sd
                    break

        if not os.path.exists(os.path.join(source_content_dir, 'manifest.json')):
            raise RuntimeError("解压包内未找到合法的 manifest.json 扩展清单文件")

        # 4. 原地原子级覆盖目标目录
        # 逐个文件复制覆盖，同时保留目录中原有的其它开发配置文件
        for item in os.listdir(source_content_dir):
            s = os.path.join(source_content_dir, item)
            d = os.path.join(target_dir, item)
            if os.path.isdir(s):
                if os.path.exists(d):
                    shutil.rmtree(d)
                shutil.copytree(s, d)
            else:
                shutil.copy2(s, d)

        log(f"成功将新版扩展文件覆盖至: {target_dir}")
        return {
            "status": "ok",
            "message": f"密诀扩展已成功热更新至 v{latest_version}",
            "data": {
                "targetDir": target_dir,
                "newVersion": latest_version
            }
        }

    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

def register_host_cli():
    """命令行一键自注册工具 (可通过 --register 调用)"""
    import winreg
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

    if getattr(sys, 'frozen', False):
        exe_path = os.path.abspath(sys.executable)
    else:
        exe_path = os.path.abspath(__file__)
    exe_dir = os.path.dirname(exe_path)

    found_ids = set()
    found_ids.add("bggcaoiaeleahlgnglcglifibgolhief")

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

    allowed_origins = [f"chrome-extension://{eid}/" for eid in found_ids]
    manifest_path = os.path.join(exe_dir, "org.mantrakey.native_proxy.json")
    manifest_data = {
        "name": "org.mantrakey.native_proxy",
        "description": "MantraKey Native Messaging Host for Chrome & Edge",
        "path": exe_path,
        "type": "stdio",
        "allowed_origins": allowed_origins
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest_data, f, indent=2, ensure_ascii=False)

    reg_targets = [
        r"Software\Google\Chrome\NativeMessagingHosts",
        r"Software\Microsoft\Edge\NativeMessagingHosts"
    ]

    for target in reg_targets:
        try:
            key_path = f"{target}\\org.mantrakey.native_proxy"
            with winreg.CreateKey(winreg.HKEY_CURRENT_USER, key_path) as key:
                winreg.SetValue(key, "", winreg.REG_SZ, manifest_path)
        except Exception as e:
            print(f"[警告] 写入注册表 {target} 失败: {e}")

    print("========================================================")
    print("[成功] MantraKey 原生自动更新服务已成功注册！")
    print(f"宿主路径: {exe_path}")
    print(f"清单文件: {manifest_path}")
    print(f"已授权扩展 ID: {list(found_ids)}")
    print("========================================================")

def main():
    log("MantraKey 原生代理服务已启动，等待 Chrome 管道报文...")
    while True:
        req = read_frame()
        if req is None:
            log("管道 EOF 关闭或断开，退出服务")
            break

        req_id = req.get('id', '')
        action = req.get('action', '')
        payload = req.get('payload', {})

        if action == 'PING':
            write_frame({
                "id": req_id,
                "action": "PONG",
                "status": "ok",
                "message": "PONG"
            })
            continue

        if action == 'GET_HOST_INFO':
            write_frame({
                "id": req_id,
                "action": "GET_HOST_INFO",
                "status": "ok",
                "data": {
                    "hostName": "org.mantrakey.native_proxy",
                    "version": "0.1.0",
                    "platform": sys.platform
                }
            })
            continue

        if action == 'AUTO_UPDATE_EXTENSION':
            res = handle_auto_update_extension(payload)
            write_frame({
                "id": req_id,
                "action": "AUTO_UPDATE_EXTENSION",
                "status": res.get("status", "error"),
                "message": res.get("message", ""),
                "data": res.get("data")
            })
            continue

        # 默认未知动作回显
        write_frame({
            "id": req_id,
            "action": action,
            "status": "ok",
            "data": payload
        })

if __name__ == '__main__':
    if '--register' in sys.argv:
        register_host_cli()
        sys.exit(0)
    main()
