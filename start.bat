@echo off
chcp 65001 > nul
title 密诀 MantraKey · 本地开发与联调服务

echo ============================================================
echo   🔑 密诀 MantraKey · 确定性无状态密码管理器
echo   🚀 正在启动本地开发与联调服务...
echo ============================================================
echo.

cd /d "%~dp0"

echo [提示] 启动成功后，可通过浏览器或手机访问测试：
echo        - 本地访问: http://localhost:5174/
echo        - 局域网访问: http://10.1.9.168:5174/
echo.
echo [提示] 如需停止服务，请直接关闭本窗口或按 Ctrl + C。
echo.

call pnpm dev:android
