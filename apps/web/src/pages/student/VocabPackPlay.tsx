import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api.ts'
import { Button, ResultChip, ResultNav } from '../../components/ui.tsx'
import { startKoreanSpeech } from '../../speech.ts'
import type { Assignment, PlayProgress, PracticeTool } from '../../types.ts'

type Feedback = { correct: boolean; expected: string; expectedId?: string }

const labels: Record<PracticeTool, string> = {
  FLASHCARDS: 'Карточки',
  TEST: 'Тест',
  WRITE: 'Напиши слово',
  SPEAK: 'Скажи слово',
  YES_NO: '네 / 아니요',
}

const TOOL_ORDER: PracticeTool[] = ['FLASHCARDS', 'YES_NO', 'TEST', 'WRITE', 'SPEAK']
const PASS_RATIO = 0.85

function range(count: number) {
  return Array.from({ length: count }, (_, index) => index)
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
          'not-allowed': 'Нет доступа к микрофону. Разрешите микрофон для этого сайта.',
          'no-speech': 'Браузер ничего не услышал. Скажите слово по-корейски и нажмите ещё раз.',
          'audio-capture': 'Микрофон не найден.',
          network: 'Распознавание речи недоступно без сети.',
          'language-not-supported': 'Этот браузер не распознаёт корейский. Проверьте язык диктовки в настройках телефона.',
        }
        setError(messages[code] ?? 'Не получилось распознать. Нажмите ещё раз.')
      },
      onEnd: () => setListening(false),
    })
    if (!started) {
      setListening(false)
      setError('Этот браузер не умеет распознавать речь. Откройте задание в Chrome.')
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

  return (
    <div className="flex min-h-svh flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-paper px-4 py-3">
        <Button tone="ghost" onClick={() => void exit()} disabled={leaving}>
          {leaving ? 'Выхожу…' : 'Выйти'}
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold">
          {assignment.exercise.topic?.title ?? assignment.exercise.title}
        </h1>
        {currentTool ? (
          <button
            type="button"
            className="text-[13px] font-medium text-ink-soft hover:text-ink"
            onClick={() => update({ ...progress, currentTool: null })}
          >
            Все упражнения
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-5 lg:p-8">
        <div className="mx-auto max-w-lg">
          {!currentTool ? (
            <div>
              <p className="mb-3 text-[13px] font-medium text-ink">Список упражнений</p>
              <div className="space-y-1">
                {summaries.map((item) => (
                  <button
                    key={item.tool}
                    type="button"
                    onClick={() => openTool(item.tool)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-blush"
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                        item.done
                          ? 'bg-mint text-white'
                          : item.needsRetry
                            ? 'bg-amber-200 text-amber-900'
                            : 'text-ink-soft'
                      }`}
                    >
                      {item.done ? '✓' : item.needsRetry ? '!' : '○'}
                    </span>
                    <span className="flex-1 text-[15px] font-semibold">
                      {item.label}
                      {item.needsRetry ? ' · повторить ошибки' : ''}
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
    <div className="rounded-2xl border border-line bg-paper p-4 sm:p-6">
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
        <div>
          <button type="button" className="flash-face w-full" onClick={onFlip}>
            <div
              className={`flash-word ${flipped ? '' : 'hangul'}`}
              lang={flipped ? undefined : 'ko'}
            >
              {flipped ? cards[cardStep].back : cards[cardStep].front}
            </div>
            <div className="flash-hint">{cards[cardStep].hint && !flipped ? cards[cardStep].hint : ' '}</div>
          </button>
          <div className="mt-4 flex justify-end gap-2">
            <Button tone="ghost" onClick={() => markCard(false)}>
              Ещё учу
            </Button>
            <Button onClick={() => markCard(true)}>
              Знаю
            </Button>
          </div>
        </div>
      ) : null}

      {tool === 'TEST' && testItems[step] ? (
        <div>
          <div className="hangul text-[28px] font-medium" lang="ko">
            {testItems[step].prompt}
          </div>
          <div className="mt-4 grid gap-2">
            {testItems[step].options.map((option) => {
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
                  className={`rounded-xl border px-4 py-3 text-left ${tone}`}
                  onClick={() => {
                    const selected = [...(state.selected ?? [])]
                    selected[step] = option.id
                    onState({ ...state, selected })
                    onCheck(step, { selected: option.id })
                  }}
                >
                  {option.text}
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
            <div className="mt-6 h-11" />
          )}
        </div>
      ) : null}

      {tool === 'WRITE' && writeItems[step] ? (
        <div>
          <p className="text-[13px] text-ink-soft">Напишите по-корейски</p>
          <div className="mt-2 text-[28px] font-semibold">{writeItems[step].prompt}</div>
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
            <div className="mt-6 flex h-11 justify-end">
              <Button
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
      ) : null}

      {tool === 'SPEAK' && speakItems[step] ? (
        <div className="text-center">
          <p className="text-[13px] text-ink-soft">Скажите слово по-корейски.</p>
          <div className="mt-3 text-[32px] font-semibold">{speakItems[step].prompt}</div>
          <div className="mt-4 flex min-h-[7.5rem] flex-col justify-center rounded-xl border border-line bg-blush px-4 py-5" lang="ko">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">Я слышу</p>
            <p className="hangul mt-3 min-h-12 text-[22px] font-medium" lang="ko">
              {liveHeard || state.heard?.[step] || (listening ? '…' : '—')}
            </p>
          </div>
          <div className="mt-4 flex min-h-11 items-center justify-center">
            {!feedback ? (
              <Button disabled={listening || pending} onClick={() => onListen(step)}>
                {listening ? 'Слушаю корейскую речь…' : 'Нажать и сказать'}
              </Button>
            ) : (
              <ResultNav
                last={last}
                onNext={goNext}
                onDone={finishTool}
                doneLabel="Все упражнения"
                align="center"
                compact
              />
            )}
          </div>
        </div>
      ) : null}

      {tool === 'YES_NO' && yesNoItems[step] ? (
        <div className="text-center">
          <p className="text-[13px] text-ink-soft">Верный ли это перевод?</p>
          <div className="hangul mt-4 text-[36px] font-medium" lang="ko">
            {yesNoItems[step].ko}
          </div>
          <div className="mt-2 text-[22px]">{yesNoItems[step].ru}</div>
          <div className="mt-6 flex justify-center gap-2">
            <Button
              className="min-h-11 min-w-24"
              disabled={Boolean(feedback) || pending}
              onClick={() => {
                const answers = [...(state.answers ?? [])]
                answers[step] = true
                onState({ ...state, answers })
                onCheck(step, { yes: true })
              }}
            >
              네
            </Button>
            <Button
              tone="ghost"
              className="min-h-11 min-w-24"
              disabled={Boolean(feedback) || pending}
              onClick={() => {
                const answers = [...(state.answers ?? [])]
                answers[step] = false
                onState({ ...state, answers })
                onCheck(step, { yes: false })
              }}
            >
              아니요
            </Button>
          </div>
          {feedback ? (
            <ResultNav
              last={last}
              onNext={goNext}
              onDone={finishTool}
              doneLabel="Все упражнения"
              align="center"
            />
          ) : (
            <div className="mt-6 h-11" />
          )}
        </div>
      ) : null}
    </div>
  )
}

