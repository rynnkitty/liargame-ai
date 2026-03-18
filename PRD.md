# PRD — LiarGame AI

> AI가 실제 플레이어로 참여하는 실시간 멀티플레이어 라이어게임 웹앱

---

## 1. 문제 정의

### 해결하려는 문제

라이어 게임은 최소 4~5명이 필요한 파티게임이다. 하지만 현실에서는:

- 소수 인원(2~3명)으로는 게임 자체가 성립하지 않음
- 기존 온라인 라이어게임은 매칭 대기 시간이 길거나 사람 수 부족으로 게임이 시작되지 않음
- AI가 참여하는 라이어게임은 현재 시장에 존재하지 않음

### 해결 방안

**AI가 빈자리를 채워 2명만으로도 라이어게임을 즐길 수 있는 웹앱**을 만든다.

- 링크 공유만으로 즉시 입장
- AI 플레이어를 추가하여 인원 부족 해결
- API 키 없이도 규칙 기반 AI로 동작 (Claude API 연결 시 고급 AI 전략)
- 게임 종료 후 AI가 분석 리포트 제공 (API 키 연결 시)

---

## 2. 목표

| 목표 | 측정 기준 |
|------|-----------|
| 2명으로 게임 가능 | AI 플레이어 추가로 최소 3명 구성 달성 |
| 즉시 시작 | 방 생성 → 게임 시작까지 30초 이내 |
| 외부 의존 최소화 | Supabase 없이 자체 Socket.IO 서버로 완전 독립 |
| IIS 배포 가능 | Windows Server IIS에서 프로덕션 운영 |
| API 키 선택적 | 키 없이 로컬 AI, 키 있으면 Claude AI |

---

## 3. 타겟 사용자

- **1차**: 온라인으로 파티게임을 즐기는 친구 그룹 (2~6명)
- **2차**: 혼자서 AI와 라이어게임을 연습하고 싶은 사용자
- **3차**: 사내 팀빌딩, 아이스브레이킹 용도

---

## 4. 핵심 기능 명세

### 4.1 방 관리

| 기능 | 설명 |
|------|------|
| 방 생성 | 6자리 코드 생성, 호스트 자동 입장 |
| 방 입장 | 코드 입력 또는 링크로 입장 |
| AI 플레이어 추가 | 호스트가 "AI 추가" 버튼으로 AI 플레이어 생성 (최대 5명) |
| 닉네임 설정 | 입장 시 닉네임 입력 (AI는 자동 생성) |
| 게임 설정 | 모드 선택 (라이어/바보), 타이머 설정, 카테고리 선택 |

### 4.2 게임 모드

#### 라이어 모드 (기본)

1. 라이어 1명에게는 키워드를 알려주지 않음
2. 시민들은 같은 키워드를 받음
3. 순서대로 키워드를 설명 (턴제)
4. 자유 토론
5. 투표로 라이어 지목
6. 라이어 지목 성공 시 → 라이어에게 정답 맞히기 기회
7. 승패 판정

#### 바보 모드

1. 바보 1명에게는 **다른** 키워드를 줌 (본인은 모름)
2. 시민들은 같은 키워드를 받음
3. 순서대로 키워드를 설명 (턴제)
4. 자유 토론
5. 투표로 바보 지목
6. 승패 판정 (정답 맞히기 없음)

### 4.3 게임 상태 머신 (7단계)

```
waiting → role_reveal → description → discussion → vote → [final_defense] → result
```

| Phase | 설명 | 타이머 |
|-------|------|--------|
| `waiting` | 대기실 — 플레이어 입장, 설정, AI 추가 | 없음 |
| `role_reveal` | 역할/키워드 확인 화면 | 10초 |
| `description` | 턴제 설명 입력 | 턴당 30초 |
| `discussion` | 자유 토론 채팅 | 120초 |
| `vote` | 라이어/바보 투표 | 30초 |
| `final_defense` | 라이어 정답 맞히기 (라이어 모드, 지목 성공 시만) | 30초 |
| `result` | 결과 발표 + AI 분석 | 없음 |

### 4.4 AI 플레이어 시스템

