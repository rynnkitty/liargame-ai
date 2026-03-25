# LiarGame AI — Windows Server 2016 / IIS 10 배포 메뉴얼

> **도메인**: `liargame.kimkitty.net`
> **대상 환경**: Windows Server 2016 Standard + IIS 10

---

## 목차

1. [사전 요구사항 확인](#1-사전-요구사항-확인)
2. [IIS 기능 설치](#2-iis-기능-설치)
3. [httpPlatformHandler 설치](#3-httpplatformhandler-설치)
4. [Node.js 설치](#4-nodejs-설치)
5. [소스코드 준비 (빌드)](#5-소스코드-준비-빌드)
6. [배포 디렉토리 구성](#6-배포-디렉토리-구성)
7. [IIS 사이트 구성](#7-iis-사이트-구성)
8. [web.config 설정](#8-webconfig-설정)
9. [DNS 등록](#9-dns-등록)
10. [방화벽 / 포트 설정](#10-방화벽--포트-설정)
11. [HTTPS 인증서 설정](#11-https-인증서-설정)
12. [서비스 시작 및 헬스체크](#12-서비스-시작-및-헬스체크)
13. [자동 배포 스크립트](#13-자동-배포-스크립트)
14. [트러블슈팅](#14-트러블슈팅)
15. [배포 체크리스트](#15-배포-체크리스트)

---

## 1. 사전 요구사항 확인

### 서버 스펙 요구사항

| 항목 | 최소 | 권장 |
|------|------|------|
| OS | Windows Server 2016 Standard | Windows Server 2016 Standard |
| CPU | 2코어 | 4코어 |
| RAM | 2 GB | 4 GB |
| 디스크 | 5 GB 여유 | 10 GB 이상 |
| .NET Framework | 4.6.1+ | 4.7.2+ |

### 필요한 소프트웨어

| 소프트웨어 | 버전 | 용도 |
|-----------|------|------|
| IIS 10 | 기본 포함 | 웹 서버 |
| IIS WebSocket Protocol | 기본 포함 | Socket.IO 실시간 통신 |
| httpPlatformHandler | v1.2 | Node.js 프로세스 관리 |
| URL Rewrite Module | 2.1 | HTTP → HTTPS 리다이렉트 |
| Node.js | v20 LTS | 앱 런타임 |
| win-acme | 최신 | Let's Encrypt 인증서 자동 발급/갱신 |

### 관리자 권한 확인

모든 설치/배포 작업은 **로컬 관리자(Administrators)** 권한이 필요합니다.

```powershell
# 관리자 권한 확인 — 출력이 있으면 관리자 그룹 소속
whoami /groups | findstr "S-1-5-32-544"
```

---

## 2. IIS 기능 설치

**방법 A (PowerShell, 권장)** 또는 **방법 B (GUI)** 중 하나로 진행합니다.

### 방법 A — PowerShell

관리자 권한 PowerShell에서 실행:

```powershell
Install-WindowsFeature -Name `
    Web-Server,
    Web-Common-Http,
    Web-Default-Doc,
    Web-Static-Content,
    Web-Http-Logging,
    Web-Stat-Compression,
    Web-Dyn-Compression,
    Web-Security,
    Web-Filtering,
    Web-Net-Ext45,
    Web-Asp-Net45,
    Web-ISAPI-Ext,
    Web-ISAPI-Filter,
    Web-WebSockets,
    Web-Mgmt-Console,
    Web-Mgmt-Tools `
    -IncludeManagementTools
```

> **중요**: `Web-WebSockets`는 Socket.IO 동작에 필수입니다. 누락 시 실시간 게임 기능이 전혀 작동하지 않습니다.

### 방법 B — 서버 관리자 GUI

1. 서버 관리자 → **역할 및 기능 추가**
2. **웹 서버(IIS)** 선택
3. 역할 서비스에서 다음 항목 반드시 체크:
   - 일반적인 HTTP 기능 (전체)
   - 성능 → 정적/동적 콘텐츠 압축
   - 보안 → 요청 필터링
   - 응용 프로그램 개발 → **WebSocket 프로토콜** ← 핵심
   - 관리 도구 (전체)

### 설치 확인

```powershell
# IIS 버전 확인
(Get-ItemProperty HKLM:\SOFTWARE\Microsoft\InetStp\).VersionString

# WebSocket 모듈 설치 확인
Get-WindowsFeature Web-WebSockets
# InstallState: Installed 가 출력되어야 함
```

---

## 3. httpPlatformHandler 설치

IIS가 Node.js 프로세스를 직접 실행하고 관리하게 해주는 핵심 모듈입니다.

### 다운로드

Microsoft 공식 다운로드 센터에서 **httpPlatformHandler v1.2** 다운로드:
- 64비트 서버: `httpPlatformHandler_amd64.msi`
- 32비트 서버: `httpPlatformHandler_x86.msi`

```powershell
# 서버 아키텍처 확인
[System.Environment]::Is64BitOperatingSystem
# True → amd64, False → x86
```

### 설치

```powershell
# 관리자 PowerShell에서 실행
msiexec /i httpPlatformHandler_amd64.msi /quiet /norestart
```

또는 다운로드한 `.msi` 파일을 더블클릭 → 설치 마법사 진행.

### 설치 확인

```powershell
# IIS 모듈 목록에서 확인
Get-WebConfiguration system.webServer/globalModules/* |
    Where-Object { $_.name -like "*Platform*" }
# 출력: name=httpPlatformHandler, image=...\httpPlatformHandler.dll
```

IIS 관리자 → 서버 수준 → **모듈** → `httpPlatformHandler` 항목이 있으면 정상.

### URL Rewrite Module 설치

HTTP → HTTPS 강제 리다이렉트에 필요합니다.

```powershell
# Microsoft 공식 다운로드 후 설치
msiexec /i rewrite_amd64_en-US.msi /quiet /norestart
```

설치 후 IIS 관리자 → 모듈 목록에 `RewriteModule` 항목 확인.

---

## 4. Node.js 설치

### 다운로드 및 설치

Node.js 공식 사이트(`nodejs.org`)에서 **v20 LTS Windows 64-bit (`.msi`)** 다운로드 후 설치.

설치 옵션:
- "Add to PATH" — **반드시 체크** (기본 체크됨)
- "Automatically install necessary tools" — 체크 불필요

### 설치 확인

새 PowerShell 창을 열고:

```powershell
node --version   # v20.x.x 출력
npm --version    # 10.x.x 출력
```

### IIS 앱풀 계정 실행 권한 부여

IIS는 `IIS AppPool\liargame-ai-pool` 계정으로 Node.js를 실행합니다. Node.js 설치 경로에 실행 권한이 필요합니다.

```powershell
$nodePath = "C:\Program Files\nodejs"

$acl  = Get-Acl $nodePath
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "IIS AppPool\liargame-ai-pool",
    "ReadAndExecute",
    "ContainerInherit,ObjectInherit",
    "None",
    "Allow"
)
$acl.SetAccessRule($rule)
Set-Acl $nodePath $acl

Write-Host "Node.js 실행 권한 부여 완료"
```

---

## 5. 소스코드 준비 (빌드)

> **권장**: 빌드는 개발 PC(또는 별도 빌드 서버)에서 수행하고, 빌드 결과물만 배포 서버로 옮깁니다. 배포 서버에 npm, TypeScript 등을 설치할 필요가 없습니다.

### 5-1. 개발 PC에서 빌드

```bash
# 프로젝트 루트에서 실행
cd D:\1.프로젝트\98.사내해커톤\liargame-ai

# 1. 전체 의존성 설치 (devDependencies 포함 — 빌드에 필요)
npm ci

# 2. 프로덕션 빌드
#    - Next.js standalone 빌드  →  .next/standalone/
#    - TypeScript 서버 컴파일   →  dist/server/index.js
npm run build
```

빌드 성공 시 생성되는 디렉토리:

```
.next/
  standalone/        ← Next.js 실행에 필요한 최소 런타임 (node_modules 포함)
  static/            ← CSS, JS 번들 등 정적 파일
dist/
  server/
    index.js         ← 컴파일된 Express 서버 진입점 (httpPlatformHandler가 실행)
public/              ← 이미지 등 정적 에셋
iis/
  web.config         ← IIS 설정 파일
```

### 5-2. 배포 패키지 구성

```powershell
$pkg = "C:\Temp\liargame-deploy"
New-Item -ItemType Directory -Force $pkg | Out-Null

# Next.js standalone (node_modules 포함)
Copy-Item .next\standalone\* $pkg -Recurse -Force

# 정적 파일 (_next/static)
$staticDst = "$pkg\.next\static"
New-Item -ItemType Directory -Force $staticDst | Out-Null
Copy-Item .next\static\* $staticDst -Recurse -Force

# public 폴더
if (Test-Path public) {
    Copy-Item public "$pkg\public" -Recurse -Force
}

# 컴파일된 서버
Copy-Item dist "$pkg\dist" -Recurse -Force

# IIS 설정
Copy-Item iis\web.config $pkg -Force

# 로그 디렉토리
New-Item -ItemType Directory -Force "$pkg\logs" | Out-Null

Write-Host "배포 패키지 준비 완료: $pkg"
```

> `node_modules`는 `.next/standalone/` 안에 이미 포함되어 있어 **별도 복사 불필요**합니다.

### 5-3. 배포 서버로 전송

```powershell
# robocopy 사용 (권장 — 중단 재개 지원)
robocopy "C:\Temp\liargame-deploy" "\\배포서버IP\C$\inetpub\liargame-ai" /E /COPYALL /R:3 /W:5

# 또는 파일 탐색기로 \\배포서버IP\C$\inetpub\liargame-ai 에 직접 복사
```

---

## 6. 배포 디렉토리 구성

**배포 서버**에서 관리자 PowerShell 실행.

### 최종 디렉토리 구조

```
C:\inetpub\liargame-ai\
  .next\
    standalone\   (Next.js 런타임 + node_modules)
    static\       (정적 파일)
  dist\
    server\
      index.js    ← httpPlatformHandler 진입점
  public\
  logs\           ← Node.js stdout 로그 (앱풀 계정 쓰기 권한 필요)
  web.config
```

### 디렉토리 권한 설정

```powershell
$DeployPath  = "C:\inetpub\liargame-ai"
$AppPoolUser = "IIS AppPool\liargame-ai-pool"

# 배포 루트: 읽기+실행 권한
$acl  = Get-Acl $DeployPath
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $AppPoolUser, "ReadAndExecute",
    "ContainerInherit,ObjectInherit", "None", "Allow"
)
$acl.SetAccessRule($rule)
Set-Acl $DeployPath $acl

# logs 디렉토리: 쓰기 권한 (로그 파일 생성에 필요)
$logsPath = "$DeployPath\logs"
New-Item -ItemType Directory -Force $logsPath | Out-Null

$acl  = Get-Acl $logsPath
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $AppPoolUser, "Modify",
    "ContainerInherit,ObjectInherit", "None", "Allow"
)
$acl.SetAccessRule($rule)
Set-Acl $logsPath $acl

Write-Host "디렉토리 권한 설정 완료"
```

---

## 7. IIS 사이트 구성

### 7-1. 앱풀 생성

```powershell
Import-Module WebAdministration

$AppPoolName = "liargame-ai-pool"

# 기존 앱풀이 있으면 중지 후 재구성
if (Test-Path "IIS:\AppPools\$AppPoolName") {
    Stop-WebAppPool -Name $AppPoolName -ErrorAction SilentlyContinue
} else {
    New-WebAppPool -Name $AppPoolName | Out-Null
    Write-Host "앱풀 생성: $AppPoolName"
}

# Node.js는 자체 런타임 사용 — 관리 코드 없음(No Managed Code)으로 설정
Set-ItemProperty "IIS:\AppPools\$AppPoolName" managedRuntimeVersion ""

# 앱풀 ID: ApplicationPoolIdentity (보안상 권장)
Set-ItemProperty "IIS:\AppPools\$AppPoolName" processModel.identityType "ApplicationPoolIdentity"

# 주기적 재시작 비활성화 (httpPlatformHandler가 프로세스 수명 관리)
Set-ItemProperty "IIS:\AppPools\$AppPoolName" recycling.periodicRestart.time "00:00:00"

# 유휴 타임아웃 비활성화 (게임 진행 중 연결 유지 필요)
Set-ItemProperty "IIS:\AppPools\$AppPoolName" processModel.idleTimeout "00:00:00"

Write-Host "앱풀 구성 완료"
```

### 7-2. 웹사이트 생성

```powershell
$SiteName   = "liargame-ai"
$DeployPath = "C:\inetpub\liargame-ai"

# Default Web Site가 80포트를 점유하면 중지
Stop-Website -Name "Default Web Site" -ErrorAction SilentlyContinue

# 사이트 생성 (80포트 + 호스트명 바인딩)
if (Test-Path "IIS:\Sites\$SiteName") {
    Write-Host "기존 사이트 발견 — 설정 업데이트"
    Set-ItemProperty "IIS:\Sites\$SiteName" physicalPath $DeployPath
    Set-ItemProperty "IIS:\Sites\$SiteName" applicationPool $AppPoolName
} else {
    New-Website -Name $SiteName `
                -PhysicalPath $DeployPath `
                -Port 80 `
                -HostHeader "liargame.kimkitty.net" `
                -ApplicationPool $AppPoolName | Out-Null
    Write-Host "사이트 생성: $SiteName"
}
```

### 7-3. IIS 관리자 GUI로 확인

1. `Win + R` → `inetmgr` 실행
2. 좌측 트리: **사이트** → **liargame-ai** 클릭
3. 우측 패널: **기본 설정** → 실제 경로 `C:\inetpub\liargame-ai` 확인
4. **바인딩** → `http :80 liargame.kimkitty.net` 확인
5. **응용 프로그램 풀** → `liargame-ai-pool` 연결 확인

---

## 8. web.config 설정

`C:\inetpub\liargame-ai\web.config`를 메모장 또는 VS Code로 열어 편집합니다.

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>

    <!-- httpPlatformHandler: Node.js 프로세스를 IIS 뒤에서 실행 -->
    <handlers>
      <add name="httpPlatformHandler"
           path="*"
           verb="*"
           modules="httpPlatformHandler"
           resourceType="Unspecified" />
    </handlers>

    <httpPlatform processPath="node.exe"
                  arguments="dist\server\index.js"
                  startupTimeLimit="60"
                  startupRetryCount="3"
                  requestTimeout="00:02:00"
                  stdoutLogEnabled="true"
                  stdoutLogFile="logs\node.log">
      <environmentVariables>
        <!-- IIS가 자동 할당한 포트 → Node.js로 전달 (수정 금지) -->
        <environmentVariable name="PORT"     value="%HTTP_PLATFORM_PORT%" />
        <environmentVariable name="NODE_ENV" value="production" />

        <!-- Claude API 키 (없으면 로컬 규칙 기반 AI로 동작) -->
        <environmentVariable name="ANTHROPIC_API_KEY" value="sk-ant-여기에_실제_키_입력" />

        <!-- 사용할 Claude 모델
             claude-haiku-4-5   : 빠름, 저렴  (기본 권장)
             claude-sonnet-4-6  : 균형
             claude-opus-4-6    : 고성능, 고비용 -->
        <environmentVariable name="CLAUDE_MODEL" value="claude-haiku-4-5" />
      </environmentVariables>
    </httpPlatform>

    <!-- WebSocket 프로토콜 활성화 (Socket.IO 필수) -->
    <webSocket enabled="true" />

    <!-- HTTP → HTTPS 강제 리다이렉트 (URL Rewrite Module 필요) -->
    <rewrite>
      <rules>
        <rule name="HTTP to HTTPS" stopProcessing="true">
          <match url="(.*)" />
          <conditions>
            <add input="{HTTPS}" pattern="^OFF$" />
          </conditions>
          <action type="Redirect"
                  url="https://{HTTP_HOST}/{R:1}"
                  redirectType="Permanent" />
        </rule>
      </rules>
    </rewrite>

    <!-- 정적 파일 장기 캐싱 (Next.js standalone _next/static) -->
    <staticContent>
      <clientCache cacheControlMode="UseMaxAge" cacheControlMaxAge="365.00:00:00" />
    </staticContent>

    <!-- 응답 압축 -->
    <urlCompression doStaticCompression="true" doDynamicCompression="true" />

    <!-- 보안 헤더 -->
    <httpProtocol>
      <customHeaders>
        <add name="X-Content-Type-Options"    value="nosniff" />
        <add name="X-Frame-Options"           value="SAMEORIGIN" />
        <add name="X-XSS-Protection"          value="1; mode=block" />
        <add name="Strict-Transport-Security" value="max-age=31536000; includeSubDomains" />
      </customHeaders>
    </httpProtocol>

  </system.webServer>
</configuration>
```

> **보안 주의**: `ANTHROPIC_API_KEY` 값이 포함된 `web.config`는 소스 관리(git)에 올리지 마세요. IIS가 자동으로 외부 HTTP 접근을 차단하지만, 저장소 노출 시 키가 유출됩니다.

---

## 9. DNS 등록

### A 레코드 등록

`kimkitty.net` 도메인 관리 패널(가비아, Cloudflare 등)에서 다음 레코드를 추가합니다:

| 타입 | 이름 | 값 | TTL |
|------|------|-----|-----|
| A | `liargame` | `서버 공인 IP` | 300 |

```powershell
# 서버 공인 IP 확인
(Invoke-WebRequest -Uri "https://api.ipify.org" -UseBasicParsing).Content
```

### DNS 전파 확인

레코드 등록 후 수분 ~ 수십분 소요됩니다.

```powershell
# 전파 확인 — 서버 IP가 출력되면 완료
nslookup liargame.kimkitty.net

# 또는
Resolve-DnsName liargame.kimkitty.net
```

---

## 10. 방화벽 / 포트 설정

```powershell
# HTTP (80) — DNS 인증 및 HTTP 접속용
New-NetFirewallRule -DisplayName "LiarGame AI HTTP (80)" `
                    -Direction Inbound `
                    -Protocol TCP `
                    -LocalPort 80 `
                    -Action Allow `
                    -Profile Any

# HTTPS (443) — 메인 서비스 포트
New-NetFirewallRule -DisplayName "LiarGame AI HTTPS (443)" `
                    -Direction Inbound `
                    -Protocol TCP `
                    -LocalPort 443 `
                    -Action Allow `
                    -Profile Any

# 등록 확인
Get-NetFirewallRule -DisplayName "LiarGame AI*" |
    Select-Object DisplayName, Enabled, Direction, Action |
    Format-Table
```

> 클라우드/IDC 서버를 사용하는 경우, **보안 그룹** 또는 **외부 방화벽**에서도 80, 443 인바운드를 열어야 합니다.

---

## 11. HTTPS 인증서 설정

Socket.IO는 HTTPS 환경에서 WSS(WebSocket Secure)로 자동 업그레이드됩니다. HTTP 환경에서는 일부 브라우저/보안 네트워크에서 WebSocket 연결이 차단될 수 있으므로 HTTPS 설정을 강력 권장합니다.

### 방법 A — Let's Encrypt 무료 인증서 (win-acme)

**win-acme** 다운로드: `https://www.win-acme.com`에서 최신 릴리즈 ZIP 다운로드

```powershell
# 압축 해제 후 실행 (예: C:\tools\win-acme)
cd C:\tools\win-acme

# IIS 사이트 ID 조회
$siteId = (Get-Website -Name "liargame-ai").id
Write-Host "사이트 ID: $siteId"

# 인증서 발급 및 IIS 자동 바인딩
.\wacs.exe --target manual `
           --host liargame.kimkitty.net `
           --installation iis `
           --siteid $siteId `
           --store certificatestore
```

win-acme이 자동으로 처리하는 항목:
- Let's Encrypt 인증서 발급 (도메인 소유 HTTP 검증)
- IIS에 HTTPS 바인딩 추가 (`*:443:liargame.kimkitty.net`)
- 인증서를 Windows 인증서 저장소에 등록
- 90일마다 자동 갱신 (Windows 작업 스케줄러에 등록)

### 방법 B — 기존 SSL 인증서 (PFX 파일 보유 시)

```powershell
# PFX 인증서 가져오기
$certPassword = ConvertTo-SecureString "인증서비밀번호" -AsPlainText -Force
$cert = Import-PfxCertificate `
    -FilePath "C:\certs\liargame.pfx" `
    -CertStoreLocation "Cert:\LocalMachine\My" `
    -Password $certPassword

Write-Host "인증서 지문(Thumbprint): $($cert.Thumbprint)"

# HTTPS 바인딩 추가 (SNI 활성화)
New-WebBinding -Name "liargame-ai" `
               -Protocol https `
               -Port 443 `
               -HostHeader "liargame.kimkitty.net" `
               -SslFlags 1

# 인증서를 바인딩에 연결
$binding = Get-WebBinding -Name "liargame-ai" -Protocol https
$binding.AddSslCertificate($cert.Thumbprint, "My")

Write-Host "HTTPS 바인딩 완료"
```

### 최종 바인딩 상태 확인

```powershell
Get-WebBinding -Name "liargame-ai" |
    Select-Object Protocol, bindingInformation |
    Format-Table

# 정상 출력 예시:
# Protocol  bindingInformation
# --------  ------------------
# http      *:80:liargame.kimkitty.net
# https     *:443:liargame.kimkitty.net
```

---

## 12. 서비스 시작 및 헬스체크

### 서비스 시작

```powershell
Import-Module WebAdministration

Start-WebAppPool -Name "liargame-ai-pool"
Start-Website    -Name "liargame-ai"

# 상태 확인
Get-WebAppPoolState -Name "liargame-ai-pool"   # Started
(Get-Website -Name "liargame-ai").State        # Started
```

### 응답 테스트

Node.js 기동까지 최대 30~60초 소요됩니다.

```powershell
$url     = "https://liargame.kimkitty.net"
$timeout = 30
$elapsed = 0
$ok      = $false

while ($elapsed -lt $timeout) {
    Start-Sleep -Seconds 2
    $elapsed += 2
    try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($r.StatusCode -lt 500) { $ok = $true; break }
    } catch {}
    Write-Host "  대기 중 ($elapsed/$timeout 초)" -ForegroundColor DarkGray
}

if ($ok) {
    Write-Host "정상 응답: HTTP $($r.StatusCode)" -ForegroundColor Green
} else {
    Write-Host "응답 없음 — 로그를 확인하세요" -ForegroundColor Red
}
```

### 로그 확인

```powershell
# Node.js 프로세스 stdout 로그
Get-Content "C:\inetpub\liargame-ai\logs\node.log" -Tail 50

# IIS 접근 로그
Get-ChildItem "C:\inetpub\logs\LogFiles" -Recurse -Filter "*.log" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 |
    Get-Content -Tail 30
```

정상 기동 시 `node.log` 출력 예시:
```
[Socket.IO] 서버 초기화 완료
[Next.js] ready - started server on 0.0.0.0:XXXXX
[Server] LiarGame AI 서버 실행 중 — 포트 XXXXX
```

### 빠른 상태 점검

```powershell
Import-Module WebAdministration

Write-Host "=== LiarGame AI 상태 점검 ===" -ForegroundColor Cyan
Write-Host "앱풀  : $(Get-WebAppPoolState -Name 'liargame-ai-pool')"
Write-Host "사이트: $((Get-Website -Name 'liargame-ai').State)"
Write-Host ""
Write-Host "Node 프로세스:"
Get-Process node -ErrorAction SilentlyContinue |
    Select-Object Id, CPU, @{n='RAM(MB)';e={[math]::Round($_.WorkingSet/1MB,1)}}, StartTime |
    Format-Table
Write-Host "최근 로그 (마지막 20줄):"
Get-Content "C:\inetpub\liargame-ai\logs\node.log" -Tail 20 -ErrorAction SilentlyContinue
```

---

## 13. 자동 배포 스크립트

프로젝트에 포함된 `iis/deploy.ps1`을 사용하면 빌드부터 IIS 등록까지 자동화됩니다.

### 사용법

**개발 PC**에서 관리자 PowerShell 실행:

```powershell
cd D:\1.프로젝트\98.사내해커톤\liargame-ai

# 기본 설정으로 실행
.\iis\deploy.ps1

# 커스텀 옵션
.\iis\deploy.ps1 -SiteName "liargame-ai" `
                 -DeployPath "C:\inetpub\liargame-ai" `
                 -Port 80 `
                 -AppPoolName "liargame-ai-pool"
```

### ExecutionPolicy 오류 시

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### 스크립트 동작 순서

1. 사전 조건 확인 (node, npm, IIS 모듈)
2. `npm ci` — 프로덕션 의존성 설치
3. `npm run build` — Next.js + TypeScript 컴파일
4. 배포 디렉토리 준비 (기존 디렉토리 타임스탬프 백업)
5. 빌드 산출물 복사 (standalone, static, public, dist, web.config)
6. IIS 앱풀 생성/재구성
7. IIS 사이트 생성/업데이트
8. 앱풀/사이트 시작
9. HTTP 헬스체크 (30초 대기)

---

## 14. 트러블슈팅

### 문제 1: 503 Service Unavailable

**원인**: Node.js 프로세스 기동 실패

```powershell
# 1. 로그 확인
Get-Content "C:\inetpub\liargame-ai\logs\node.log" -Tail 100

# 2. node.exe 직접 실행으로 오류 재현
cd C:\inetpub\liargame-ai
$env:PORT = "3000"; $env:NODE_ENV = "production"
node dist\server\index.js
# 오류 메시지 확인 후 조치
```

**체크리스트**:
- `dist\server\index.js` 파일 존재 여부
- `node.exe` PATH 등록 여부 (`where.exe node`)
- 앱풀 계정의 배포 디렉토리 읽기 권한

---

### 문제 2: WebSocket 연결 실패 (실시간 기능 미동작)

**원인**: WebSocket IIS 모듈 미설치 또는 web.config 설정 누락

```powershell
# WebSocket 기능 설치 확인
Get-WindowsFeature Web-WebSockets

# 설치 안 된 경우
Install-WindowsFeature Web-WebSockets

# IIS 재시작
iisreset
```

`web.config` 내 `<webSocket enabled="true" />` 존재 여부 확인.

---

### 문제 3: httpPlatformHandler 모듈 오류

"Handler 'httpPlatformHandler' has a bad module" 오류:

```powershell
# 모듈 등록 확인
Get-WebConfiguration system.webServer/globalModules/* |
    Where-Object { $_.name -like "*Platform*" }

# 없으면 httpPlatformHandler 재설치 후
iisreset /noforce
```

---

### 문제 4: 포트 충돌 (80포트 사용 중)

```powershell
# 80포트 사용 프로세스 확인
netstat -ano | findstr ":80 "

# PID로 프로세스 조회
tasklist /fi "PID eq 4"     # PID 4 = System (IIS 커널 모드 드라이버)

# Default Web Site 중지
Stop-Website -Name "Default Web Site"
Set-ItemProperty "IIS:\Sites\Default Web Site" serverAutoStart $false
```

---

### 문제 5: 앱풀 계정 권한 오류 (Access Denied)

```powershell
# 현재 권한 확인
Get-Acl "C:\inetpub\liargame-ai" | Format-List

# 앱풀 계정에 권한 재설정 (섹션 6 참고)
# - 배포 루트   : ReadAndExecute
# - logs 폴더   : Modify (쓰기 필요)
# - node.exe 경로: ReadAndExecute
```

---

### 문제 6: HTTPS 접속 시 인증서 오류

```powershell
# 443 바인딩 확인
Get-WebBinding -Name "liargame-ai" -Protocol https

# 인증서 유효성 확인
Get-ChildItem "Cert:\LocalMachine\My" |
    Where-Object { $_.Subject -like "*kimkitty*" } |
    Select-Object Subject, NotAfter, Thumbprint
```

인증서 만료 시 win-acme 수동 갱신:
```powershell
cd C:\tools\win-acme
.\wacs.exe --renew --force
```

---

### 문제 7: 빌드 오류 — `.next/standalone` 없음

`next.config.mjs`에 `output: 'standalone'` 설정 확인:

```javascript
// next.config.mjs
const nextConfig = {
  output: 'standalone',  // ← 이 줄이 없으면 standalone 디렉토리 생성 안 됨
  experimental: {
    serverComponentsExternalPackages: ['socket.io'],
  },
};
export default nextConfig;
```

---

### 문제 8: DNS 미전파 (도메인 접속 안 됨)

```powershell
# DNS 전파 상태 확인
nslookup liargame.kimkitty.net 8.8.8.8    # Google DNS 기준
nslookup liargame.kimkitty.net 1.1.1.1    # Cloudflare DNS 기준

# IP 직접 접속으로 앱 정상 여부 먼저 확인
Invoke-WebRequest -Uri "http://서버공인IP" -UseBasicParsing
```

DNS 전파는 TTL 설정에 따라 최대 48시간 소요될 수 있습니다. 처음 등록 시 TTL을 300(5분)으로 설정하면 빠르게 전파됩니다.

---

## 15. 배포 체크리스트

### 사전 설치

- [ ] IIS 10 설치 (`Web-WebSockets` 포함)
- [ ] httpPlatformHandler v1.2 설치
- [ ] URL Rewrite Module 2.1 설치
- [ ] Node.js v20 LTS 설치 및 PATH 등록
- [ ] 방화벽 80, 443 포트 인바운드 허용

### 빌드 및 배포

- [ ] 개발 PC에서 `npm ci && npm run build` 실행
- [ ] `.next/standalone`, `.next/static`, `dist/`, `public/` 확인
- [ ] 배포 서버 `C:\inetpub\liargame-ai` 로 파일 복사
- [ ] `logs/` 디렉토리 생성

### IIS 구성

- [ ] IIS 앱풀 생성 (No Managed Code, 재시작/유휴타임아웃 비활성)
- [ ] IIS 사이트 생성 (`*:80:liargame.kimkitty.net` 바인딩)
- [ ] Default Web Site 중지 (80포트 충돌 방지)

### 설정 파일

- [ ] `web.config` 배포 디렉토리에 위치 확인
- [ ] `ANTHROPIC_API_KEY` 입력 (선택 — 없으면 로컬 AI 동작)
- [ ] `CLAUDE_MODEL` 설정 확인

### 권한

- [ ] 배포 루트 → 앱풀 계정 ReadAndExecute 권한
- [ ] `logs/` → 앱풀 계정 Modify 권한
- [ ] Node.js 설치 경로 → 앱풀 계정 ReadAndExecute 권한

### DNS / HTTPS

- [ ] DNS A 레코드 등록 (`liargame` → 서버 공인 IP)
- [ ] DNS 전파 확인 (`nslookup liargame.kimkitty.net`)
- [ ] HTTPS 인증서 발급 (win-acme 또는 PFX)
- [ ] `*:443:liargame.kimkitty.net` 바인딩 추가
- [ ] `web.config` HTTP → HTTPS 리다이렉트 규칙 확인

### 최종 확인

- [ ] 앱풀 및 사이트 시작
- [ ] `https://liargame.kimkitty.net` 접속 확인
- [ ] Socket.IO 실시간 연결 확인 (게임 참가 후 플레이어 목록 갱신 여부)
- [ ] `logs/node.log` 오류 없음 확인
