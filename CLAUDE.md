# CLAUDE.md — AI 컨텍스트 파일

> 이 파일은 Claude Code가 프로젝트를 이해하고 효과적으로 코드를 작성하기 위한 컨텍스트를 제공합니다.
> **구현 시 이 파일을 먼저 읽고 시작하세요.**

---

## 프로젝트 개요

**LiarGame AI** — AI가 실제 플레이어로 참여하는 실시간 멀티플레이어 라이어게임 웹앱

- **핵심 가치**: 링크 하나로 시작, AI가 빈자리를 채우고, AI가 게임을 분석해준다
- **타겟 사용자**: 온라인으로 파티게임을 즐기는 친구 그룹 (2~6명)
- **차별점**: API 키 없이도 AI가 동작하며, 2명만으로 게임 가능

---

## 기술 스택

| 분류 | 기술 | 버전 | 용도 |
|------|------|------|------|
| 프레임워크 | Next.js (App Router) | 14.x | 풀스택 (SSR + API Routes) |
| 언어 | TypeScript | 5.x | strict 모드 |
| UI | React | 18.x | 컴포넌트 |
| 스타일링 | TailwindCSS | 3.x | 유틸리티 CSS |
| UI 컴포넌트 | shadcn/ui | latest | 디자인 시스템 |
| 아이콘 | Lucide React | latest | 아이콘 |
| 상태 관리 | Zustand | 4.x | 클라이언트 상태 |
| 실시간 | Socket.IO | 4.x | 양방향 통신 |
| 서버 | Express | 4.x | Custom Server (Socket.IO 통합) |
| AI (선택) | @anthropic-ai/sdk | latest | Claude API |
| 입력 검증 | Zod | 3.x | 스키마 검증 |
| 테스트 | Vitest | 1.x | 단위/통합 테스트 |
| 테스트 | @testing-library/react | latest | 컴포넌트 테스트 |
| 린트 | ESLint + Prettier | latest | 코드 품질 |
| 패키지 | npm | 9+ | 의존성 관리 |

---

## 아키텍처

### Custom Server 풀스택 구조

```
[브라우저] ←→ [Express + Socket.IO + Next.js Handler]
                    │
                    ├── Socket.IO: 실시간 게임 이벤트
                    ├── Next.js: SSR 페이지 렌더링
                    └── API Routes: AI 엔드포인트 (/api/ai/*)
```

- **단일 프로세스**: Express 서버가 Socket.IO와 Next.js를 모두 호스팅
- **IIS 호환**: httpPlatformHandler로 Express 프로세스를 IIS 뒤에 배치
- **API 키 보호**: Claude API 호출은 서버사이드 API Routes에서만 실행

### 게임 상태 관리 전략

```
[서버 메모리]                    [클라이언트]
   Room Map ──Socket.IO──→ Zustand Store
   (신뢰할 수 있는 소스)          (UI 렌더링용)
```

- **서버**: 게임 상태의 단일 진실 소스 (Single Source of Truth)
- **클라이언트**: Zustand로 UI 상태 관리, Socket.IO 이벤트로 동기화
- **AI 플레이어**: 서버에서 직접 실행 (Socket.IO 불필요)

### 게임 상태 머신 (7단계)

```
waiting → role_reveal → description → discussion → vote → [final_defense] → result
```

상태 전이 조건:
- `waiting → role_reveal`: 호스트가 시작 + 최소 3명
- `role_reveal → description`: 타이머 10초 만료
- `description → discussion`: 모든 플레이어 설명 완료
- `discussion → vote`: 타이머 만료
- `vote → final_defense`: 라이어 모드에서 라이어 지목 성공 시
- `vote → result`: 바보 모드이거나, 라이어 미지목 시
- `final_defense → result`: 정답 입력 또는 타이머 만료

---

## 디렉토리 구조

