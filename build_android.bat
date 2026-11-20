@echo off
rem ==============================================================================
rem MantraKey - Android Build Launcher (build_android.bat)
rem ==============================================================================
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

cd /d "%~dp0"

echo ==============================================================================
echo  [MantraKey] Android Packaging Pipeline
echo ==============================================================================

:: Check Explorer Launch
set "IS_EXPLORER=0"
echo %cmdcmdline% | findstr /i /c:"%~nx0" >nul
if %ERRORLEVEL% equ 0 set "IS_EXPLORER=1"

:: Check NoPause
set "NO_PAUSE=0"
for %%a in (%*) do (
    if /i "%%a"=="-NoPause" set "NO_PAUSE=1"
    if /i "%%a"=="--no-pause" set "NO_PAUSE=1"
)
if "%NO_PAUSE%"=="1" set "IS_EXPLORER=0"

:: 1. Try pwsh (PowerShell 7)
where pwsh.exe >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [Shell] Starting with PowerShell 7 [pwsh.exe]...
    echo.
    if "!IS_EXPLORER!"=="1" (
        pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build_android.ps1" -Pause %*
    ) else (
        pwsh.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build_android.ps1" %*
    )
    set "EXIT_CODE=!ERRORLEVEL!"
    goto :finish
)

:: 2. Fallback to Windows PowerShell
where powershell.exe >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo [Shell] Starting with Windows PowerShell [powershell.exe]...
    echo.
    if "!IS_EXPLORER!"=="1" (
        powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build_android.ps1" -Pause %*
    ) else (
        powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\build_android.ps1" %*
    )
    set "EXIT_CODE=!ERRORLEVEL!"
    goto :finish
)

echo [Error] Neither pwsh nor powershell found!
set "EXIT_CODE=1"

:finish
echo.
if "%EXIT_CODE%"=="0" (
    echo ==============================================================================
    echo  [Success] Build completed successfully!
    echo ==============================================================================
) else (
    echo ==============================================================================
    echo  [Failed] Build failed with exit code: %EXIT_CODE%
    echo ==============================================================================
)

if "%IS_EXPLORER%"=="1" (
    echo Press any key to exit...
    pause >nul
)

exit /b %EXIT_CODE%