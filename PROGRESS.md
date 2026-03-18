# PROGRESS.md — 개발 진행 기록

> 이 문서는 개발 과정을 단계별로 추적합니다.
> 각 Phase의 체크리스트와 커밋 이력을 기록하여 평가 기준 "개발 진행 기록(9점)"에 대응합니다.

---

## Phase 1: 기반 구축

**목표**: 프로젝트 초기 설정, 서버 구조, 타입 시스템 완성

- [ ] 프로젝트 초기화 (`npm init`, 의존성 설치)
- [ ] TypeScript + ESLint + Prettier 설정
- [ ] Next.js App Router 기본 구조 생성
- [ ] Custom Server 구현 (`server/index.ts` — Express + Socket.IO + Next.js)
- [ ] 전체 타입 정의 (`src/types/`)
- [ ] 카테고리/키워드 상수 데이터 (`src/constants/`)
- [ ] 환경 변수 템플릿 (`.env.example`)

**주요 기술 결정**:
- Supabase 대신 Socket.IO 선택: IIS 배포 호환성, 외부 서비스 의존 제거
- Custom Server (Express): httpPlatformHandler로 IIS 뒤에 배치 가능
- 인메모리 상태 관리: 게임은 짧은 세션이므로 DB 불필요

**커밋 이력**:
```
(Phase 1 구현 후 기록)
```

---

## Phase 2: 핵심 로직

**목표**: 게임 로직, 방 관리, Socket.IO 이벤트, 로컬 AI 완성

- [ ] 게임 로직 순수 함수 (`game-logic.ts`) + 단위 테스트
- [ ] 인메모리 방 관리자 (`room-manager.ts`) + 단위 테스트
- [ ] Socket.IO 서버 이벤트 핸들러 (`socket/server.ts`)
- [ ] Socket.IO 클라이언트 싱글톤 (`socket/client.ts`)
- [ ] 로컬 규칙 기반 AI (`ai/local-ai.ts`) + 단위 테스트
- [ ] AI 통합 엔진 (`ai/ai-engine.ts`)
- [ ] 게임 상태 머신 전이 로직

**주요 기술 결정**:
- 게임 로직을 순수 함수로 분리: 테스트 용이성, 서버/클라이언트 재사용
- 로컬 AI를 먼저 구현: API 키 없이 전체 게임 플로우 검증 가능
- 투표 로직: 설명 유사도 기반 확률적 AI 투표 (자연스러움)

**커밋 이력**:
```
(Phase 2 구현 후 기록)
```

---

## Phase 3: UI 구현

**목표**: 홈, 대기실, 게임 진행, 결과 — 전체 UI 완성

- [x] 홈 페이지 (방 생성/입장 폼, API 키 설정) — Socket.IO 연동 포함
- [x] 대기실 (플레이어 목록, AI 추가, 게임 설정, 방 코드 공유)
- [x] 역할 확인 화면 (`RoleReveal`) — 10초 타이머
- [x] 설명 단계 (`DescriptionPhase`) — 턴제 입력
- [x] 토론 단계 (`DiscussionPhase`) — 채팅 UI
- [x] 투표 단계 (`VotePhase`) — 플레이어 카드 선택
- [x] 최종 변론 (`FinalDefense`) — 라이어 정답 입력
- [x] 결과 화면 (`GameResult` + `AIAnalysis`)
- [x] 타이머 컴포넌트 (서버 동기화, 원형 SVG)
- [x] Zustand 스토어 연동 (`game-store`, `settings-store`)
- [x] 반응형 디자인 (모바일/태블릿/데스크톱)
- [x] 룸 페이지 (`room/[roomId]`) — phase 기반 컴포넌트 전환
- [x] 커스텀 훅 5종 (`useSocket`, `useRoom`, `useGame`, `useTimer`, `usePlayer`)

**주요 기술 결정**:
- 단일 페이지 (`room/[roomId]`): Phase에 따라 컴포넌트 전환
- shadcn/ui: 일관된 디자인 + 접근성 기본 제공
- 타이머: 서버에서 제어, 클라이언트는 표시만 (동기화)

**커밋 이력**:
```
(Phase 3 구현 후 기록)
```

---

## Phase 4: AI 고급 + 테스트

**목표**: Claude API 연동, 테스트 커버리지 80%+

- [x] Claude API 래퍼 (`claude-ai.ts`)
- [x] 프롬프트 템플릿 (`prompts.ts`)
- [x] AI API Routes 5개 (`/api/ai/*`)
- [x] AI 폴백 로직 (Claude 실패 → 로컬 AI)
- [x] 게임 분석 리포트 기능
- [x] 단위 테스트 추가 (커버리지 88.85%)
  - `utils.test.ts` — generateRoomCode, generateId, cn (7 cases)
  - `ai-engine.test.ts` — Claude/로컬 AI 라우팅, 폴백, 딜레이 (13 cases)
- [x] 통합 테스트 (게임 플로우 E2E)
  - `socket-events.test.ts` — 29 Socket.IO 이벤트 케이스
  - `game-flow.test.ts` — 방 생성~결과, 가짜 타이머 페이즈 전환 (18 cases)

**테스트 결과**: 163 tests passed (7 files)

| 지표 | 결과 |
|------|------|
| 전체 테스트 수 | 163 |
| 라인 커버리지 | 88.85% |
| 브랜치 커버리지 | 82.1% |
| 함수 커버리지 | 94% |

**커밋 이력**:
```
test: 단위/통합 테스트 추가, CI/CD 파이프라인 구성
```

---

## Phase 5: 배포

**목표**: IIS 배포, CI/CD 파이프라인

- [x] IIS web.config 작성 (httpPlatformHandler)
- [x] PowerShell 배포 스크립트 (`deploy.ps1`)
- [x] GitHub Actions CI/CD 파이프라인 (`.github/workflows/ci.yml`, Node 18+20 매트릭스)
- [x] 프로덕션 빌드 테스트 (`npm run build` 성공)
- [ ] IIS 배포 테스트
- [ ] README/문서 최종 정리

**커밋 이력**:
```
(Phase 5 구현 후 기록)
```

---

## AI 활용 기록

> Claude Code를 사용한 개발 과정 기록

| 날짜 | 작업 | AI 활용 방식 | 결과 |
|------|------|-------------|------|
| (기록 예정) | 프로젝트 초기화 | Claude Code로 scaffolding | |
| (기록 예정) | 게임 로직 구현 | 순수 함수 + 테스트 생성 | |
| (기록 예정) | UI 컴포넌트 | shadcn/ui 기반 컴포넌트 생성 | |
| (기록 예정) | 테스트 작성 | 테스트 케이스 자동 생성 | |

---

## 문서 ↔ 평가기준 매핑

이 문서가 대응하는 평가 항목:

| 평가 항목 | 배점 | 대응 내용 |
|-----------|------|-----------|
| 개발 진행 기록 | 9점 | Phase별 체크리스트 + 커밋 이력 + 기술 결정 배경 |
| AI 컨텍스트 | 9점 | AI 활용 기록 섹션 |
