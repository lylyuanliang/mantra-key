<#
.SYNOPSIS
    密诀 MantraKey - Android 移动端双变体自动化打包流水线 (PowerShell / pwsh)
.DESCRIPTION
    执行流程：
    0. 检查并适配 JDK 17 与 Android SDK 编译环境
    1. 支持构建变体分流 (-Variant debug|release|all)
    2. 执行 @mantra-key/android-web 前端生产构建 (Debug模式挂载 Agent-Feedback，Release模式 100% Zero-DCE)
    3. 运行 Gradle 编译生成 Android Debug / Release APK
    4. 计算 SHA-256 哈希防篡改指纹
    5. 自动归档至 releases/ 目录，生成 version.json 和 SHA256SUMS.txt
#>

[CmdletBinding()]
param(
    [string]$Variant = "all",
    [switch]$Clean,
    [switch]$NoPause,
    [switch]$Pause
)

# 确保 UTF-8 控制台字符集
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

$Host.UI.RawUI.WindowTitle = "密诀 MantraKey - Android 打包流水线"

function Write-Step([string]$title) {
    Write-Host "`n==============================================================================" -ForegroundColor DarkCyan
    Write-Host " [步骤] $title" -ForegroundColor Cyan
    Write-Host "==============================================================================" -ForegroundColor DarkCyan
}

function Write-Success([string]$msg) {
    Write-Host " [成功] $msg" -ForegroundColor Green
}

function Write-Info([string]$msg) {
    Write-Host " [信息] $msg" -ForegroundColor Gray
}

function Write-Warning([string]$msg) {
    Write-Host " [警告] $msg" -ForegroundColor Yellow
}

function Write-ErrorMsg([string]$msg) {
    Write-Host " [错误] $msg" -ForegroundColor Red
}

$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
Set-Location $ProjectRoot

# 参数归一化
$Variant = $Variant.ToLowerInvariant()
if ($Variant -ne "debug" -and $Variant -ne "release" -and $Variant -ne "all") {
    Write-ErrorMsg "无效的构建变体: $Variant (仅支持 debug, release 或 all)"
    if ($Pause -and -not $NoPause) { pause }
    exit 1
}

Write-Host "==============================================================================" -ForegroundColor DarkGreen
Write-Host " 密诀 MantraKey · 移动端 Android 自动化打包流水线" -ForegroundColor Green
Write-Host " 运行引擎: $($PSVersionTable.PSEdition) $($PSVersionTable.PSVersion) (Host: $($Host.Name))" -ForegroundColor DarkGray
Write-Host " 工程根目录: $ProjectRoot" -ForegroundColor DarkGray
Write-Host " 构建目标变体: $Variant" -ForegroundColor Magenta
Write-Host "==============================================================================" -ForegroundColor DarkGreen

# -----------------------------------------------------------------------------
# 0. 环境感知与路径适配
# -----------------------------------------------------------------------------
Write-Step "0/4 适配 JDK 17 与 Android SDK 编译环境"

if (-not $env:JAVA_HOME) {
    $CandidateJdks = @(
        "D:\soft\JDKS\jdk-17.0.16\jdk",
        "C:\Program Files\Java\jdk-17",
        "C:\Program Files\Eclipse Adoptium\jdk-17"
    )
    foreach ($cand in $CandidateJdks) {
        if (Test-Path "$cand\bin\javac.exe") {
            $env:JAVA_HOME = $cand
            $env:PATH = "$cand\bin;" + $env:PATH
            break
        }
    }
}
if (-not $env:JAVA_HOME) {
    Write-ErrorMsg "未检测到有效的 JAVA_HOME，请配置 JDK 17！"
    if ($Pause -and -not $NoPause) { pause }
    exit 1
}
Write-Success "JAVA_HOME: $env:JAVA_HOME"

