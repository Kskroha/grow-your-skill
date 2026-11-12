import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api.ts'
import { Button, ResultNav } from '../../components/ui.tsx'
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
  if (tool === 'FLASHCARDS') return Boolean(state.marked?.[index])
  return Boolean(state.feedback?.[index])
}

function isCorrect(tool: PracticeTool, state: PlayProgress, index: number) {
  if (tool === 'FLASHCARDS') return Boolean(state.marked?.[index] && state.known?.[index])
  return Boolean(state.feedback?.[index]?.correct)
}

function toolStats(tool: PracticeTool, state: PlayProgress, total: number) {
  const answered = range(total).filter((index) => isAnswered(tool, state, index)).length
  const correct = range(total).filter((index) => isCorrect(tool, state, index)).length
  const finished = total > 0 && answered >= total
  const passed = finished && correct / total >= PASS_RATIO
  return { answered, correct, total, finished, passed, needsRetry: finished && !passed }
}

function wrongIndices(tool: PracticeTool, state: PlayProgress, total: number) {
  return range(total).filter((index) => !isCorrect(tool, state, index))
}

function activeQueue(state: PlayProgress, total: number) {
  return state.queue?.length ? state.queue : range(total)
}

function resetWrong(tool: PracticeTool, state: PlayProgress, wrong: number[]): PlayProgress {
  const next = { ...state, retry: true, queue: wrong, step: wrong[0] ?? 0, done: false }
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
  for (const index of wrong) {
    next.feedback[index] = null
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
    const stats = toolStats(tool, state, count)
    if (stats.needsRetry) {
      const wrong = wrongIndices(tool, state, count)
      const unansweredWrong = wrong.filter((index) => !isAnswered(tool, state, index))
      if (unansweredWrong.length === 0) {
        state = resetWrong(tool, state, wrong)
      } else {
        state = { ...state, retry: true, queue: unansweredWrong, step: unansweredWrong[0], done: false }
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
    const SpeechCtor = (
      window as Window & {
        SpeechRecognition?: new () => KoreanSpeech
        webkitSpeechRecognition?: new () => KoreanSpeech
      }
    ).SpeechRecognition ?? (
      window as Window & { webkitSpeechRecognition?: new () => KoreanSpeech }
    ).webkitSpeechRecognition
    if (!SpeechCtor) {
      setError('Этот браузер не умеет распознавать речь. Откройте задание в Chrome.')
      return
    }
    const recognition = new SpeechCtor()
    recognition.lang = 'ko-KR'
    recognition.interimResults = true
    recognition.continuous = false
    setListening(true)
    setLiveHeard('')
    setError('')
    recognition.onresult = (event) => {
      let interim = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i]?.[0]?.transcript ?? ''
        if (event.results[i]?.isFinal) finalText += piece
        else interim += piece
      }
      const caption = (finalText || interim).trim()
      setLiveHeard(caption)
      if (!finalText.trim()) return
      const current = toolState(tool)
      const nextHeard = [...(current.heard ?? [])]
      nextHeard[index] = finalText.trim()
      update({
        ...snapshot.current,
        currentTool: tool,
        tools: { ...snapshot.current.tools, [tool]: { ...current, heard: nextHeard, step: index } },
      })
      void check(tool, index, { heard: finalText.trim() })
    }
    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        'not-allowed': 'Нет доступа к микрофону. Разрешите микрофон для этого сайта.',
        'no-speech': 'Браузер ничего не услышал. Скажите слово по-корейски и нажмите ещё раз.',
        'audio-capture': 'Микрофон не найден.',
        network: 'Распознавание речи недоступно без сети.',
        'language-not-supported': 'Этот браузер не распознаёт корейский.',
      }
      setError(messages[event.error] ?? 'Не получилось распознать. Нажмите ещё раз.')
    }
    recognition.onend = () => setListening(false)
    recognition.start()
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

      <div className="flex-1 overflow-auto p-5 lg:p-8">
        <div className="mx-auto max-w-3xl">
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
              onState={(next) =>
                update({
                  ...progress,
                  currentTool,
                  tools: { ...progress.tools, [currentTool]: next },
                })
              }
              onCheck={(index, payload) => void check(currentTool, index, payload)}
              onListen={(index) => listen(currentTool, index)}
              onBack={() => {
                setFlipped(false)
                update({ ...progress, currentTool: null })
              }}
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
  onBack,
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
  onBack: () => void
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
  const queue = activeQueue(state, total)
  const queuePos = Math.max(0, queue.indexOf(step))
  const last = queue.length === 0 || queuePos >= queue.length - 1

  function goNext() {
    const nextIndex = queue[queuePos + 1]
    if (nextIndex === undefined) return
    onState({ ...state, step: nextIndex })
  }

  function finishTool() {
    const stats = toolStats(tool, state, total)
    if (stats.needsRetry) {
      onState(resetWrong(tool, state, wrongIndices(tool, state, total)))
      return
    }
    onBack()
  }

  function markCard(knows: boolean) {
    const known = [...(state.known ?? [])]
    const marked = [...(state.marked ?? [])]
    known[step] = knows
    marked[step] = true
    const nextState: PlayProgress = { ...state, known, marked, step }
    const stats = toolStats(tool, nextState, total)
    const remaining = queue.filter((index) => index !== step && !marked[index])
    if (remaining.length === 0) {
      if (stats.needsRetry) {
        onState(resetWrong(tool, nextState, wrongIndices(tool, nextState, total)))
        if (flipped) onFlip()
        return
      }
      onState({ ...nextState, done: stats.passed, retry: false, queue: undefined })
      if (stats.passed) onBack()
      return
    }
    const nextStep = remaining.find((index) => index > step) ?? remaining[0]
    if (flipped) onFlip()
    onState({ ...nextState, step: nextStep, done: stats.passed })
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-semibold">{labels[tool]}</h2>
        <p className="text-[13px] text-ink-soft">
          {queuePos + 1} из {Math.max(queue.length, 1)}
          {state.retry ? ' · ошибки' : ''}
        </p>
      </div>

      {tool === 'FLASHCARDS' && cards[step] ? (
        <div>
          <button type="button" className="flash-face w-full" onClick={onFlip}>
            <div
              className={`flash-word ${flipped ? '' : 'hangul'}`}
              lang={flipped ? undefined : 'ko'}
            >
              {flipped ? cards[step].back : cards[step].front}
            </div>
            <div className="flash-hint">{cards[step].hint && !flipped ? cards[step].hint : ' '}</div>
          </button>
          <div className="mt-4 flex gap-2">
            <Button tone="ghost" disabled={!flipped && !state.marked?.[step]} onClick={() => markCard(false)}>
              Ещё учу
            </Button>
            <Button disabled={!flipped && !state.marked?.[step]} onClick={() => markCard(true)}>
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
              correct={feedback.correct}
              expected={feedback.expected}
              last={last}
              onNext={goNext}
              onDone={finishTool}
              doneLabel="Все упражнения"
            />
          ) : null}
        </div>
      ) : null}

      {tool === 'WRITE' && writeItems[step] ? (
        <div>
          <p className="text-[13px] text-ink-soft">Напишите по-корейски</p>
          <div className="mt-2 text-[28px] font-semibold">{writeItems[step].prompt}</div>
          <input
            className="hangul mt-4 w-full border-b-2 border-cedar bg-transparent py-2 text-[22px] outline-none"
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
            <Button
              className="mt-3"
              disabled={pending || !state.texts?.[step]?.trim()}
              onClick={() => onCheck(step, { text: state.texts?.[step] })}
            >
              Проверить
            </Button>
          ) : (
            <ResultNav
              correct={feedback.correct}
              expected={feedback.expected}
              last={last}
              onNext={goNext}
              onDone={finishTool}
              doneLabel="Все упражнения"
            />
          )}
        </div>
      ) : null}

      {tool === 'SPEAK' && speakItems[step] ? (
        <div className="text-center">
          <p className="text-[13px] text-ink-soft">Скажите это слово по-корейски. Браузер слушает корейскую речь (ko-KR).</p>
          <div className="mt-3 text-[32px] font-semibold">{speakItems[step].prompt}</div>
          <div className="mt-5 rounded-xl border border-line bg-blush px-4 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
              {listening ? 'Браузер слышит' : 'Что услышал браузер'}
            </p>
            <p className="hangul mt-2 min-h-8 text-[22px] font-medium" lang="ko">
              {liveHeard || state.heard?.[step] || (listening ? '…' : '—')}
            </p>
          </div>
          {!feedback ? (
            <Button className="mt-4" disabled={listening || pending} onClick={() => onListen(step)}>
              {listening ? 'Слушаю корейскую речь…' : 'Нажать и сказать'}
            </Button>
          ) : (
            <ResultNav
              correct={feedback.correct}
              expected={feedback.expected}
              last={last}
              onNext={goNext}
              onDone={finishTool}
              doneLabel="Все упражнения"
              align="center"
            />
          )}
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
              correct={feedback.correct}
              expected={feedback.expected}
              last={last}
              onNext={goNext}
              onDone={finishTool}
              doneLabel="Все упражнения"
              align="center"
            />
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

type KoreanSpeech = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<{ isFinal: boolean } & ArrayLike<{ transcript: string }>>
  }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}
