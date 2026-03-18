# ROADMAP.md — 개발 로드맵

> 5 Phase, 약 8~10일 개발 계획

---

## Phase 1: 기반 구축 (1~2일)

**마일스톤**: 프로젝트 실행 가능, 서버 구동, 타입 시스템 완성

| 태스크 | 산출물 | 우선순위 |
|--------|--------|----------|
| 프로젝트 초기화 | package.json, tsconfig.json | P0 |
| ESLint + Prettier 설정 | .eslintrc.json, .prettierrc | P0 |
| Next.js App Router 기본 구조 | src/app/ | P0 |
| Custom Server | server/index.ts | P0 |
| 타입 정의 | src/types/*.ts | P0 |
| 상수 데이터 | src/constants/*.ts | P0 |

**완료 조건**: `npm run dev` 실행 시 서버 구동 + 홈 페이지 렌더링

---

## Phase 2: 핵심 로직 (2~3일)

**마일스톤**: 게임 로직 완성, Socket.IO 통신, 로컬 AI 동작

| 태스크 | 산출물 | 우선순위 |
|--------|--------|----------|
| 게임 로직 (순수 함수) | lib/game-logic.ts + 테스트 | P0 |
| 방 관리자 | lib/room-manager.ts + 테스트 | P0 |
| Socket.IO 서버 | lib/socket/server.ts | P0 |
| Socket.IO 클라이언트 | lib/socket/client.ts | P0 |
| 로컬 AI 엔진 | lib/ai/local-ai.ts + 테스트 | P0 |
| AI 통합 인터페이스 | lib/ai/ai-engine.ts | P1 |

**완료 조건**: 콘솔에서 Socket.IO로 게임 플로우 테스트 가능

---

## Phase 3: UI 구현 (2~3일)

**마일스톤**: 전체 UI 완성, 실제 게임 플레이 가능

| 태스크 | 산출물 | 우선순위 |
|--------|--------|----------|
| 홈 페이지 | components/home/* | P0 |
| 대기실 | components/lobby/* | P0 |
| 게임 진행 (6개 phase) | components/game/* | P0 |
| 결과 화면 | components/result/* | P0 |
| Zustand 스토어 | store/* | P0 |
| 커스텀 훅 | hooks/* | P0 |
| 반응형 디자인 | TailwindCSS 반응형 | P1 |

**완료 조건**: 브라우저에서 전체 게임 플레이 가능 (AI 포함)

---

## Phase 4: AI 고급 + 테스트 (1~2일)

**마일스톤**: Claude AI 연동, 테스트 커버리지 80%+

| 태스크 | 산출물 | 우선순위 |
|--------|--------|----------|
| Claude API 래퍼 | lib/ai/claude-ai.ts | P1 |
| 프롬프트 템플릿 | lib/ai/prompts.ts | P1 |
| AI API Routes (5개) | app/api/ai/* | P1 |
| 게임 분석 리포트 | AIAnalysis 컴포넌트 | P2 |
| 단위 테스트 보강 | tests/unit/* | P1 |
| 통합 테스트 | tests/integration/* | P1 |

**완료 조건**: Claude API 연결 시 고급 AI 동작 + 테스트 통과

---

## Phase 5: 배포 (1일)

**마일스톤**: IIS 배포 완료, CI/CD 파이프라인 동작

| 태스크 | 산출물 | 우선순위 |
|--------|--------|----------|
| IIS web.config | iis/web.config | P0 |
| 배포 스크립트 | iis/deploy.ps1 | P0 |
| GitHub Actions CI/CD | .github/workflows/ci.yml | P1 |
| 프로덕션 빌드 테스트 | — | P0 |
| 문서 최종 정리 | 전체 문서 | P1 |

**완료 조건**: IIS에서 프로덕션 서버 운영 + CI 파이프라인 그린

---

## 리스크 및 완화 전략

| 리스크 | 확률 | 영향 | 완화 전략 |
|--------|------|------|-----------|
| Socket.IO + IIS 호환 이슈 | 중 | 높음 | httpPlatformHandler + WebSocket 프로토콜 활성화 |
| Claude API 응답 지연 | 중 | 중간 | 5초 타임아웃 + 로컬 AI 폴백 |
| 실시간 동기화 불일치 | 낮음 | 높음 | 서버를 Single Source of Truth로 유지 |
| AI 응답 품질 | 중 | 낮음 | 프롬프트 튜닝 + 로컬 AI 템플릿 다양화 |
