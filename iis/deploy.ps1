#Requires -RunAsAdministrator
<#
.SYNOPSIS
    LiarGame AI — IIS 배포 스크립트
.DESCRIPTION
    Next.js standalone 빌드를 수행하고 IIS 사이트에 배포합니다.
    실행 전: IIS + httpPlatformHandler 모듈이 설치되어 있어야 합니다.
.EXAMPLE
    .\iis\deploy.ps1
    .\iis\deploy.ps1 -SiteName "liargame" -DeployPath "C:\inetpub\liargame" -Port 8080
#>

param(
    [string]$SiteName   = "liargame-ai",
    [string]$DeployPath = "C:\inetpub\liargame-ai",
    [int]   $Port       = 3000,
    [string]$AppPoolName = "liargame-ai-pool"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── 색상 출력 헬퍼 ──────────────────────────────────────────────────
function Write-Step  { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Cyan }
function Write-OK    { param($msg) Write-Host "  ✔ $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "  ⚠ $msg" -ForegroundColor Yellow }
function Write-Fail  { param($msg) Write-Host "  ✘ $msg" -ForegroundColor Red; exit 1 }

# ── 사전 조건 확인 ──────────────────────────────────────────────────
Write-Step "사전 조건 확인"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Fail "node.exe 를 찾을 수 없습니다. Node.js를 먼저 설치하세요."
}
Write-OK "Node.js $(node --version)"

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Fail "npm을 찾을 수 없습니다."
}
Write-OK "npm $(npm --version)"

# IIS WebAdministration 모듈
if (-not (Get-Module -ListAvailable -Name WebAdministration)) {
    Write-Fail "IIS WebAdministration 모듈이 없습니다. IIS 관리 도구를 설치하세요."
}
Import-Module WebAdministration
Write-OK "IIS WebAdministration 모듈 로드 완료"

# ── 프로젝트 루트 결정 ──────────────────────────────────────────────
$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir   # iis/ 의 상위 = 프로젝트 루트
Write-OK "프로젝트 루트: $ProjectDir"

Push-Location $ProjectDir

