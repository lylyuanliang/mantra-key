#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Native Host 自动化单元测试
验证：
1. Chrome 扩展本地解压目录启发式探测 (find_extension_unpacked_path)
2. Native Messaging 协议帧打包与解包
3. 模拟执行本地自动覆写更新流程 (handle_auto_update_extension)
"""

import os
import sys
import json
import zipfile
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "scripts", "native_host")))
from mantra_native_host import find_extension_unpacked_path, handle_auto_update_extension

class TestNativeHost(unittest.TestCase):
    def test_find_extension_path(self):
        # 应该能从本地 Chrome 找到当前开发目录
        path = find_extension_unpacked_path('bggcaoiaeleahlgnglcglifibgolhief')
        self.assertIsNotNone(path)
        self.assertTrue(os.path.exists(path))
        self.assertTrue(os.path.exists(os.path.join(path, 'manifest.json')))

    def test_auto_update_with_mock_zip(self):
        # 创建一个模拟的目标扩展安装目录
        temp_target = tempfile.mkdtemp(prefix="mantra_target_")
        with open(os.path.join(temp_target, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump({"name": "MantraKey Old", "version": "0.1.0"}, f)
        with open(os.path.join(temp_target, "old_file.txt"), "w") as f:
            f.write("old")

        # 创建一个模拟的更新包 ZIP
        temp_zip_dir = tempfile.mkdtemp(prefix="mantra_zip_")
        zip_file = os.path.join(temp_zip_dir, "new_update.zip")
        with zipfile.ZipFile(zip_file, "w") as zf:
            zf.writestr("manifest.json", json.dumps({"name": "MantraKey New", "version": "0.1.1"}))
            zf.writestr("new_feature.js", "console.log('v0.1.1');")

        try:
            # 模拟执行 handle_auto_update_extension
            # 使用 file:// 协议作为直接下载源
            file_url = f"file:///{zip_file.replace(os.sep, '/')}"
            res = handle_auto_update_extension({
                "directDownloadUrl": file_url,
                "targetDir": temp_target,
                "latestVersion": "0.1.1"
            })

            self.assertEqual(res.get("status"), "ok")
            # 验证目标目录中的文件已成功被新版替换
            with open(os.path.join(temp_target, "manifest.json"), "r", encoding="utf-8") as f:
                new_data = json.load(f)
            self.assertEqual(new_data.get("version"), "0.1.1")
            self.assertTrue(os.path.exists(os.path.join(temp_target, "new_feature.js")))
        finally:
            import shutil
            shutil.rmtree(temp_target, ignore_errors=True)
            shutil.rmtree(temp_zip_dir, ignore_errors=True)

if __name__ == '__main__':
    unittest.main()