#### 2단계 AI 아키텍처

| 레벨 | 조건 | 행동 방식 |
|------|------|-----------|
| **로컬 AI** (기본) | API 키 없음 | 규칙 기반: 키워드 DB에서 랜덤 선택, 템플릿 기반 설명/토론, 확률 기반 투표 |
| **Claude AI** (고급) | API 키 있음 | Claude API: 전략적 설명, 맥락 기반 토론, 분석적 투표, 사후 분석 리포트 |

#### 로컬 AI 상세 (API 키 없이 동작)

- **설명 단계**: 키워드 카테고리 기반 템플릿 풀에서 랜덤 선택 + 변형
  - 시민 AI: 키워드의 특성을 간접적으로 설명하는 10~20개 템플릿
  - 라이어 AI: 범용적이고 애매한 설명 템플릿
- **토론 단계**: 다른 플레이어의 설명을 참조하여 의심/동의 패턴 생성
- **투표 단계**: 설명의 유사도 점수 기반 확률적 투표 (가장 다른 설명을 한 사람에게 투표 확률↑)
- **응답 딜레이**: 2~5초 랜덤 (사람처럼 보이기 위해)

#### Claude AI 상세 (API 키 있을 때)

- `POST /api/ai/describe` — 역할별 전략적 설명 생성
- `POST /api/ai/discuss` — 맥락 기반 토론 메시지
- `POST /api/ai/vote` — 분석 기반 전략적 투표
- `POST /api/ai/analyze` — 게임 종료 후 분석 리포트
- `POST /api/ai/keywords` — 바보 모드 연관 키워드 쌍 생성

### 4.5 실시간 통신

- **Socket.IO** 기반 자체 서버 (외부 서비스 의존 없음)
- 이벤트 목록:

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `room:join` | C→S | 방 입장 |
| `room:leave` | C→S | 방 퇴장 |
| `room:update` | S→C | 방 상태 변경 브로드캐스트 |
| `game:start` | C→S | 게임 시작 (호스트) |
| `game:phase_change` | S→C | 페이즈 전환 |
| `game:describe` | C→S | 설명 제출 |
| `game:message` | C→S | 토론 메시지 |
| `game:vote` | C→S | 투표 |
| `game:final_answer` | C→S | 라이어 정답 |
| `player:update` | S→C | 플레이어 상태 변경 |
| `timer:sync` | S→C | 타이머 동기화 |

---

## 5. 페이지 구성

### 5.1 홈 페이지 (`/`)

- 방 생성 버튼 → 닉네임 입력 → 방 코드 생성 후 대기실로 이동
- 방 입장 폼 → 방 코드 + 닉네임 입력 → 대기실로 이동
- Claude API 키 설정 (선택) → 설정 모달에서 입력, localStorage에 저장

### 5.2 대기실/게임/결과 (`/room/[roomId]`)

- Phase에 따라 UI가 전환되는 단일 페이지
- 대기실: 플레이어 목록, AI 추가 버튼, 게임 설정, 시작 버튼
- 게임: Phase별 컴포넌트 렌더링 (역할확인, 설명, 토론, 투표, 최종변론)
- 결과: 승패 결과, 역할 공개, AI 분석 (API 키 있을 때)

---

## 6. 데이터 모델

### 6.1 서버 인메모리 (Socket.IO 서버)

```typescript
interface Room {
  id: string;                  // UUID
  roomCode: string;            // 6자리 입장 코드
  hostId: string;              // 호스트 플레이어 ID
  mode: 'liar' | 'fool';      // 게임 모드
  phase: Phase;                // 현재 게임 단계
  category: string;            // 키워드 카테고리
  keyword: string;             // 시민 키워드
  foolKeyword?: string;        // 바보 키워드 (바보 모드)
  liarId?: string;             // 라이어/바보 플레이어 ID
  turnOrder: string[];         // 설명 순서 (플레이어 ID 배열)
  currentTurn: number;         // 현재 턴 인덱스
  timerDuration: number;       // 타이머 설정 (초)
  players: Map<string, Player>;
  descriptions: Description[];
  messages: Message[];
  votes: Vote[];
  result?: GameResult;
  createdAt: Date;
}

interface Player {
  id: string;                  // UUID
  nickname: string;
  isAI: boolean;
  isHost: boolean;
  role?: 'citizen' | 'liar' | 'fool';
  isConnected: boolean;
  sessionToken: string;
}

interface Description {
  playerId: string;
  content: string;
  turnNumber: number;
  createdAt: Date;
}

interface Message {
  playerId: string;
  content: string;
  createdAt: Date;
}

interface Vote {
  voterId: string;
  targetId: string;
}

interface GameResult {
  winner: 'citizen' | 'liar' | 'fool';
  liarId: string;
  liarGuess?: string;
  liarGuessCorrect?: boolean;
  voteResults: { targetId: string; count: number }[];
  analysis?: AIAnalysis;       // Claude API 사용 시
}
```

