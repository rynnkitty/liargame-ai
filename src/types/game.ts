// 게임 단계 (상태 머신 7단계)
export type Phase =
  | 'waiting'
  | 'role_reveal'
  | 'description'
  | 'discussion'
  | 'vote'
  | 'final_defense'
  | 'result';

// 게임 모드
export type GameMode = 'liar' | 'fool'; // liar: 라이어 찾기, fool: 바보 모드

// 플레이어 역할
export type Role = 'citizen' | 'liar';

// AI 레벨
export type AILevel = 'local' | 'claude';

export interface Player {
  id: string;
  name: string;
  isAI: boolean;
  aiLevel?: AILevel;
  isHost: boolean;
  isConnected: boolean;
  role?: Role;           // 게임 시작 후 배정 (본인에게만 노출)
  isReady: boolean;
}

export interface Description {
  playerId: string;
  playerName: string;
  text: string;
  submittedAt: number;   // Date.now()
}

export interface Message {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  isAI: boolean;
  createdAt: number;
}

export interface Vote {
  voterId: string;
  targetId: string;      // 라이어라고 지목한 플레이어 id
}

export interface VoteSummary {
  targetId: string;
  targetName: string;
  count: number;
}

export interface GameSettings {
  mode: GameMode;
  category: string;      // 선택된 카테고리
  keyword?: string;      // 서버에서 선택 (클라이언트에는 역할 확인 후 노출)
  maxPlayers: number;
  descriptionTimerSec: number;   // 기본 60
  discussionTimerSec: number;    // 기본 60
  voteTimerSec: number;          // 기본 30
  finalDefenseTimerSec: number;  // 기본 30
  useAIKeywords: boolean;        // AI가 키워드를 생성할지 여부 (기본 true, API 키 필요)
}

export interface Room {
  id: string;
  code: string;          // 6자리 입장 코드
  hostId: string;
  players: Player[];
  phase: Phase;
  settings: GameSettings;
  turnOrder: string[];   // 설명 순서 (playerId[])
  currentTurnIndex: number;
  descriptions: Description[];
  messages: Message[];
  votes: Vote[];
  liarId?: string;
  keyword?: string;      // 결과 단계에서만 전체 공개
  phaseStartAt?: number; // 현재 단계 시작 시각 (타이머 동기화)
  gameResult?: GameResult;
  createdAt: number;
}

export type WinCondition =
  | 'citizens_win'       // 라이어를 찾았거나, 라이어가 정답을 못 맞춤
  | 'liar_wins'          // 라이어가 지목 안 됨 or 정답을 맞춤
  | 'fool_caught'        // 바보 모드: 바보가 지목됨 → 바보 승
  | 'fool_missed';       // 바보 모드: 바보가 지목 안 됨 → 시민 승

export interface GameResult {
  winCondition: WinCondition;
  liarId: string;
  liarName: string;
  keyword: string;
  voteSummary: VoteSummary[];
  liarGuessedKeyword?: string;   // final_defense에서 라이어가 입력한 단어
  liarGuessCorrect?: boolean;
}
