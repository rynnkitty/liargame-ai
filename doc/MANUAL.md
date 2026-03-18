# MANUAL.md — 구현 + 배포 매뉴얼

> VSCode에서 Claude Code를 사용한 구현 가이드 + Windows Server IIS 배포 가이드

---

## Part 1: 개발 환경 준비

### 1.1 사전 요구사항

| 소프트웨어 | 버전 | 설치 확인 |
|------------|------|-----------|
| Node.js | 18 LTS 이상 | `node -v` |
| npm | 9 이상 | `npm -v` |
| Git | 최신 | `git --version` |
| VSCode | 최신 | — |
| Claude Code (VSCode 확장) | 최신 | VSCode 확장 마켓에서 설치 |

### 1.2 VSCode 확장 프로그램 (권장)

- **Claude Code** (필수)
- ESLint
- Prettier - Code formatter
- Tailwind CSS IntelliSense
- TypeScript Nightly (선택)

---

## Part 2: Claude Code로 프로젝트 구현

### 2.1 프로젝트 초기화

VSCode 터미널(`` Ctrl+` ``)에서 실행:

```bash
# 1. 프로젝트 폴더 생성
mkdir liargame-ai
cd liargame-ai

# 2. Git 초기화
git init
```

### 2.2 Claude Code에 첫 번째 명령

> Claude Code 패널을 열고 (Ctrl+Shift+P → "Claude Code") 아래 명령을 입력하세요.

**명령 1 — 프로젝트 scaffolding**:

```
CLAUDE.md 파일을 읽고 프로젝트를 초기화해줘.

1. package.json 생성 (의존성 포함)
2. tsconfig.json (strict 모드)
3. next.config.mjs (Custom Server용 output: 'standalone')
4. tailwind.config.ts
5. .eslintrc.json + .prettierrc
6. vitest.config.ts
7. .env.example
8. src/app/layout.tsx + page.tsx (기본 홈)
9. server/index.ts (Express + Socket.IO + Next.js 통합 서버)

npm install까지 실행해줘.
```

**명령 2 — 타입 + 상수**:

```
CLAUDE.md의 디렉토리 구조를 참고해서:

1. src/types/game.ts — Room, Player, Phase, Description, Message, Vote, GameResult 타입
2. src/types/socket-events.ts — Socket.IO 이벤트 페이로드 타입
3. src/types/ai.ts — AI 요청/응답 타입
4. src/constants/categories.ts — 한국어 카테고리 10개 (음식, 동물, 직업, 영화, 나라, 스포츠, 악기, 계절/날씨, 교통수단, 가전제품)
5. src/constants/keywords.ts — 카테고리별 키워드 각 15~20개
6. src/constants/ai-templates.ts — 로컬 AI용 설명/토론 템플릿

모두 생성해줘.
```

**명령 3 — 게임 로직 (순수 함수)**:

```
src/lib/game-logic.ts를 구현해줘.

순수 함수로 만들어야 해:
- assignRoles(players, mode) — 역할 배정 (라이어/바보 랜덤 선택)
- selectKeyword(category, mode) — 키워드 선택 (바보 모드: 연관 키워드 쌍)
- shuffleTurnOrder(players) — 턴 순서 랜덤
- tallyVotes(votes) — 투표 집계 (최다 득표자, 동률 처리)
- determineWinner(mode, liarId, mostVotedId, liarGuess, keyword) — 승패 판정

tests/unit/game-logic.test.ts도 함께 작성해줘.
모든 경우의 수 테스트 (시민 승, 라이어 승, 동률, 바보 모드 등).
```

**명령 4 — 방 관리자**:

```
src/lib/room-manager.ts를 구현해줘.

인메모리 Map<string, Room> 기반:
- createRoom(hostNickname) — 방 생성, 6자리 코드
- joinRoom(roomCode, nickname) — 방 입장
- addAIPlayer(roomId) — AI 플레이어 추가
- removePlayer(roomId, playerId) — 플레이어 제거
- getRoom(roomId) — 방 조회
- getRoomByCode(roomCode) — 코드로 방 조회
- deleteRoom(roomId) — 방 삭제
- cleanupStaleRooms() — 30분 이상 비활성 방 정리

tests/unit/room-manager.test.ts도 작성해줘.
```

**명령 5 — Socket.IO 서버**:

```
src/lib/socket/server.ts를 구현해줘.

CLAUDE.md의 Socket.IO 이벤트 목록을 참고:
- room:join, room:leave — 방 입장/퇴장
- game:start — 게임 시작 (역할 배정, 키워드 선택, phase 전환)
- game:describe — 설명 제출 (턴 관리, AI 자동 응답)
- game:message — 토론 메시지 (AI 자동 참여)
- game:vote — 투표 (AI 자동 투표)
- game:final_answer — 라이어 정답
- timer:sync — 타이머 동기화

AI 플레이어는 서버에서 직접 실행 (2~5초 딜레이).
game-logic.ts와 room-manager.ts를 활용해.

src/lib/socket/client.ts도 만들어줘 (브라우저용 Socket.IO 싱글톤).
src/lib/socket/events.ts — 이벤트 이름 상수.
```

**명령 6 — 로컬 AI**:

```
src/lib/ai/local-ai.ts를 구현해줘.

API 키 없이 동작하는 규칙 기반 AI:
- generateDescription(role, keyword, category, prevDescriptions) — 역할별 설명 생성
  - 시민: 키워드 속성 기반 템플릿 선택 + 변형
  - 라이어: 이전 설명 분석 후 범용 설명
  - 바보: 자기 키워드 기반 설명 (모르고 다른 키워드)
- generateDiscussMessage(role, descriptions, messages) — 토론 메시지
- generateVote(role, descriptions, players) — 확률적 투표
- DELAY: 2~5초 랜덤 딜레이 함수

src/lib/ai/ai-engine.ts — 로컬/Claude AI 자동 선택 통합 인터페이스
src/lib/ai/prompts.ts — Claude API용 프롬프트 템플릿 (나중에 사용)

tests/unit/local-ai.test.ts도 작성해줘.
```

**명령 7 — UI 컴포넌트 (홈 + 대기실)**:

```
shadcn/ui를 초기화하고, 홈 페이지와 대기실 컴포넌트를 만들어줘.

1. shadcn/ui init (tailwindcss)
2. 필요한 shadcn 컴포넌트 설치: button, input, card, dialog, badge, avatar, toast

3. src/components/home/CreateRoomForm.tsx — 닉네임 + 방 만들기
4. src/components/home/JoinRoomForm.tsx — 방코드 + 닉네임 + 입장
5. src/components/home/ApiKeySettings.tsx — API 키 설정 모달 (localStorage 저장)
6. src/app/page.tsx — 홈 페이지 (위 컴포넌트 조합)

7. src/components/lobby/PlayerList.tsx — 플레이어 목록 (AI 뱃지 표시)
8. src/components/lobby/AddAIButton.tsx — AI 플레이어 추가 버튼
9. src/components/lobby/GameSettings.tsx — 모드/카테고리/타이머 설정
10. src/components/lobby/RoomCodeShare.tsx — 방 코드 복사 + 링크 공유

11. src/store/game-store.ts — Zustand 게임 스토어
12. src/store/settings-store.ts — 설정 스토어 (API 키)

모바일 반응형으로 만들어줘.
```

**명령 8 — UI 컴포넌트 (게임 진행 + 결과)**:

```
게임 진행과 결과 컴포넌트를 만들어줘.

1. src/components/game/RoleReveal.tsx — 역할/키워드 확인 (10초 타이머)
2. src/components/game/DescriptionPhase.tsx — 턴제 설명 입력 (현재 턴 표시, 입력 폼, 이전 설명 목록)
3. src/components/game/DiscussionPhase.tsx — 채팅 UI (메시지 목록 + 입력)
4. src/components/game/VotePhase.tsx — 플레이어 카드 선택 투표
5. src/components/game/FinalDefense.tsx — 라이어 정답 입력
6. src/components/game/Timer.tsx — 서버 동기화 카운트다운 타이머

7. src/components/result/GameResult.tsx — 승패, 역할 공개, 투표 결과
8. src/components/result/AIAnalysis.tsx — AI 분석 리포트 (Claude API 사용 시)

9. src/app/room/[roomId]/page.tsx — phase에 따라 위 컴포넌트 전환

10. src/hooks/useSocket.ts — Socket.IO 연결 관리
11. src/hooks/useRoom.ts — 방 상태 구독
12. src/hooks/useGame.ts — 게임 액션 (설명, 메시지, 투표)
13. src/hooks/useTimer.ts — 타이머 동기화
14. src/hooks/usePlayer.ts — 현재 플레이어 세션 (sessionStorage)

모바일 반응형, 다크모드 지원.
```

**명령 9 — Claude AI 연동**:

```
Claude API 연동을 구현해줘.

1. src/lib/ai/claude-ai.ts — @anthropic-ai/sdk 래퍼
   - 5초 타임아웃
   - 실패 시 에러 throw (ai-engine.ts에서 로컬 AI로 폴백)

2. src/app/api/ai/describe/route.ts — AI 설명 생성
3. src/app/api/ai/discuss/route.ts — AI 토론 메시지
4. src/app/api/ai/vote/route.ts — AI 투표
5. src/app/api/ai/analyze/route.ts — 게임 분석 리포트
6. src/app/api/ai/keywords/route.ts — 바보 모드 키워드 쌍 생성

API 키는 요청 헤더 x-api-key에서 받아. (클라이언트가 localStorage에서 전송)
키가 없으면 400 에러 → 클라이언트에서 로컬 AI 사용.

Zod로 입력 검증.
```

**명령 10 — 테스트 + CI/CD**:

```
테스트와 CI/CD를 완성해줘.

1. tests/unit/ 부족한 테스트 보강 (커버리지 80% 목표)
2. tests/integration/socket-events.test.ts — Socket.IO 이벤트 통합 테스트
3. tests/integration/game-flow.test.ts — 전체 게임 플로우 (방 생성 → 결과)

4. .github/workflows/ci.yml:
   - Node 18 + 20 매트릭스
   - npm ci → lint → test → build
   - 커버리지 리포트 업로드

5. 빌드 검증: npm run build 성공 확인
```

**명령 11 — IIS 배포 설정**:

```
Windows Server IIS 배포를 위한 설정을 만들어줘.

1. iis/web.config — httpPlatformHandler 설정
   - processPath: node.exe
   - arguments: server/index.js
   - WebSocket 프로토콜 활성화
   - 환경 변수 (PORT, NODE_ENV)

2. iis/deploy.ps1 — PowerShell 배포 스크립트
   - npm run build
   - standalone 출력 복사
   - IIS 사이트 생성/업데이트
   - node_modules production install

3. next.config.mjs에 output: 'standalone' 설정 확인

4. package.json에 deploy:iis 스크립트 추가
```

---

## Part 3: 로컬 개발 서버 실행

### 3.1 환경 변수 설정

```bash
cp .env.example .env.local
```

`.env.local` 편집:

```env
PORT=3000

# Claude API (선택 — 없으면 로컬 AI 사용)
# ANTHROPIC_API_KEY=sk-ant-...
```

### 3.2 개발 서버 실행

```bash
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

### 3.3 게임 테스트 방법

1. 브라우저 탭 1: 방 생성 (닉네임: "호스트")
2. "AI 플레이어 추가" 2번 클릭 (3명 구성)
3. 게임 시작
4. 혼자서 전체 플로우 테스트

멀티플레이 테스트:
1. 브라우저 탭 1: 방 생성
2. 브라우저 탭 2 (시크릿 모드): 방 코드로 입장
3. AI 1명 추가 → 게임 시작

---

## Part 4: Windows Server IIS 배포

### 4.1 서버 사전 요구사항

| 소프트웨어 | 설치 방법 |
|------------|-----------|
| IIS | 서버 관리자 → 역할 추가 → Web Server (IIS) |
| WebSocket 프로토콜 | IIS 역할 → Web Server → Application Development → WebSocket Protocol |
| URL Rewrite | [IIS URL Rewrite 다운로드](https://www.iis.net/downloads/microsoft/url-rewrite) |
| HttpPlatformHandler | [HttpPlatformHandler v1.2 다운로드](https://www.iis.net/downloads/microsoft/httpplatformhandler) |
| Node.js 18 LTS | [nodejs.org](https://nodejs.org) (Windows Installer) |

### 4.2 빌드

```powershell
# 프로젝트 폴더에서 실행
npm run build
```

### 4.3 배포 (자동)

```powershell
# PowerShell 관리자 권한으로 실행
.\iis\deploy.ps1 -SiteName "LiarGameAI" -Port 80 -AppPoolName "LiarGameAIPool"
```

### 4.4 배포 (수동)

1. **빌드 파일 복사**:
   ```powershell
   # 배포 폴더 생성
   $deployPath = "C:\inetpub\liargame-ai"
   New-Item -ItemType Directory -Path $deployPath -Force

   # 필요한 파일 복사
   Copy-Item -Path ".next\standalone\*" -Destination $deployPath -Recurse
   Copy-Item -Path ".next\static" -Destination "$deployPath\.next\static" -Recurse
   Copy-Item -Path "public" -Destination "$deployPath\public" -Recurse
   Copy-Item -Path "iis\web.config" -Destination $deployPath
   Copy-Item -Path ".env.production" -Destination "$deployPath\.env.local"
   ```

2. **IIS 사이트 생성**:
   - IIS 관리자 열기
   - 사이트 → 사이트 추가
   - 사이트 이름: `LiarGameAI`
   - 실제 경로: `C:\inetpub\liargame-ai`
   - 포트: 원하는 포트 (예: 80 또는 3000)

3. **앱 풀 설정**:
   - 응용 프로그램 풀 → LiarGameAIPool
   - .NET CLR 버전: `관리 코드 없음`
   - 시작 모드: `AlwaysRunning`

4. **WebSocket 활성화 확인**:
   - IIS 관리자 → 서버 이름 → 구성 편집기
   - `system.webServer/webSocket` 섹션
   - `enabled` = `True`

5. **환경 변수 설정** (`.env.local`):
   ```env
   PORT=3000
   NODE_ENV=production
   # ANTHROPIC_API_KEY=sk-ant-... (선택)
   ```

### 4.5 배포 검증

```powershell
# 1. IIS 사이트 시작 확인
Get-Website -Name "LiarGameAI"

# 2. 브라우저에서 접속
Start-Process "http://localhost"

# 3. 로그 확인 (문제 시)
Get-Content "C:\inetpub\liargame-ai\logs\stdout.log" -Tail 50
```

### 4.6 방화벽 설정 (외부 접속 허용)

```powershell
# 80 포트 방화벽 열기
New-NetFirewallRule -DisplayName "LiarGame AI" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
```

외부에서 `http://서버IP` 또는 `http://도메인` 으로 접속 가능.

---

## Part 5: 문제 해결

### Socket.IO 연결 실패 (IIS)

**증상**: 브라우저 콘솔에 WebSocket 연결 오류

**해결**:
1. IIS에서 WebSocket 프로토콜 설치 확인
2. `web.config`에 WebSocket 설정 확인
3. 앱 풀의 "관리 코드 없음" 확인
4. httpPlatformHandler 설치 확인

### 빌드 실패

**증상**: `npm run build` 에러

**해결**:
```bash
# node_modules 재설치
rm -rf node_modules .next
npm install
npm run build
```

### AI 플레이어가 응답하지 않음

**증상**: AI 턴에서 멈춤

**해결**:
1. 서버 로그 확인 (`console.log`)
2. AI 딜레이 타이머 (2~5초) 대기
3. API 키 없이도 로컬 AI는 동작해야 함 → `local-ai.ts` 로직 확인

### 포트 충돌

**증상**: `EADDRINUSE` 에러

**해결**:
```powershell
# 포트 사용 프로세스 확인
netstat -ano | findstr :3000
# 프로세스 종료
taskkill /PID <PID> /F
```
