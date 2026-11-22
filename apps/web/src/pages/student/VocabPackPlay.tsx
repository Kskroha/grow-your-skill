import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api.ts'
import { Button, ResultChip, ResultNav } from '../../components/ui.tsx'
import { hasKoreanSpeech, startKoreanSpeech } from '../../speech.ts'
import type { Assignment, PlayProgress, PracticeTool } from '../../types.ts'

type Feedback = { correct: boolean; expected: string; expectedId?: string }

const labels: Record<PracticeTool, string> = {
  FLASHCARDS: '단어 카드',
  TEST: '테스트',
  WRITE: '단어 쓰기',
  SPEAK: '말하기',
  YES_NO: '네 / 아니요',
}

const TOOL_ORDER: PracticeTool[] = ['FLASHCARDS', 'YES_NO', 'TEST', 'WRITE', 'SPEAK']
const PASS_RATIO = 0.85

function range(count: number) {
  return Array.from({ length: count }, (_, index) => index)
}

function optionTextClass(texts: string[]) {
  const longest = Math.max(0, ...texts.map((text) => text.trim().length))
  if (longest > 22) return 'text-[16px] sm:text-[16px]'
  if (longest > 14) return 'text-[18px] sm:text-[17px]'
  if (longest > 8) return 'text-[22px] sm:text-[20px]'
  return 'text-[26px] sm:text-[20px]'
}

function isAnswered(tool: PracticeTool, state: PlayProgress, index: number) {
  if (tool === 'FLASHCARDS') return Boolean(state.known?.[index])
  return Boolean(state.feedback?.[index])
}

function isCorrect(tool: PracticeTool, state: PlayProgress, index: number) {
  if (tool === 'FLASHCARDS') return Boolean(state.known?.[index])
  return Boolean(state.feedback?.[index]?.correct)
}

function toolStats(tool: PracticeTool, state: PlayProgress, total: number) {
  const answered = range(total).filter((index) => isAnswered(tool, state, index)).length
  const correct = range(total).filter((index) => isCorrect(tool, state, index)).length
  const finished = total > 0 && answered >= total
  const cleared = finished && correct === total
  return {
    answered,
    correct,
    total,
    finished,
    passed: cleared,
    needsRetry: !cleared && (finished || Boolean(state.retry)) && correct < total,
  }
}

function wrongIndices(tool: PracticeTool, state: PlayProgress, total: number) {
  return range(total).filter((index) => !isCorrect(tool, state, index))
}

function activeQueue(state: PlayProgress, total: number) {
  return state.queue?.length ? state.queue : range(total)
}

function remainingFlashQueue(state: PlayProgress, total: number) {
  const unknown = range(total).filter((index) => !state.known?.[index])
  if (!state.queue?.length) return unknown
  const kept = state.queue.filter((index) => unknown.includes(index))
  const missing = unknown.filter((index) => !kept.includes(index))
  return [...kept, ...missing]
}

function postponeCard(queue: number[], card: number, later = 3) {
  const rest = queue.filter((index) => index !== card)
  const at = Math.min(later, rest.length)
  return [...rest.slice(0, at), card, ...rest.slice(at)]
}

function resetWrong(tool: PracticeTool, state: PlayProgress, wrong: number[]): PlayProgress {
  const next: PlayProgress = {
    ...state,
    retry: true,
    queue: wrong,
    step: wrong[0] ?? 0,
    done: false,
  }
  if (tool === 'FLASHCARDS') {
    next.marked = [...(state.marked ?? [])]
    next.known = [...(state.known ?? [])]
    for (const index of wrong) {
      next.marked[index] = false
      next.known[index] = false
    }
    return next
  }
  next.feedback = [...(state.feedback ?? [])]
  next.selected = [...(state.selected ?? [])]
  next.texts = [...(state.texts ?? [])]
  next.heard = [...(state.heard ?? [])]
  next.answers = [...(state.answers ?? [])]
  for (const index of wrong) {
    next.feedback[index] = null
    next.selected[index] = ''
    next.texts[index] = ''
    next.heard[index] = ''
  }
  return next
}