if (-not $env:ANDROID_HOME) {
    $CandidateSdks = @(
        "D:\soft\android-sdk",
        "$env:LOCALAPPDATA\Android\Sdk",
        "C:\Android\sdk"
    )
    foreach ($cand in $CandidateSdks) {
        if (Test-Path "$cand\platform-tools") {
            $env:ANDROID_HOME = $cand
            break
        }
    }
}
if (-not $env:ANDROID_HOME) {
    Write-ErrorMsg "未检测到有效的 ANDROID_HOME，请配置 Android SDK！"
    if ($Pause -and -not $NoPause) { pause }
    exit 1
}
Write-Success "ANDROID_HOME: $env:ANDROID_HOME"

# 确定需要构建的目标变体列表
$VariantsToBuild = if ($Variant -eq "all") { @("debug", "release") } else { @($Variant) }

$ReleaseDir = Join-Path $ProjectRoot "releases"
if (-not (Test-Path $ReleaseDir)) {
    New-Item -ItemType Directory -Path $ReleaseDir -Force | Out-Null
}

$AndroidDir = Join-Path $ProjectRoot "apps\android"
$AppGradleKts = Join-Path $AndroidDir "app\build.gradle.kts"
$Version = "0.1.1.202611231846"
if (Test-Path $AppGradleKts) {
    $Content = Get-Content $AppGradleKts -Raw
    if ($Content -match 'versionName\s*=\s*"([^"]+)"') {
        $Version = $Matches[1]
    }
}
$Timestamp = (Get-Date).ToString("yyyyMMddHHmm")

$GeneratedApks = @{}