try {
    # ── 1. 프로덕션 의존성 설치 ────────────────────────────────────────
    Write-Step "프로덕션 npm 패키지 설치"
    npm ci --omit=dev
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm ci 실패" }
    Write-OK "의존성 설치 완료"

    # ── 2. 빌드 (Next.js standalone + tsc server) ──────────────────────
    Write-Step "프로덕션 빌드"
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm run build 실패" }
    Write-OK "빌드 완료"

    # ── 3. 배포 디렉토리 준비 ──────────────────────────────────────────
    Write-Step "배포 디렉토리 준비: $DeployPath"

    if (Test-Path $DeployPath) {
        Write-Warn "기존 배포 디렉토리 발견 — 백업 후 교체"
        $backup = "$DeployPath.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Rename-Item -Path $DeployPath -NewName $backup
        Write-OK "백업 경로: $backup"
    }
    New-Item -ItemType Directory -Force -Path $DeployPath | Out-Null

    # ── 4. standalone 아웃풋 복사 ─────────────────────────────────────
    Write-Step "standalone 파일 복사"

    # Next.js standalone
    $standaloneSrc = Join-Path $ProjectDir ".next\standalone"
    if (-not (Test-Path $standaloneSrc)) {
        Write-Fail ".next/standalone 디렉토리가 없습니다. next.config.mjs에 output: 'standalone' 확인 필요"
    }
    Copy-Item -Path "$standaloneSrc\*" -Destination $DeployPath -Recurse -Force
    Write-OK "standalone → $DeployPath"

    # 정적 파일 (_next/static)
    $staticSrc = Join-Path $ProjectDir ".next\static"
    $staticDst = Join-Path $DeployPath ".next\static"
    New-Item -ItemType Directory -Force -Path $staticDst | Out-Null
    Copy-Item -Path "$staticSrc\*" -Destination $staticDst -Recurse -Force
    Write-OK "_next/static 복사 완료"

    # public 폴더 (있을 경우)
    $publicSrc = Join-Path $ProjectDir "public"
    if (Test-Path $publicSrc) {
        Copy-Item -Path $publicSrc -Destination $DeployPath -Recurse -Force
        Write-OK "public 복사 완료"
    }

    # 컴파일된 서버 (dist/server)
    $distSrc = Join-Path $ProjectDir "dist"
    if (-not (Test-Path $distSrc)) {
        Write-Fail "dist/ 디렉토리가 없습니다. tsc 컴파일 확인 필요"
    }
    $distDst = Join-Path $DeployPath "dist"
    Copy-Item -Path $distSrc -Destination $distDst -Recurse -Force
    Write-OK "dist/ 복사 완료"

    # web.config 복사
    $webConfigSrc = Join-Path $ProjectDir "iis\web.config"
    Copy-Item -Path $webConfigSrc -Destination $DeployPath -Force
    Write-OK "web.config 복사 완료"

    # logs 디렉토리 생성
    New-Item -ItemType Directory -Force -Path (Join-Path $DeployPath "logs") | Out-Null
    Write-OK "logs/ 디렉토리 생성"

    # ── 5. IIS 앱풀 구성 ──────────────────────────────────────────────
    Write-Step "IIS 앱풀 구성: $AppPoolName"

    if (Test-Path "IIS:\AppPools\$AppPoolName") {
        Write-Warn "기존 앱풀 발견 — 중지 후 재구성"
        Stop-WebAppPool -Name $AppPoolName -ErrorAction SilentlyContinue
    } else {
        New-WebAppPool -Name $AppPoolName | Out-Null
        Write-OK "앱풀 생성: $AppPoolName"
    }

    # Node.js 프로세스는 자체 관리 — 앱풀은 No Managed Code
    Set-ItemProperty "IIS:\AppPools\$AppPoolName" managedRuntimeVersion ""
    Set-ItemProperty "IIS:\AppPools\$AppPoolName" processModel.identityType "ApplicationPoolIdentity"
    # 자동 재시작 비활성화 (httpPlatformHandler가 프로세스 수명 관리)
    Set-ItemProperty "IIS:\AppPools\$AppPoolName" recycling.periodicRestart.time "00:00:00"
    Write-OK "앱풀 구성 완료"

    # ── 6. IIS 사이트 생성 / 업데이트 ────────────────────────────────
    Write-Step "IIS 사이트 구성: $SiteName (포트 $Port)"

    if (Test-Path "IIS:\Sites\$SiteName") {
        Write-Warn "기존 사이트 발견 — 경로 및 포트 업데이트"
        Set-ItemProperty "IIS:\Sites\$SiteName" physicalPath $DeployPath
        # 바인딩 업데이트
        $binding = Get-WebBinding -Name $SiteName -Protocol http
        if ($binding) {
            $binding.BindingInformation = "*:${Port}:"
            $binding.Update()
        }
    } else {
        New-Website -Name $SiteName `
                    -PhysicalPath $DeployPath `
                    -Port $Port `
                    -ApplicationPool $AppPoolName | Out-Null
        Write-OK "IIS 사이트 생성: $SiteName"
    }

    # 앱풀 연결 확인
    Set-ItemProperty "IIS:\Sites\$SiteName" applicationPool $AppPoolName

    # ── 7. 앱풀 / 사이트 시작 ─────────────────────────────────────────
    Write-Step "서비스 시작"
    Start-WebAppPool -Name $AppPoolName
    Start-Website    -Name $SiteName
    Write-OK "앱풀 및 사이트 시작 완료"

    # ── 8. 헬스 체크 ─────────────────────────────────────────────────
    Write-Step "헬스 체크 (최대 30초 대기)"
    $url     = "http://localhost:$Port"
    $timeout = 30
    $elapsed = 0
    $ok      = $false

    while ($elapsed -lt $timeout) {
        Start-Sleep -Seconds 2
        $elapsed += 2
        try {
            $resp = Invoke-WebRequest -Uri $url -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -lt 500) {
                $ok = $true
                break
            }
        } catch { <# 아직 시작 중 #> }
        Write-Host "  ... 대기 중 ($elapsed/$timeout 초)" -ForegroundColor DarkGray
    }

    if ($ok) {
        Write-OK "서비스 응답 확인: $url (HTTP $($resp.StatusCode))"
    } else {
        Write-Warn "헬스 체크 타임아웃 — 로그를 확인하세요: $DeployPath\logs\node.log"
    }

} finally {
    Pop-Location
}

Write-Host "`n배포 완료!" -ForegroundColor Green
Write-Host "  사이트 URL : http://localhost:$Port" -ForegroundColor White
Write-Host "  배포 경로  : $DeployPath" -ForegroundColor White
Write-Host "  로그 경로  : $DeployPath\logs\node.log" -ForegroundColor White