```
liargame-ai/
├── server/
│   └── index.ts                # Express + Socket.IO + Next.js Custom Server
│
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # 루트 레이아웃
│   │   ├── page.tsx            # 홈 (방 생성/입장)
│   │   ├── room/
│   │   │   └── [roomId]/
│   │   │       └── page.tsx    # 대기실/게임/결과 통합 페이지
│   │   └── api/
│   │       └── ai/
│   │           ├── describe/route.ts   # AI 설명 생성
│   │           ├── discuss/route.ts    # AI 토론 메시지
│   │           ├── vote/route.ts       # AI 투표
│   │           ├── analyze/route.ts    # 게임 분석
│   │           └── keywords/route.ts   # 키워드 생성
│   │
│   ├── components/
│   │   ├── home/
│   │   │   ├── CreateRoomForm.tsx      # 방 생성 폼
│   │   │   ├── JoinRoomForm.tsx        # 방 입장 폼
│   │   │   └── ApiKeySettings.tsx      # API 키 설정 모달
│   │   ├── lobby/
│   │   │   ├── PlayerList.tsx          # 플레이어 목록
│   │   │   ├── AddAIButton.tsx         # AI 추가 버튼
│   │   │   ├── GameSettings.tsx        # 게임 설정 패널
│   │   │   └── RoomCodeShare.tsx       # 방 코드 공유
│   │   ├── game/
│   │   │   ├── RoleReveal.tsx          # 역할 확인
│   │   │   ├── DescriptionPhase.tsx    # 설명 단계
│   │   │   ├── DiscussionPhase.tsx     # 토론 단계
│   │   │   ├── VotePhase.tsx           # 투표 단계
│   │   │   ├── FinalDefense.tsx        # 최종 변론
│   │   │   └── Timer.tsx               # 타이머 컴포넌트
│   │   ├── result/
│   │   │   ├── GameResult.tsx          # 결과 화면
│   │   │   └── AIAnalysis.tsx          # AI 분석 리포트
│   │   └── ui/                         # shadcn/ui 컴포넌트
│   │
│   ├── hooks/
│   │   ├── useSocket.ts               # Socket.IO 연결 관리
│   │   ├── useRoom.ts                 # 방 상태 구독
│   │   ├── useGame.ts                 # 게임 액션
│   │   ├── useTimer.ts                # 타이머 동기화
│   │   └── usePlayer.ts              # 현재 플레이어 세션
│   │
│   ├── store/
│   │   ├── game-store.ts              # 게임 상태 (방, 플레이어, phase)
│   │   └── settings-store.ts          # 설정 (API 키, 테마)
│   │
│   ├── lib/
│   │   ├── socket/
│   │   │   ├── client.ts              # Socket.IO 클라이언트 싱글톤
│   │   │   ├── server.ts              # Socket.IO 서버 초기화 + 이벤트 핸들러
│   │   │   └── events.ts              # 이벤트 타입 상수
│   │   ├── ai/
│   │   │   ├── local-ai.ts            # 로컬 규칙 기반 AI (API 키 없이 동작)
│   │   │   ├── claude-ai.ts           # Claude API 래퍼
│   │   │   ├── ai-engine.ts           # AI 통합 인터페이스 (로컬/Claude 자동 선택)
│   │   │   └── prompts.ts             # Claude 프롬프트 템플릿
│   │   ├── game-logic.ts              # 순수 함수: 역할 배정, 승패 판정, 투표 집계
│   │   ├── room-manager.ts            # 방 생성/삭제/조회 (인메모리 Map)
│   │   └── utils.ts                   # 방 코드 생성, 세션 토큰
│   │
│   ├── types/
│   │   ├── game.ts                    # Room, Player, Phase, GameResult 등
│   │   ├── socket-events.ts           # Socket.IO 이벤트 페이로드 타입
│   │   └── ai.ts                      # AI 요청/응답 타입
│   │
│   └── constants/
│       ├── categories.ts              # 카테고리 목록
│       ├── keywords.ts                # 카테고리별 키워드
│       └── ai-templates.ts            # 로컬 AI 응답 템플릿
│
├── tests/
│   ├── unit/
│   │   ├── game-logic.test.ts         # 게임 로직 테스트
│   │   ├── local-ai.test.ts           # 로컬 AI 테스트
│   │   ├── room-manager.test.ts       # 방 관리 테스트
│   │   └── utils.test.ts              # 유틸 테스트
│   └── integration/
│       ├── socket-events.test.ts      # Socket.IO 이벤트 테스트
│       └── game-flow.test.ts          # 전체 게임 플로우 테스트
│
├── iis/
│   ├── web.config                     # IIS httpPlatformHandler 설정
│   └── deploy.ps1                     # PowerShell 배포 스크립트
│
├── .github/
│   └── workflows/
│       └── ci.yml                     # GitHub Actions CI/CD
│
├── .env.example                       # 환경 변수 템플릿
├── next.config.mjs                    # Next.js 설정
├── tailwind.config.ts                 # TailwindCSS 설정
├── tsconfig.json                      # TypeScript 설정
├── vitest.config.ts                   # Vitest 설정
├── .eslintrc.json                     # ESLint 설정
├── .prettierrc                        # Prettier 설정
└── package.json
```