function emptyTool(count: number): PlayProgress {
  return {
    step: 0,
    selected: Array(count).fill(''),
    texts: Array(count).fill(''),
    heard: Array(count).fill(''),
    known: Array(count).fill(false),
    marked: Array(count).fill(false),
    answers: Array(count).fill(false),
    feedback: Array(count).fill(null),
    done: false,
  }
}

export function VocabPackPlay({ assignment }: { assignment: Assignment }) {
  const navigate = useNavigate()
  const pack = assignment.exercise.payload
  const tools = TOOL_ORDER.filter((tool) => ((pack.tools ?? []) as PracticeTool[]).includes(tool))
  const [progress, setProgress] = useState<PlayProgress>(
    assignment.status === 'COMPLETED'
      ? { tools: {} }
      : { currentTool: assignment.progress?.currentTool ?? null, tools: assignment.progress?.tools ?? {} },
  )
  const [flipped, setFlipped] = useState(false)
  const [pending, setPending] = useState(false)
  const [listening, setListening] = useState(false)
  const [liveHeard, setLiveHeard] = useState('')
  const [error, setError] = useState('')
  const [leaving, setLeaving] = useState(false)
  const persistable = assignment.status !== 'COMPLETED'
  const snapshot = useRef(progress)
  snapshot.current = progress
  const currentTool = progress.currentTool ?? null
  const speakStep = progress.tools?.SPEAK?.step ?? 0
  useEffect(() => {
    setLiveHeard('')
  }, [currentTool, speakStep])

  function countFor(tool: PracticeTool) {
    const activity = pack.activities?.[tool]
    if (!activity) return 0
    if ('cards' in activity && activity.cards) return activity.cards.length
    if ('items' in activity && activity.items) return activity.items.length
    return 0
  }

  function toolState(tool: PracticeTool): PlayProgress {
    return { ...emptyTool(countFor(tool)), ...(progress.tools?.[tool] ?? {}) }
  }

  async function persist(next: PlayProgress) {
    if (!persistable) return
    await api(`/assignments/${assignment.id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ progress: next }),
    })
  }

  function update(next: PlayProgress) {
    setProgress(next)
    snapshot.current = next
    void persist(next)
  }

  async function exit() {
    setLeaving(true)
    try {
      await persist(snapshot.current)
    } catch {
      /* keep going */
    }
    navigate('/student')
  }

  async function check(tool: PracticeTool, index: number, payload: Record<string, unknown>) {
    setPending(true)
    setError('')
    try {
      const result = await api<Feedback>(`/assignments/${assignment.id}/check`, {
        method: 'POST',
        body: JSON.stringify({ tool, index, ...payload }),
      })
      const current = toolState(tool)
      const count = countFor(tool)
      const feedback = Array.from({ length: count }, (_, item) => current.feedback?.[item] ?? null)
      feedback[index] = result
      const nextState = { ...current, feedback, step: index }
      const stats = toolStats(tool, nextState, count)
      update({
        ...progress,
        currentTool: tool,
        tools: {
          ...progress.tools,
          [tool]: { ...nextState, done: stats.passed },
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось проверить')
    } finally {
      setPending(false)
    }
  }

  function openTool(tool: PracticeTool) {
    const count = countFor(tool)
    let state = toolState(tool)
    if (tool === 'FLASHCARDS') {
      const queue = remainingFlashQueue(state, count)
      state = { ...state, queue, step: queue[0] ?? 0, done: queue.length === 0, retry: queue.length > 0 && queue.length < count }
    } else {
      const wrong = wrongIndices(tool, state, count)
      const unansweredWrong = wrong.filter((index) => !isAnswered(tool, state, index))
      if (wrong.length > 0 && (state.retry || toolStats(tool, state, count).finished)) {
        if (unansweredWrong.length > 0) {
          state = { ...state, retry: true, queue: unansweredWrong, step: unansweredWrong[0], done: false }
        } else {
          state = resetWrong(tool, state, wrong)
        }
      }
    }
    update({ ...progress, currentTool: tool, tools: { ...progress.tools, [tool]: state } })
  }

  async function finishPack() {
    const overall = tools.reduce(
      (sum, tool) => {
        const stats = toolStats(tool, toolState(tool), countFor(tool))
        return {
          correct: sum.correct + stats.correct,
          total: sum.total + stats.total,
          passed: sum.passed && stats.passed,
        }
      },
      { correct: 0, total: 0, passed: true },
    )
    if (!overall.passed || (overall.total > 0 && overall.correct / overall.total < PASS_RATIO)) {
      setError('Чтобы завершить тему, нужно 85% верных ответов. Повторите упражнения с ошибками.')
      return
    }
    setPending(true)
    try {
      const answers = {
        tools: Object.fromEntries(
          tools.map((tool) => {
            const state = toolState(tool)
            return [
              tool,
              {
                selected: state.selected,
                texts: state.texts,
                heard: state.heard,
                known: state.known,
                marked: state.marked,
                answers: state.answers,
              },
            ]
          }),
        ),
      }
      await api(`/assignments/${assignment.id}/attempts`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      })
      navigate('/student')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить')
    } finally {
      setPending(false)
    }
  }

  function listen(tool: PracticeTool, index: number) {
    setListening(true)
    setLiveHeard('')
    setError('')
    const started = startKoreanSpeech({
      onCaption: (text, isFinal) => {
        setLiveHeard(text)
        if (!isFinal) return
        const current = toolState(tool)
        const nextHeard = [...(current.heard ?? [])]
        nextHeard[index] = text
        update({
          ...snapshot.current,
          currentTool: tool,
          tools: { ...snapshot.current.tools, [tool]: { ...current, heard: nextHeard, step: index } },
        })
        void check(tool, index, { heard: text })
      },
      onError: (code) => {
        const messages: Record<string, string> = {
          'not-allowed': 'Нет доступа к микрофону. Можно сказать в микрофон корейской клавиатуры в поле ниже.',
          'no-speech': 'Ничего не услышали. Скажите ещё раз или напишите хангыль в поле.',
          'audio-capture': 'Микрофон браузера недоступен. Используйте микрофон корейской клавиатуры.',
          network: 'Голос браузера недоступен без сети. Напишите слово или продиктуйте с клавиатуры.',
          'language-not-supported': 'Браузер не даёт корейскую диктовку. Откройте корейскую клавиатуру и скажите в её микрофон.',
        }
        setError(messages[code] ?? 'Не получилось распознать. Напишите слово или скажите в микрофон корейской клавиатуры.')
      },
      onEnd: () => setListening(false),
    })
    if (!started) {
      setListening(false)
      window.requestAnimationFrame(() => {
        document.getElementById('speak-heard')?.focus()
      })
    }
  }

  const summaries = tools.map((tool) => {
    const stats = toolStats(tool, toolState(tool), countFor(tool))
    return {
      tool,
      label: labels[tool],
      done: stats.passed,
      needsRetry: stats.needsRetry,
      percent: stats.total ? Math.round((stats.correct / stats.total) * 100) : 0,
    }
  })
  const allDone = summaries.length > 0 && summaries.every((item) => item.done)
  const packWords = (pack.words ?? []) as Array<{ ko: string; ru: string }>

  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex items-center gap-2 border-b border-line bg-paper px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
        <Button tone="ghost" onClick={() => void exit()} disabled={leaving}>
          {leaving ? 'Выхожу…' : 'Выйти'}
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-semibold sm:text-[16px]">
          {assignment.exercise.topic?.title ?? assignment.exercise.title}
        </h1>
        {currentTool ? (
          <button
            type="button"
            className="shrink-0 text-[13px] font-medium text-ink-soft hover:text-ink"
            onClick={() => update({ ...progress, currentTool: null })}
          >
            Все упражнения
          </button>
        ) : null}
      </div>

      <div
        className={
          currentTool
            ? 'flex min-h-0 flex-1 flex-col px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:overflow-auto sm:px-5 sm:py-5 lg:p-8'
            : 'flex-1 overflow-auto px-4 py-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-5 lg:p-8'
        }
      >
        <div
          className={`mx-auto w-full max-w-lg ${
            currentTool ? 'flex min-h-0 flex-1 flex-col sm:block sm:flex-none' : ''
          }`}
        >
          {!currentTool ? (
            <div>
              <p className="mb-3 text-[13px] font-medium text-ink">Список упражнений</p>
              <div className="space-y-2">
                {summaries.map((item) => (
                  <button
                    key={item.tool}
                    type="button"
                    onClick={() => openTool(item.tool)}
                    className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left hover:bg-blush sm:min-h-14"
                  >
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-[14px] ${
                        item.done
                          ? 'bg-mint text-white'
                          : item.needsRetry
                            ? 'bg-amber-200 text-amber-900'
                            : 'text-ink-soft'
                      }`}
                    >
                      {item.done ? '✓' : item.needsRetry ? '!' : '○'}
                    </span>
                    <span className="hangul flex-1 text-[18px] font-semibold sm:text-[16px]">
                      {item.label}
                      {item.needsRetry ? ' · 다시' : ''}
                    </span>
                    <span
                      className={`text-[12px] ${
                        item.done ? 'text-mint' : item.needsRetry ? 'text-amber-700' : 'text-ink-soft'
                      }`}
                    >
                      {item.percent}%
                    </span>
                  </button>
                ))}
              </div>
              {allDone ? (
                <Button className="mt-5" onClick={() => void finishPack()} disabled={pending}>
                  {pending ? 'Сохраняю…' : 'Завершить тему'}
                </Button>
              ) : null}
              {packWords.length > 0 ? (
                <div className="mt-6 border-t border-line pt-4">
                  <p className="mb-2 text-[12px] font-medium text-ink-soft">Слова · {packWords.length}</p>
                  <ul className="space-y-1.5">
                    {packWords.map((word) => (
                      <li
                        key={word.ko}
                        className="flex items-baseline gap-2 text-[13px] leading-snug sm:text-[12px]"
                      >
                        <span className="hangul shrink-0 font-medium text-ink">{word.ko}</span>
                        <span className="min-w-0 text-ink-soft">{word.ru}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <ToolPlayer
              assignment={assignment}
              tool={currentTool}
              state={toolState(currentTool)}
              flipped={flipped}
              pending={pending}
              listening={listening}
              liveHeard={liveHeard}
              onFlip={() => setFlipped((value) => !value)}
              onState={(next) => {
                if (next.done) setFlipped(false)
                update({
                  ...progress,
                  currentTool: next.done ? null : currentTool,
                  tools: { ...progress.tools, [currentTool]: next },
                })
              }}
              onCheck={(index, payload) => void check(currentTool, index, payload)}
              onListen={(index) => listen(currentTool, index)}
            />
          )}
          {error ? <p className="mt-4 text-seal">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}

function ToolPlayer({
  assignment,
  tool,
  state,
  flipped,
  pending,
  listening,
  liveHeard,
  onFlip,
  onState,
  onCheck,
  onListen,
}: {
  assignment: Assignment
  tool: PracticeTool
  state: PlayProgress
  flipped: boolean
  pending: boolean
  listening: boolean
  liveHeard: string
  onFlip: () => void
  onState: (next: PlayProgress) => void
  onCheck: (index: number, payload: Record<string, unknown>) => void
  onListen: (index: number) => void
}) {
  const pack = assignment.exercise.payload
  const step = state.step ?? 0
  const feedback = state.feedback?.[step] ?? null
  const cards = pack.activities?.FLASHCARDS?.cards ?? []
  const testItems = pack.activities?.TEST?.items ?? []
  const writeItems = pack.activities?.WRITE?.items ?? []
  const speakItems = pack.activities?.SPEAK?.items ?? []
  const yesNoItems = pack.activities?.YES_NO?.items ?? []
  const total =
    tool === 'FLASHCARDS'
      ? cards.length
      : tool === 'TEST'
        ? testItems.length
        : tool === 'WRITE'
          ? writeItems.length
          : tool === 'SPEAK'
            ? speakItems.length
            : yesNoItems.length
  const queue = tool === 'FLASHCARDS' ? remainingFlashQueue(state, total) : activeQueue(state, total)
  const cardStep = tool === 'FLASHCARDS' && queue.length ? queue[0] : step
  const queuePos = Math.max(0, queue.indexOf(cardStep))
  const queueLast = queue.length === 0 || queuePos >= queue.length - 1
  const remainingWrong = wrongIndices(tool, state, total)
  const last = queueLast && remainingWrong.length === 0

  function startErrorRound(nextState: PlayProgress) {
    const wrong = wrongIndices(tool, nextState, total)
    if (wrong.length === 0) {
      onState({ ...nextState, done: true, retry: false, queue: undefined })
      return
    }
    if (flipped) onFlip()
    onState(resetWrong(tool, nextState, wrong))
  }

  function goNext() {
    const nextIndex = queue[queuePos + 1]
    if (nextIndex !== undefined) {
      onState({ ...state, step: nextIndex })
      return
    }
    startErrorRound(state)
  }

  function finishTool() {
    startErrorRound(state)
  }

  const feedbackKey = feedback ? `${step}:${feedback.correct}:${feedback.expected}` : ''
  useEffect(() => {
    if (tool === 'FLASHCARDS' || !feedbackKey) return
    const wait = feedback?.correct ? 1100 : 1800
    const timer = window.setTimeout(() => {
      goNext()
    }, wait)
    return () => window.clearTimeout(timer)
  }, [feedbackKey, tool])

  function markCard(knows: boolean) {
    const current = cardStep
    const known = range(total).map((index) => Boolean(state.known?.[index]))
    const marked = range(total).map((index) => Boolean(state.marked?.[index]))
    let nextQueue = queue.filter((index) => index !== current)
    if (knows) {
      known[current] = true
      marked[current] = true
    } else {
      known[current] = false
      marked[current] = false
      nextQueue = postponeCard(queue, current)
    }
    if (flipped) onFlip()
    if (nextQueue.length === 0) {
      onState({ ...state, known, marked, queue: [], step: 0, done: true, retry: false })
      return
    }
    onState({
      ...state,
      known,
      marked,
      queue: nextQueue,
      step: nextQueue[0],
      done: false,
      retry: nextQueue.length < total,
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col sm:block sm:rounded-2xl sm:border sm:border-line sm:bg-paper sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        {tool !== 'FLASHCARDS' ? (
          <div className="result-chip-slot min-w-0">
            {feedback ? <ResultChip correct={feedback.correct} expected={feedback.expected} /> : null}
          </div>
        ) : (
          <div />
        )}
        <p className="shrink-0 text-[13px] text-ink-soft">
          {tool === 'FLASHCARDS'
            ? `${range(total).filter((index) => state.known?.[index]).length} из ${total}`
            : `${queuePos + 1} из ${Math.max(queue.length, 1)}`}
          {tool !== 'FLASHCARDS' && state.retry ? ' · ошибки' : ''}
        </p>
      </div>

      {tool === 'FLASHCARDS' && cards[cardStep] ? (
        <div className="flex min-h-0 flex-1 flex-col sm:block">
          <button type="button" className="flash-face w-full" onClick={onFlip}>
            <div
              className={`flash-word ${flipped ? '' : 'hangul'}`}
              lang={flipped ? undefined : 'ko'}
            >
              {flipped ? cards[cardStep].back : cards[cardStep].front}
            </div>
            <div className="flash-hint">{cards[cardStep].hint && !flipped ? cards[cardStep].hint : ' '}</div>
          </button>
          <div className="mt-3 grid shrink-0 grid-cols-2 gap-2 sm:mt-4">
            <Button className="min-h-12 w-full" tone="ghost" onClick={() => markCard(false)}>
              Ещё учу
            </Button>
            <Button className="min-h-12 w-full" onClick={() => markCard(true)}>
              Знаю
            </Button>
          </div>
        </div>
      ) : null}

      {tool === 'TEST' && testItems[step] ? (
        <div className="flex min-h-0 flex-1 flex-col sm:block">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 text-center sm:block sm:flex-none sm:text-left">
            <div className="hangul text-[36px] font-medium leading-tight sm:text-[28px]" lang="ko">
              {testItems[step].prompt}
            </div>
          </div>
          <div className="mt-3 shrink-0 sm:mt-4">
            <div className="grid gap-2">
              {testItems[step].options.map((option) => {
                const answerSize = optionTextClass(testItems[step].options.map((item) => item.text))
                const picked = state.selected?.[step] === option.id
                const isRight = feedback?.expectedId === option.id
                const tone = feedback
                  ? isRight
                    ? 'border-mint bg-mint/10'
                    : picked
                      ? 'border-seal bg-red-50'
                      : 'border-line opacity-60'
                  : picked
                    ? 'border-cedar bg-blush'
                    : 'border-line'
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={Boolean(feedback) || pending}
                    className={`min-h-[4.25rem] w-full rounded-xl border px-4 py-3 text-left sm:min-h-14 ${tone}`}
                    onClick={() => {
                      const selected = [...(state.selected ?? [])]
                      selected[step] = option.id
                      onState({ ...state, selected })
                      onCheck(step, { selected: option.id })
                    }}
                  >
                    <span className={`hangul font-medium leading-snug ${answerSize}`} lang="ko">
                      {option.text}
                    </span>
                  </button>
                )
              })}
            </div>
            {feedback ? (
              <ResultNav
                last={last}
                onNext={goNext}
                onDone={finishTool}
                doneLabel="Все упражнения"
                align="end"
              />
            ) : (
              <div className="mt-6 h-14 sm:h-12" />
            )}
          </div>
        </div>
      ) : null}

      {tool === 'WRITE' && writeItems[step] ? (
        <div className="flex min-h-0 flex-1 flex-col sm:block">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 text-center sm:block sm:flex-none sm:text-left">
            <p className="text-[13px] text-ink-soft">Напишите по-корейски</p>
            <div className="mt-4 text-[32px] font-semibold leading-snug sm:mt-2 sm:text-[28px]">
              {writeItems[step].prompt}
            </div>
          </div>
          <div className="mt-3 shrink-0 sm:mt-4">
            <input
              className="ko-input hangul"
              lang="ko"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              value={state.texts?.[step] ?? ''}
              disabled={Boolean(feedback) || pending}
              onChange={(event) => {
                const texts = [...(state.texts ?? [])]
                texts[step] = event.target.value
                onState({ ...state, texts })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && state.texts?.[step]?.trim() && !feedback) {
                  event.preventDefault()
                  onCheck(step, { text: state.texts?.[step] })
                }
              }}
            />
            {!feedback ? (
              <div className="mt-4">
                <Button
                  className="min-h-14 w-full sm:min-h-12 sm:w-auto sm:ml-auto sm:flex"
                  disabled={pending || !state.texts?.[step]?.trim()}
                  onClick={() => onCheck(step, { text: state.texts?.[step] })}
                >
                  Проверить
                </Button>
              </div>
            ) : (
              <ResultNav
                last={last}
                onNext={goNext}
                onDone={finishTool}
                doneLabel="Все упражнения"
                align="end"
              />
            )}
          </div>
        </div>
      ) : null}

      {tool === 'SPEAK' && speakItems[step] ? (
        <div className="flex min-h-0 flex-1 flex-col sm:block">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 text-center sm:block sm:flex-none sm:text-left">
            <p className="text-[13px] text-ink-soft">Скажите или напишите по-корейски</p>
            <div className="mt-4 text-[32px] font-semibold leading-snug sm:mt-2 sm:text-[32px]">
              {speakItems[step].prompt}
            </div>
          </div>
          <div className="mt-3 shrink-0 sm:mt-4">
            <label htmlFor="speak-heard" className="block text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              Я слышу
            </label>
            <input
              id="speak-heard"
              className="ko-input hangul"
              lang="ko"
              inputMode="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="done"
              value={listening ? liveHeard || '…' : (state.heard?.[step] ?? '')}
              disabled={Boolean(feedback) || pending || listening}
              onChange={(event) => {
                const heard = [...(state.heard ?? [])]
                heard[step] = event.target.value
                onState({ ...state, heard })
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && state.heard?.[step]?.trim() && !feedback) {
                  event.preventDefault()
                  onCheck(step, { heard: state.heard[step] })
                }
              }}
            />
            {!feedback ? (
              <div className={`mt-4 grid gap-2 ${hasKoreanSpeech() ? 'grid-cols-2' : 'grid-cols-1'}`}>
                {hasKoreanSpeech() ? (
                  <Button
                    tone="ghost"
                    className="min-h-14 w-full sm:min-h-12"
                    disabled={listening || pending}
                    onClick={() => onListen(step)}
                  >
                    {listening ? 'Слушаю…' : 'Сказать'}
                  </Button>
                ) : null}
                <Button
                  className="min-h-14 w-full sm:min-h-12"
                  disabled={pending || listening || !state.heard?.[step]?.trim()}
                  onClick={() => onCheck(step, { heard: state.heard?.[step] })}
                >
                  Проверить
                </Button>
              </div>
            ) : (
              <ResultNav
                last={last}
                onNext={goNext}
                onDone={finishTool}
                doneLabel="Все упражнения"
                align="end"
              />
            )}
          </div>
        </div>
      ) : null}

      {tool === 'YES_NO' && yesNoItems[step] ? (
        <div className="flex min-h-0 flex-1 flex-col sm:block">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-1 text-center sm:block sm:flex-none">
            <p className="text-[13px] text-ink-soft">Верный ли это перевод?</p>
            <div className="hangul mt-4 text-[40px] font-medium leading-tight sm:text-[36px]" lang="ko">
              {yesNoItems[step].ko}
            </div>
            <div className="mt-3 text-[22px] sm:mt-2">{yesNoItems[step].ru}</div>
          </div>
          <div className="mt-3 shrink-0 sm:mt-6">
            <div className="grid grid-cols-2 gap-2">
              <Button
                className="min-h-[4.5rem] w-full sm:min-h-14"
                disabled={Boolean(feedback) || pending}
                onClick={() => {
                  const answers = [...(state.answers ?? [])]
                  answers[step] = true
                  onState({ ...state, answers })
                  onCheck(step, { yes: true })
                }}
              >
                <span className="hangul text-[32px] font-semibold leading-none sm:text-[24px]">네</span>
              </Button>
              <Button
                tone="ghost"
                className="min-h-[4.5rem] w-full sm:min-h-14"
                disabled={Boolean(feedback) || pending}
                onClick={() => {
                  const answers = [...(state.answers ?? [])]
                  answers[step] = false
                  onState({ ...state, answers })
                  onCheck(step, { yes: false })
                }}
              >
                <span className="hangul text-[32px] font-semibold leading-none sm:text-[24px]">아니요</span>
              </Button>
            </div>
            {feedback ? (
              <ResultNav
                last={last}
                onNext={goNext}
                onDone={finishTool}
                doneLabel="Все упражнения"
                align="end"
              />
            ) : (
              <div className="mt-6 h-14 sm:h-12" />
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

