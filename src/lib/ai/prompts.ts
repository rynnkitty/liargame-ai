/**
 * Claude API용 프롬프트 템플릿
 *
 * claude-ai.ts에서 사용됩니다.
 */

export const PROMPTS = {
  describe: {
    citizen: (keyword: string, category: string, prevDescriptions: string[]) => `
당신은 라이어게임의 시민 플레이어입니다.
키워드: "${keyword}" (카테고리: ${category})
이전 설명들: ${prevDescriptions.length > 0 ? prevDescriptions.join(' / ') : '없음'}

규칙:
- 키워드를 직접 말하지 말고 간접적으로 설명하세요.
- 라이어가 유추하기 어렵지만, 시민들은 알 수 있도록 작성하세요.
- 이전 설명과 겹치지 않는 새로운 관점을 사용하세요.
- 한국어로 1~2문장, 15~40자로 작성하세요.

설명:`.trim(),

    liar: (category: string, prevDescriptions: string[]) => `
당신은 라이어게임의 라이어입니다. 키워드를 모릅니다.
카테고리: ${category}
이전 설명들: ${prevDescriptions.length > 0 ? prevDescriptions.join(' / ') : '없음'}

규칙:
- 이전 설명들을 분석해 키워드를 추측하세요.
- 추측을 바탕으로 그럴듯하고 자연스러운 설명을 만드세요.
- 너무 구체적이거나 너무 모호하지 않게 작성하세요.
- 한국어로 1~2문장, 15~40자로 작성하세요.

설명:`.trim(),
  },

  discuss: {
    citizen: (
      keyword: string,
      category: string,
      descriptions: Array<{ playerName: string; text: string }>,
      recentMessages: Array<{ playerName: string; text: string }>,
    ) => `
당신은 라이어게임의 시민 플레이어입니다.
키워드: "${keyword}" (카테고리: ${category})

플레이어 설명 목록:
${descriptions.map((d) => `- ${d.playerName}: "${d.text}"`).join('\n')}

최근 대화:
${recentMessages.slice(-5).map((m) => `${m.playerName}: ${m.text}`).join('\n')}

규칙:
- 라이어를 찾아내기 위해 의심스러운 플레이어를 지목하거나 자신을 변호하세요.
- 자연스럽고 짧은 한 문장으로 말하세요 (30자 이내).
- 특정 플레이어 이름을 언급해도 좋습니다.

발언:`.trim(),

    liar: (
      category: string,
      descriptions: Array<{ playerName: string; text: string }>,
      recentMessages: Array<{ playerName: string; text: string }>,
    ) => `
당신은 라이어게임의 라이어입니다. 키워드를 모릅니다.
카테고리: ${category}

플레이어 설명 목록:
${descriptions.map((d) => `- ${d.playerName}: "${d.text}"`).join('\n')}

최근 대화:
${recentMessages.slice(-5).map((m) => `${m.playerName}: ${m.text}`).join('\n')}

규칙:
- 의심을 피하면서 다른 플레이어에게 의심을 돌리세요.
- 자연스럽고 짧은 한 문장으로 말하세요 (30자 이내).
- 자신이 라이어라는 것을 절대 드러내지 마세요.

발언:`.trim(),
  },

  vote: (
    role: 'citizen' | 'liar',
    keyword: string | undefined,
    category: string,
    descriptions: Array<{ playerId: string; playerName: string; text: string }>,
    candidateNames: string[],
  ) => `
당신은 라이어게임의 ${role === 'citizen' ? '시민' : '라이어'} 플레이어입니다.
${role === 'citizen' ? `키워드: "${keyword}" (카테고리: ${category})` : `카테고리: ${category} (키워드 모름)`}

플레이어 설명 목록:
${descriptions.map((d) => `- ${d.playerName} (id: ${d.playerId}): "${d.text}"`).join('\n')}

투표 가능한 플레이어: ${candidateNames.join(', ')}

${role === 'citizen' ? '가장 라이어처럼 보이는' : '의심을 피하기 위해 가장 먼저 지목할'} 플레이어의 이름 하나만 답하세요.

플레이어 이름:`.trim(),

  finalDefense: (
    category: string,
    descriptions: Array<{ playerName: string; text: string }>,
  ) => `
당신은 라이어게임에서 라이어로 지목된 플레이어입니다.
카테고리: ${category}

모든 플레이어의 설명:
${descriptions.map((d) => `- ${d.playerName}: "${d.text}"`).join('\n')}

규칙:
- 설명들을 분석해 키워드가 무엇인지 추측하세요.
- 추측한 키워드 단어 하나만 답하세요 (예: "피자", "축구", "의사").

추측 키워드:`.trim(),

  analyze: (
    winCondition: string,
    liarName: string,
    keyword: string,
    descriptions: Array<{ playerName: string; text: string }>,
    messages: Array<{ playerName: string; text: string }>,
    liarGuessedKeyword?: string,
  ) => `
라이어게임이 끝났습니다. 게임을 분석해 주세요.

결과:
- 승리 조건: ${winCondition}
- 라이어: ${liarName}
- 실제 키워드: ${keyword}
${liarGuessedKeyword ? `- 라이어가 추측한 키워드: ${liarGuessedKeyword}` : ''}

플레이어 설명:
${descriptions.map((d) => `- ${d.playerName}: "${d.text}"`).join('\n')}

토론 내용:
${messages.slice(0, 20).map((m) => `${m.playerName}: ${m.text}`).join('\n')}

다음 형식으로 분석해 주세요:
1. 게임 총평 (2~3문장)
2. 핵심 장면 3가지 (각 1문장, bullet point)
3. MVP 플레이어 이름과 이유 (1문장)

한국어로 작성하세요.`.trim(),

  keywords: (category: string, count: number) => `
라이어게임에 사용할 "${category}" 카테고리의 키워드 ${count}개를 생성해 주세요.

규칙:
- 한국 사람이라면 누구나 알 수 있는 단어여야 합니다.
- 너무 쉽거나 너무 어렵지 않아야 합니다.
- 각 키워드는 2~6자 사이의 명사여야 합니다.
- 중복 없이 ${count}개를 작성하세요.

키워드를 쉼표로 구분하여 한 줄로 답하세요. 예: "피자, 치킨, 라면"

키워드:`.trim(),

  categoryAndKeywords: (availableCategories: string[], count: number) => `
라이어게임에 사용할 카테고리와 키워드를 추천해 주세요.

선택 가능한 카테고리: ${availableCategories.join(', ')}

규칙:
- 위 카테고리 중 하나를 랜덤으로 선택하세요.
- 선택한 카테고리에서 키워드 ${count}개를 생성하세요.
- 한국 사람이라면 누구나 알 수 있는 2~6자 명사여야 합니다.
- 중복 없이 ${count}개를 작성하세요.

다음 형식으로만 답하세요: 카테고리명|키워드1,키워드2
예: 음식|피자,치킨

답변:`.trim(),
};
