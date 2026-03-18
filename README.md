# 🎭 LiarGame AI

> AI가 실제 플레이어로 참여하는 실시간 멀티플레이어 라이어게임

[![Build](https://github.com/your-org/liargame-ai/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/liargame-ai/actions)
[![Test Coverage](https://img.shields.io/badge/coverage-80%25-green)](.)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 왜 만들었나?

라이어 게임은 최소 4~5명이 필요하다. 2~3명이서는 게임을 시작할 수 없고, 온라인에서는 인원 모으기가 어렵다.

**LiarGame AI**는 AI가 빈자리를 채워서 **2명만으로도 라이어게임을 즐길 수 있게** 한다.

### 핵심 가치

- 🔗 **링크 하나로 시작** — 방 코드 공유만으로 즉시 입장
- 🤖 **AI가 빈자리를 채움** — 버튼 하나로 AI 플레이어 추가
- 🧠 **AI가 게임을 분석** — 종료 후 전략 분석 리포트 제공
- 🔑 **API 키 선택적** — 키 없이도 로컬 AI로 완전 동작

---

## 기술 스택

| 분류 | 기술 |
|------|------|
| 프레임워크 | Next.js 14 (App Router) + TypeScript |
| 스타일링 | TailwindCSS + shadcn/ui + Lucide React |
| 상태 관리 | Zustand |
| 실시간 | Socket.IO (자체 서버) |
| AI (선택) | Claude API (@anthropic-ai/sdk) |
| AI (기본) | 규칙 기반 로컬 AI 엔진 |
| 테스트 | Vitest + React Testing Library |
| 배포 | Windows Server IIS (iisnode) |

---

## 빠른 시작

### 사전 요구사항

- Node.js 18+ (LTS 권장)
- npm 9+
- Git

### 설치 및 실행

```bash
# 1. 레포지토리 클론
git clone https://github.com/your-org/liargame-ai.git
cd liargame-ai

# 2. 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env.local
# .env.local에서 필요한 값 수정

# 4. 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:3000` 접속.

### Claude API 연결 (선택)

1. 홈 화면 우측 상단 ⚙️ 아이콘 클릭
2. Claude API 키 입력
3. 저장 → AI 플레이어가 Claude 기반으로 동작

> API 키 없이도 게임의 모든 기능이 동작합니다. 로컬 규칙 기반 AI가 기본 제공됩니다.

---

## 게임 방법

1. **방 만들기** — 홈에서 닉네임 입력 후 "방 만들기" 클릭
2. **친구 초대** — 방 코드를 공유하거나 링크 전송
3. **AI 추가** — 대기실에서 "AI 플레이어 추가" 버튼 (혼자서도 가능!)
4. **게임 시작** — 최소 3명(사람+AI) 이상이면 시작
5. **설명하기** — 순서대로 키워드를 설명 (라이어는 모르니까 블러핑!)
6. **토론하기** — 누가 라이어인지 토론
7. **투표하기** — 라이어를 지목
8. **결과 확인** — 승패 + AI 분석 리포트

### 게임 모드

| 모드 | 설명 |
|------|------|
| 🕵️ 라이어 모드 | 라이어 1명이 키워드를 모른 채 블러핑. 지목되면 정답 맞히기 역전 기회 |
| 🤡 바보 모드 | 바보 1명이 다른 키워드를 받았지만 모름. 정답 맞히기 없음 |

---

## 프로젝트 구조

```
liargame-ai/
├── src/
│   ├── app/                    # Next.js App Router 페이지
│   │   ├── page.tsx            # 홈
│   │   ├── room/[roomId]/      # 게임 페이지
│   │   └── api/ai/             # AI API Routes
│   ├── components/             # React 컴포넌트
│   │   ├── home/               # 홈 전용
│   │   ├── lobby/              # 대기실 전용
│   │   ├── game/               # 게임 진행 (phase별)
│   │   ├── result/             # 결과 전용
│   │   └── ui/                 # shadcn/ui
│   ├── hooks/                  # 커스텀 훅
│   ├── store/                  # Zustand 스토어
│   ├── lib/                    # 유틸리티
│   │   ├── socket/             # Socket.IO 클라이언트/서버
│   │   ├── ai/                 # AI 엔진 (로컬 + Claude)
│   │   ├── game-logic.ts       # 게임 로직 (순수 함수)
│   │   └── utils.ts            # 유틸
│   ├── types/                  # TypeScript 타입
│   └── constants/              # 상수 (카테고리, 키워드)
├── server/                     # Custom Server (Express + Socket.IO)
│   └── index.ts
├── tests/                      # 테스트
│   ├── unit/                   # 단위 테스트
│   └── integration/            # 통합 테스트
├── .github/workflows/          # CI/CD
├── iis/                        # IIS 배포 설정
├── docs/                       # 프로젝트 문서
├── CLAUDE.md                   # AI 컨텍스트 파일
├── PROGRESS.md                 # 개발 진행 기록
└── ROADMAP.md                  # 개발 로드맵
```

---

## 개발 명령어

```bash
npm run dev          # 개발 서버 (http://localhost:3000)
npm run build        # 프로덕션 빌드
npm run start        # 프로덕션 서버 실행
npm run lint         # ESLint 검사
npm run lint:fix     # ESLint 자동 수정
npm run test         # 테스트 실행
npm run test:watch   # 테스트 워치 모드
npm run test:coverage # 커버리지 리포트
```

---

## 배포

### Windows Server IIS 배포

자세한 배포 가이드는 [MANUAL.md](./docs/MANUAL.md)를 참조하세요.

```bash
# 1. 빌드
npm run build

# 2. IIS 배포 파일 준비
npm run deploy:iis
```

---

## 문서 목록

| 문서 | 설명 |
|------|------|
| [PRD.md](./docs/PRD.md) | 제품 요구사항 정의서 |
| [CLAUDE.md](./CLAUDE.md) | AI 컨텍스트 파일 (Claude Code용) |
| [PROGRESS.md](./PROGRESS.md) | 개발 진행 기록 |
| [ROADMAP.md](./ROADMAP.md) | 개발 로드맵 |
| [MANUAL.md](./docs/MANUAL.md) | 구현 + 배포 매뉴얼 |

---

## 라이선스

MIT License
