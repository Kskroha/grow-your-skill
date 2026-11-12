export const PRACTICE_TOOLS = ['FLASHCARDS', 'TEST', 'WRITE', 'SPEAK', 'YES_NO'] as const
export type PracticeTool = (typeof PRACTICE_TOOLS)[number]

export const TOOL_LABELS: Record<PracticeTool, string> = {
  FLASHCARDS: 'Карточки',
  TEST: 'Тест',
  WRITE: 'Напиши слово',
  SPEAK: 'Скажи слово',
  YES_NO: '네 / 아니요',
}

export type VocabWord = { ko: string; ru: string; roman?: string }

export type PackPayload = {
  words: VocabWord[]
  tools: PracticeTool[]
  activities: {
    FLASHCARDS?: { cards: Array<{ front: string; back?: string; hint?: string }> }
    TEST?: {
      items: Array<{
        prompt: string
        options: Array<{ id: string; text: string; correct?: boolean }>
      }>
    }
    WRITE?: { items: Array<{ prompt: string; answer: string }> }
    SPEAK?: { items: Array<{ prompt: string; answer: string }> }
    YES_NO?: { items: Array<{ ko: string; ru: string; correct: boolean }> }
  }
}

export function isPracticeTool(value: string): value is PracticeTool {
  return (PRACTICE_TOOLS as readonly string[]).includes(value)
}

export function parseWords(value: unknown): VocabWord[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const ko = String(row.ko ?? '').trim()
      const ru = String(row.ru ?? '').trim()
      if (!ko || !ru) return null
      const roman = String(row.roman ?? '').trim()
      return roman ? { ko, ru, roman } : { ko, ru }
    })
    .filter((item): item is VocabWord => Boolean(item))
}

export function parseTools(value: unknown): PracticeTool[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(String).filter(isPracticeTool))]
}

function shuffle<T>(items: T[]) {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swap]] = [next[swap], next[index]]
  }
  return next
}

export function buildPackPayload(words: VocabWord[], tools: PracticeTool[]): PackPayload {
  const activities: PackPayload['activities'] = {}
  if (tools.includes('FLASHCARDS')) {
    activities.FLASHCARDS = {
      cards: words.map((word) => ({
        front: word.ko,
        back: word.ru,
        hint: word.roman,
      })),
    }
  }
  if (tools.includes('TEST')) {
    activities.TEST = {
      items: words.map((word, index) => {
        const others = words.filter((_, other) => other !== index).map((item) => item.ru)
        const distractors = shuffle(others).slice(0, 2)
        const options = shuffle([word.ru, ...distractors]).map((text, optionIndex) => ({
          id: String.fromCharCode(97 + optionIndex),
          text,
          correct: text === word.ru,
        }))
        return { prompt: word.ko, options }
      }),
    }
  }
  if (tools.includes('WRITE')) {
    activities.WRITE = {
      items: words.map((word) => ({ prompt: word.ru, answer: word.ko })),
    }
  }
  if (tools.includes('SPEAK')) {
    activities.SPEAK = {
      items: words.map((word) => ({ prompt: word.ru, answer: word.ko })),
    }
  }
  if (tools.includes('YES_NO')) {
    activities.YES_NO = {
      items: shuffle(
        words.map((word, index) => {
          const wrong = words[(index + 1) % words.length]
          const correct = words.length < 2 || index % 2 === 0
          return {
            ko: word.ko,
            ru: correct ? word.ru : wrong.ru,
            correct,
          }
        }),
      ),
    }
  }
  return { words, tools, activities }
}

export function packActivityCount(payload: PackPayload, tool: PracticeTool) {
  const activity = payload.activities[tool]
  if (!activity) return 0
  if ('cards' in activity) return activity.cards.length
  if ('items' in activity) return activity.items.length
  return 0
}

export function packTotalCount(payload: PackPayload) {
  return payload.tools.reduce((sum, tool) => sum + packActivityCount(payload, tool), 0)
}

type ToolProgress = {
  done?: boolean
  marked?: boolean[]
  feedback?: Array<unknown | null>
}

export function packProgressPercent(payload: PackPayload, progress: unknown) {
  const total = packTotalCount(payload)
  if (!total) return 0
  const tools =
    progress && typeof progress === 'object' && !Array.isArray(progress)
      ? ((progress as { tools?: Record<string, ToolProgress> }).tools ?? {})
      : {}
  let done = 0
  for (const tool of payload.tools) {
    const saved = tools[tool] ?? {}
    done += (saved.feedback ?? saved.marked ?? []).filter(Boolean).length
  }
  return Math.round((Math.min(done, total) / total) * 100)
}

export function packToolSummaries(payload: PackPayload, progress: unknown) {
  const tools =
    progress && typeof progress === 'object' && !Array.isArray(progress)
      ? ((progress as { tools?: Record<string, ToolProgress> }).tools ?? {})
      : {}
  return payload.tools.map((tool) => {
    const saved = tools[tool] ?? {}
    const total = packActivityCount(payload, tool)
    const answered = (saved.feedback ?? saved.marked ?? []).filter(Boolean).length
    return {
      key: tool,
      label: TOOL_LABELS[tool],
      done: Boolean(saved.done) || (total > 0 && answered >= total),
      percent: total ? Math.round((Math.min(answered, total) / total) * 100) : 0,
    }
  })
}

export function stripPackSolutions(payload: PackPayload): PackPayload {
  return {
    words: payload.words.map((word) => ({ ko: word.ko, ru: word.ru, roman: word.roman })),
    tools: payload.tools,
    activities: {
      FLASHCARDS: payload.activities.FLASHCARDS
        ? {
            cards: payload.activities.FLASHCARDS.cards.map((card) => ({
              front: card.front,
              back: card.back,
              hint: card.hint,
            })),
          }
        : undefined,
      TEST: payload.activities.TEST
        ? {
            items: payload.activities.TEST.items.map((item) => ({
              prompt: item.prompt,
              options: item.options.map((option) => ({ id: option.id, text: option.text })),
            })),
          }
        : undefined,
      WRITE: payload.activities.WRITE
        ? { items: payload.activities.WRITE.items.map((item) => ({ prompt: item.prompt, answer: '' })) }
        : undefined,
      SPEAK: payload.activities.SPEAK
        ? { items: payload.activities.SPEAK.items.map((item) => ({ prompt: item.prompt, answer: '' })) }
        : undefined,
      YES_NO: payload.activities.YES_NO
        ? {
            items: payload.activities.YES_NO.items.map((item) => ({
              ko: item.ko,
              ru: item.ru,
              correct: false,
            })),
          }
        : undefined,
    },
  }
}

export function asPackPayload(value: unknown): PackPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const data = value as PackPayload
  if (!Array.isArray(data.tools) || !data.activities) return null
  return data
}