---

## 코드 컨벤션

### 일반

- **TypeScript**: strict 모드 필수
- **린트**: ESLint + Prettier (저장 시 자동 포맷)
- **네이밍**: 컴포넌트 PascalCase, 함수/변수 camelCase, 상수 UPPER_SNAKE_CASE, 타입 PascalCase
- **파일명**: 컴포넌트 `PascalCase.tsx`, 유틸/훅 `kebab-case.ts`

### 컴포넌트 구조

```tsx
'use client'; // 클라이언트 컴포넌트만

import { useState } from 'react';

// props 타입 정의
interface PlayerListProps {
  players: Player[];
  onKick?: (playerId: string) => void;
}

// 컴포넌트: export default
export default function PlayerList({ players, onKick }: PlayerListProps) {
  // 훅 → 핸들러 → JSX
  return ( ... );
}
```

### 상태 관리 패턴

```typescript
// store/game-store.ts
import { create } from 'zustand';

interface GameStore {
  room: Room | null;
  phase: Phase;
  setRoom: (room: Room) => void;
  setPhase: (phase: Phase) => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  room: null,
  phase: 'waiting',
  setRoom: (room) => set({ room }),
  setPhase: (phase) => set({ phase }),
  reset: () => set({ room: null, phase: 'waiting' }),
}));
```

### Socket.IO 이벤트 패턴

```typescript
// 서버에서 이벤트 발행
io.to(roomId).emit('game:phase_change', { phase: 'description', turnOrder });

// 클라이언트에서 구독
socket.on('game:phase_change', (data) => {
  useGameStore.getState().setPhase(data.phase);
});
```

### API Routes 패턴

```typescript
// app/api/ai/describe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  roomId: z.string().uuid(),
  playerId: z.string().uuid(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    // ... 로직
    return NextResponse.json({ description: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### 에러 처리

- API Routes: `{ error: string }` + HTTP 상태 코드
- Socket.IO: `callback({ error: string })` 또는 `socket.emit('error', { message })`
- 컴포넌트: Error Boundary + Toast 알림
- AI 호출: 5초 타임아웃, 실패 시 로컬 AI 폴백

### Git 컨벤션

- **브랜치명**: `feature/lobby-ui`, `fix/vote-logic`, `test/game-flow`
- **커밋 메시지**: 한국어, `<타입>: <요약>` + 이유 설명
- **타입**: `feat` / `fix` / `refactor` / `test` / `docs` / `chore`

---

## AI 시스템 상세

### 2단계 AI 아키텍처

```typescript
// lib/ai/ai-engine.ts
export async function getAIAction(
  type: 'describe' | 'discuss' | 'vote',
  context: AIContext,
  apiKey?: string
): Promise<AIResponse> {
  // API 키가 있으면 Claude AI, 없으면 로컬 AI
  if (apiKey) {
    try {
      return await claudeAI(type, context, apiKey);
    } catch {
      // Claude 실패 시 로컬 폴백
      return localAI(type, context);
    }
  }
  return localAI(type, context);
}
```

### 로컬 AI 전략 (lib/ai/local-ai.ts)

```typescript
// 설명: 역할별 템플릿 + 랜덤 변형
function generateDescription(role: Role, keyword: string, category: string): string {
  if (role === 'citizen') {
    // 키워드의 속성을 간접적으로 설명하는 템플릿에서 선택
    const templates = CITIZEN_TEMPLATES[category];
    return fillTemplate(randomChoice(templates), keyword);
  } else {
    // 범용적이고 애매한 설명 (카테고리 힌트만 활용)
    return randomChoice(LIAR_TEMPLATES[category]);
  }
}

