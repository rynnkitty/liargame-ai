# deploy.ps1 — LiarGame AI IIS 배포 스크립트
# 사용법: .\iis\deploy.ps1 -SiteName "LiarGameAI" -Port 80
# 관리자 권한 필요

param(
    [string]$SiteName = "LiarGameAI",
    [int]$Port = 80,
    [string]$AppPoolName = "LiarGameAIPool",
    [string]$DeployPath = "C:\inetpub\liargame-ai"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " LiarGame AI - IIS 배포 스크립트" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# 1. 빌드
Write-Host "`n[1/6] 프로덕션 빌드 중..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "빌드 실패!" -ForegroundColor Red
    exit 1
}

# 2. 배포 폴더 준비
Write-Host "`n[2/6] 배포 폴더 준비: $DeployPath" -ForegroundColor Yellow
if (Test-Path $DeployPath) {
    # 기존 배포 백업
    $backupPath = "${DeployPath}_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Write-Host "  기존 배포 백업: $backupPath"
    Rename-Item -Path $DeployPath -NewName $backupPath
}
New-Item -ItemType Directory -Path $DeployPath -Force | Out-Null

# 3. 파일 복사
Write-Host "`n[3/6] 빌드 파일 복사 중..." -ForegroundColor Yellow

# standalone 출력 복사
Copy-Item -Path ".next\standalone\*" -Destination $DeployPath -Recurse -Force
Write-Host "  standalone 복사 완료"

# static 파일 복사
$staticDest = Join-Path $DeployPath ".next\static"
New-Item -ItemType Directory -Path $staticDest -Force | Out-Null
Copy-Item -Path ".next\static\*" -Destination $staticDest -Recurse -Force
Write-Host "  static 복사 완료"

# public 폴더 복사
if (Test-Path "public") {
    Copy-Item -Path "public" -Destination $DeployPath -Recurse -Force
    Write-Host "  public 복사 완료"
}

# web.config 복사
Copy-Item -Path "iis\web.config" -Destination $DeployPath -Force
Write-Host "  web.config 복사 완료"

# 환경 변수 복사
if (Test-Path ".env.production") {
    Copy-Item -Path ".env.production" -Destination "$DeployPath\.env.local" -Force
    Write-Host "  .env.production 복사 완료"
} else {
    Write-Host "  경고: .env.production 없음 — 수동으로 $DeployPath\.env.local 생성 필요" -ForegroundColor DarkYellow
}

# 로그 폴더 생성
New-Item -ItemType Directory -Path "$DeployPath\logs" -Force | Out-Null

# 4. IIS 앱 풀 생성/설정
Write-Host "`n[4/6] IIS 앱 풀 설정: $AppPoolName" -ForegroundColor Yellow
Import-Module WebAdministration -ErrorAction SilentlyContinue

if (Test-Path "IIS:\AppPools\$AppPoolName") {
    Write-Host "  기존 앱 풀 재사용"
} else {
    New-WebAppPool -Name $AppPoolName
    Write-Host "  앱 풀 생성 완료"
}

Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "managedRuntimeVersion" -Value ""
Set-ItemProperty -Path "IIS:\AppPools\$AppPoolName" -Name "startMode" -Value "AlwaysRunning"
Write-Host "  .NET CLR: 관리 코드 없음"
Write-Host "  시작 모드: AlwaysRunning"

# 5. IIS 사이트 생성/설정
Write-Host "`n[5/6] IIS 사이트 설정: $SiteName (포트 $Port)" -ForegroundColor Yellow

if (Test-Path "IIS:\Sites\$SiteName") {
    Write-Host "  기존 사이트 제거 후 재생성"
    Remove-Website -Name $SiteName
}

New-Website -Name $SiteName `
    -PhysicalPath $DeployPath `
    -Port $Port `
    -ApplicationPool $AppPoolName

Write-Host "  사이트 생성 완료"

# 6. 완료
Write-Host "`n========================================" -ForegroundColor Green
Write-Host " 배포 완료!" -ForegroundColor Green
Write-Host " URL: http://localhost:$Port" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Cyan
Write-Host "  1. $DeployPath\.env.local 환경 변수 확인"
Write-Host "  2. IIS 관리자에서 WebSocket 프로토콜 활성화 확인"
Write-Host "  3. 방화벽 포트 $Port 열기 (외부 접속 시)"
Write-Host "  4. 브라우저에서 http://localhost:$Port 접속 테스트"
