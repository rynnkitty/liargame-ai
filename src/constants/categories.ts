export interface Category {
  id: string;
  label: string;         // 한국어 표시명
  emoji: string;
}

export const CATEGORIES: Category[] = [
  { id: 'food',          label: '음식',      emoji: '🍔' },
  { id: 'animal',        label: '동물',      emoji: '🐾' },
  { id: 'job',           label: '직업',      emoji: '💼' },
  { id: 'movie',         label: '영화',      emoji: '🎬' },
  { id: 'country',       label: '나라',      emoji: '🌍' },
  { id: 'sports',        label: '스포츠',    emoji: '⚽' },
  { id: 'instrument',    label: '악기',      emoji: '🎵' },
  { id: 'weather',       label: '계절/날씨', emoji: '🌤️' },
  { id: 'transport',     label: '교통수단',  emoji: '🚗' },
  { id: 'appliance',     label: '가전제품',  emoji: '📺' },
];

/** AI가 카테고리까지 추천하는 특별 옵션 (카테고리 선택 드롭다운에 표시) */
export const AI_SUGGEST_CATEGORY: Category = { id: 'ai_suggest', label: 'AI 추천', emoji: '🤖' };

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [string, ...string[]];

export function getCategoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

/** 한국어 레이블로 카테고리 ID 역조회 */
export function getCategoryIdByLabel(label: string): string | undefined {
  return CATEGORIES.find((c) => c.label === label)?.id;
}