foreach ($v in $VariantsToBuild) {
    Write-Step "开始构建变体: $v (版本: v$Version)"

    # 1. 前端构建
    $WebBuildCmd = if ($v -eq "release") { "build:release" } else { "build" }
    Write-Info "正在构建 Web 端侧中枢 (pnpm --filter @mantra-key/android-web run $WebBuildCmd)..."
    & pnpm --filter @mantra-key/android-web run $WebBuildCmd
    if ($LASTEXITCODE -ne 0) {
        Write-ErrorMsg "Web 模块构建失败，退出码: $LASTEXITCODE"
        if ($Pause -and -not $NoPause) { pause }
        exit $LASTEXITCODE
    }
    Write-Success "Web 资产就绪 (Zero-DCE 状态: $(if ($v -eq 'release') { '已剔除 Agent Feedback' } else { '已挂载 Agent Feedback 悬浮面板' }))"

    # 2. 原生 Gradle 编译
    $GradleTask = if ($v -eq "release") { "assembleRelease" } else { "assembleDebug" }
    Write-Info "正在执行 Gradle APK 编译 ($GradleTask)..."

    Push-Location $AndroidDir
    try {
        if ($Clean) {
            Write-Info "清理历史 Gradle 缓存..."
            & .\gradlew.bat clean
        }
        & .\gradlew.bat $GradleTask
        $GradleStatus = $LASTEXITCODE
    } finally {
        Pop-Location
    }

    if ($GradleStatus -ne 0) {
        Write-ErrorMsg "Gradle $GradleTask 编译失败，退出码: $GradleStatus"
        if ($Pause -and -not $NoPause) { pause }
        exit $GradleStatus
    }
    Write-Success "Gradle $GradleTask 编译完成！"

    # 3. 产物归档
    $ApkSub = if ($v -eq "release") { "release" } else { "debug" }
    $ApkName = if ($v -eq "release") { "app-release.apk" } else { "app-debug.apk" }
    $SrcApk = Join-Path $AndroidDir "app\build\outputs\apk\$ApkSub\$ApkName"

    if (-not (Test-Path $SrcApk)) {
        Write-ErrorMsg "未检测到编译生成的 APK: $SrcApk"
        if ($Pause -and -not $NoPause) { pause }
        exit 1
    }

    $TargetApkName = "mantra-key-v$Version-$v.apk"
    $TargetApkPath = Join-Path $ReleaseDir $TargetApkName
    Copy-Item -Path $SrcApk -Destination $TargetApkPath -Force

    $LatestApkName = "mantra-key-latest-$v.apk"
    $LatestApkPath = Join-Path $ReleaseDir $LatestApkName
    Copy-Item -Path $SrcApk -Destination $LatestApkPath -Force

    # 计算 SHA-256
    $Sha256 = (Get-FileHash -Path $TargetApkPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $GeneratedApks[$v] = @{
        Path = $TargetApkPath
        Name = $TargetApkName
        Size = (Get-Item $TargetApkPath).Length
        Sha256 = $Sha256
    }
    Write-Success "$v APK 归档就绪: $TargetApkName (SHA-256: $Sha256)"
}

# -----------------------------------------------------------------------------
# 5. 生成 version.json 与 SHA256SUMS.txt
# -----------------------------------------------------------------------------
Write-Step "生成发布元数据 (version.json 与 SHA256SUMS.txt)"

$SumsContent = @()
foreach ($key in $GeneratedApks.Keys) {
    $info = $GeneratedApks[$key]
    $SumsContent += "$($info.Sha256) *$($info.Name)"
}
$SumsPath = Join-Path $ReleaseDir "SHA256SUMS.txt"
$SumsContent -join "`n" | Set-Content -Path $SumsPath -Encoding utf8 -NoNewline
Write-Success "SHA256SUMS.txt 生成完成: $SumsPath"

# 生成 version.json
$ReleaseApkInfo = $GeneratedApks["release"]
$DebugApkInfo = $GeneratedApks["debug"]

$SizeText = if ($ReleaseApkInfo) {
    "$([math]::Round($ReleaseApkInfo.Size / 1MB, 2)) MB"
} elseif ($DebugApkInfo) {
    "$([math]::Round($DebugApkInfo.Size / 1MB, 2)) MB"
} else {
    "约 6 MB"
}

$VersionMeta = @{
    version = $Version
    versionTag = "v$Version"
    title = "MantraKey v$Version"
    changelog = "1. 集成 @lylyuanliang/agent-feedback 悬浮自愈中枢与开发机本地包直连下载`n2. 发布包达成 100% Zero-DCE 自动剔除开发代码`n3. 离线密码学派生与双向安全输入法/自动填充服务联动"
    publishedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    assetSizeText = $SizeText
    releaseDownloadUrl = "https://github.com/lylyuanliang/mantra-key/releases/download/v$Version/mantra-key-v$Version-release.apk"
    debugDownloadUrl = "https://github.com/lylyuanliang/mantra-key/releases/download/v$Version/mantra-key-v$Version-debug.apk"
    releaseSha256 = if ($ReleaseApkInfo) { $ReleaseApkInfo.Sha256 } else { "" }
    debugSha256 = if ($DebugApkInfo) { $DebugApkInfo.Sha256 } else { "" }
    htmlUrl = "https://github.com/lylyuanliang/mantra-key/releases/tag/v$Version"
}

$VersionJsonPath = Join-Path $ReleaseDir "version.json"
$VersionMeta | ConvertTo-Json -Depth 4 | Set-Content -Path $VersionJsonPath -Encoding utf8
Write-Success "version.json 生成完成: $VersionJsonPath"

# 同步复制一份至 web/public 目录，便于前端开发机服务器热启动直连
$WebPublicDir = Join-Path $ProjectRoot "apps\android\web\public"
if (Test-Path $WebPublicDir) {
    Copy-Item -Path $VersionJsonPath -Destination (Join-Path $WebPublicDir "version.json") -Force
    Copy-Item -Path $SumsPath -Destination (Join-Path $WebPublicDir "SHA256SUMS.txt") -Force
}

Write-Host "`n==============================================================================" -ForegroundColor DarkGreen
Write-Host " [全部完成] 密诀 MantraKey Android 打包产物清单" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor DarkGreen
foreach ($key in $GeneratedApks.Keys) {
    $info = $GeneratedApks[$key]
    $mb = [math]::Round($info.Size / 1MB, 2)
    Write-Host " • [$key] $($info.Name) ($mb MB)" -ForegroundColor Cyan
    Write-Host "   SHA-256: $($info.Sha256)" -ForegroundColor DarkGray
}
Write-Host " • 归档目录: $ReleaseDir" -ForegroundColor White
Write-Host "==============================================================================" -ForegroundColor DarkGreen

if ($Pause -and -not $NoPause) {
    Write-Host "`n按回车键退出..." -ForegroundColor DarkGray
    [void][System.Console]::ReadLine()
}

exit 0