// 투표: 설명 유사도 기반 확률적 투표
function generateVote(descriptions: Description[], players: Player[]): string {
  // 다수 설명과 가장 다른 설명을 한 플레이어에게 높은 투표 확률
  const scores = calculateSimilarityScores(descriptions);
  return weightedRandomChoice(players, scores);
}
```

### Claude AI 프롬프트 (lib/ai/prompts.ts)

```typescript
export const PROMPTS = {
  describe: {
    citizen: (keyword: string, category: string, prevDescriptions: string[]) => `
당신은 라이어게임의 시민 플레이어입니다.
키워드: "${keyword}" (카테고리: ${category})
이전 설명들: ${prevDescriptions.join(', ')}

규칙:
- 키워드를 직접 말하지 말고 간접적으로 설명하세요
- 라이어가 유추할 수 없을 정도로 모호하되, 시민들은 알 수 있게
- 한국어로 1~2문장, 15자~40자
- 이전 설명과 겹치지 않는 새로운 관점으로
`,
    liar: (category: string, prevDescriptions: string[]) => `
당신은 라이어게임의 라이어입니다. 키워드를 모릅니다.
카테고리: ${category}
이전 설명들: ${prevDescriptions.join(', ')}

규칙:
- 이전 설명들을 분석하여 키워드를 추측하세요
- 추측을 바탕으로 그럴듯한 설명을 만드세요
- 한국어로 1~2문장, 15자~40자
`,
  },
  // ... discuss, vote, analyze 프롬프트
};
```

---

## 환경 변수

```env
# .env.local (개발) 또는 .env.production (배포)

# 서버 포트 (IIS에서는 httpPlatformHandler가 자동 할당)
PORT=3000

# Claude API (선택 — 없으면 로컬 AI로 동작)
ANTHROPIC_API_KEY=

# 게임 설정
NEXT_PUBLIC_MAX_PLAYERS=8
NEXT_PUBLIC_MAX_AI_PLAYERS=5
```

---

## 개발 명령어

```bash
npm run dev           # 개발 서버 (ts-node server/index.ts)
npm run build         # Next.js 빌드 + tsc server
npm run start         # 프로덕션 서버 실행
npm run lint          # ESLint 검사
npm run lint:fix      # ESLint 자동 수정
npm run format        # Prettier 포맷
npm run test          # Vitest 실행
npm run test:watch    # Vitest 워치 모드
npm run test:coverage # 커버리지 리포트
npm run deploy:iis    # IIS 배포 파일 준비
```

---

## 구현 우선순위

Claude Code로 구현할 때 이 순서를 따르세요:
### 구현이 완료된 항목들은 PROGRESS.MD 문서에 업데이트.
### Phase 1: 기반 구축 (1~2일)

1. `npm init` + 의존성 설치 + TypeScript/ESLint/Prettier 설정
2. Next.js App Router 기본 구조 생성
3. `server/index.ts` — Express + Socket.IO + Next.js 통합 서버
4. `src/types/` — 전체 타입 정의
5. `src/constants/` — 카테고리/키워드 데이터

### Phase 2: 핵심 로직 (2~3일)

6. `src/lib/game-logic.ts` — 역할 배정, 승패 판정 (순수 함수 + 테스트)
7. `src/lib/room-manager.ts` — 인메모리 방 관리
8. `src/lib/socket/server.ts` — Socket.IO 이벤트 핸들러
9. `src/lib/ai/local-ai.ts` — 로컬 규칙 기반 AI
10. `src/lib/socket/client.ts` — Socket.IO 클라이언트

### Phase 3: UI (2~3일)

11. `src/app/layout.tsx` + `page.tsx` — 홈 페이지
12. `src/components/lobby/` — 대기실 컴포넌트
13. `src/components/game/` — 게임 진행 컴포넌트 (phase별)
14. `src/components/result/` — 결과 컴포넌트
15. `src/hooks/` — Socket.IO 커스텀 훅

### Phase 4: AI 고급 + 테스트 (1~2일)

16. `src/lib/ai/claude-ai.ts` — Claude API 연동
17. `src/app/api/ai/` — AI API Routes
18. 단위 테스트 + 통합 테스트
19. CI/CD 파이프라인

### Phase 5: 배포 (1일)

20. IIS 배포 설정 (web.config, deploy.ps1)
21. 프로덕션 빌드 + 배포 테스트

---

## 주요 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| PRD | `docs/PRD.md` | 제품 요구사항 정의서 |
| README | `README.md` | 프로젝트 소개 + 빠른 시작 |
| 진행 기록 | `PROGRESS.md` | 개발 과정 추적 |
| 로드맵 | `ROADMAP.md` | 단계별 개발 계획 |
| 매뉴얼 | `docs/MANUAL.md` | VSCode + Claude Code + IIS 배포 가이드 |