### 6.2 영속 데이터 (SQLite — 선택적)

게임 기록 저장을 위한 SQLite DB (better-sqlite3). 없어도 게임은 동작함.

---

## 7. 기술 스택

| 분류 | 기술 | 선택 이유 |
|------|------|-----------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript | 풀스택 단일 프로젝트, SSR, API Routes |
| 스타일링 | TailwindCSS + shadcn/ui + Lucide React | 빠른 UI 개발, 일관된 디자인 시스템 |
| 상태 관리 | Zustand | 간결한 클라이언트 상태 관리 |
| 실시간 | Socket.IO | 자체 호스팅 가능, IIS 호환, 외부 의존 없음 |
| 서버 | Custom Server (Express + Socket.IO) | IIS 배포를 위한 httpPlatformHandler 호환 |
| AI (선택) | Claude API (@anthropic-ai/sdk) | 고급 AI 전략, 사후 분석 |
| AI (기본) | 규칙 기반 로컬 엔진 | API 키 없이 동작하는 폴백 AI |
| 테스트 | Vitest + Testing Library | 단위/통합 테스트 |
| CI/CD | GitHub Actions | 자동 빌드/테스트/배포 |
| 배포 | Windows Server IIS + iisnode | 사내 서버 배포 |

---

## 8. 비기능 요구사항

| 항목 | 기준 |
|------|------|
| 동시 접속 | 방당 최대 8명 (사람 + AI) |
| 응답 속도 | Socket.IO 이벤트 100ms 이내 |
| 브라우저 호환 | Chrome, Edge, Safari, Firefox 최신 2버전 |
| 반응형 | 모바일 (360px~), 태블릿, 데스크톱 |
| 접근성 | 키보드 네비게이션, 적절한 ARIA 레이블 |

---

## 9. 제약 사항

- Supabase/Firebase 등 외부 실시간 서비스 사용하지 않음 (자체 Socket.IO)
- Claude API 키는 선택적 — 없으면 로컬 AI로 폴백
- SQLite는 게임 기록 저장용 선택 사항 — 없어도 핵심 기능 동작
- IIS 배포를 고려하여 Next.js Custom Server 사용

---

## 문서 ↔ 평가기준 매핑

| 평가 항목 | 배점 | 대응 문서 |
|-----------|------|-----------|
| 프로젝트 정의 | 12점 | 이 문서 (PRD.md) + README.md |
| AI 컨텍스트 | 9점 | CLAUDE.md |
| 개발 진행 기록 | 9점 | PROGRESS.md + Git 커밋 이력 |
| 아키텍처 | 12점 | CLAUDE.md 아키텍처 섹션 |
| 코드 품질 | 10점 | CLAUDE.md 코드 컨벤션 + ESLint/Prettier |
| 기술 스택 | 8점 | 이 문서 7절 기술 스택 |
| 완성도 | 8점 | 구현 코드 |
| 사용자 경험 | 5점 | 구현 코드 + 이 문서 5절 |
| 반응형 | 2점 | TailwindCSS 반응형 |
| 문제 정의 | 4점 | 이 문서 1절 |
| 차별화 | 6점 | 이 문서 1절 차별점 |
| 테스트 전략 | 8점 | 이 문서 + test/ 디렉토리 |
| CI/CD | 7점 | .github/workflows/ |
