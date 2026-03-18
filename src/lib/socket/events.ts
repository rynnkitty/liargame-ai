// ── Client → Server ──────────────────────────────────────────────────────────
export const ROOM_CREATE = 'room:create' as const;
export const ROOM_JOIN = 'room:join' as const;
export const ROOM_LEAVE = 'room:leave' as const;
export const ROOM_START = 'room:start' as const;
export const ROOM_ADD_AI = 'room:add_ai' as const;
export const ROOM_REMOVE_PLAYER = 'room:remove_player' as const;
export const ROOM_UPDATE_SETTINGS = 'room:update_settings' as const;
export const ROOM_PLAY_AGAIN = 'room:play_again' as const;

export const GAME_SUBMIT_DESCRIPTION = 'game:submit_description' as const;
export const GAME_SEND_MESSAGE = 'game:send_message' as const;
export const GAME_SUBMIT_VOTE = 'game:submit_vote' as const;
export const GAME_SUBMIT_FINAL_DEFENSE = 'game:submit_final_defense' as const;

export const TIMER_SYNC = 'timer:sync' as const;

// ── Server → Client ──────────────────────────────────────────────────────────
export const ROOM_UPDATED = 'room:updated' as const;
export const ROOM_PLAYER_JOINED = 'room:player_joined' as const;
export const ROOM_PLAYER_LEFT = 'room:player_left' as const;

export const GAME_PHASE_CHANGE = 'game:phase_change' as const;
export const GAME_ROLE_ASSIGNED = 'game:role_assigned' as const;
export const GAME_DESCRIPTION_SUBMITTED = 'game:description_submitted' as const;
export const GAME_YOUR_TURN = 'game:your_turn' as const;
export const GAME_MESSAGE_RECEIVED = 'game:message_received' as const;
export const GAME_VOTE_SUBMITTED = 'game:vote_submitted' as const;
export const GAME_VOTE_RESULT = 'game:vote_result' as const;
export const GAME_FINAL_DEFENSE_SUBMITTED = 'game:final_defense_submitted' as const;
export const GAME_RESULT = 'game:result' as const;

export const SOCKET_ERROR = 'error' as const;
export const NOTIFICATION = 'notification' as const;
