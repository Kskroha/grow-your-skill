import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api.ts'
import { Button } from '../../components/ui.tsx'
import type { Assignment, PlayProgress, PracticeTool } from '../../types.ts'

type Feedback = { correct: boolean; expected: string; expectedId?: string }

const labels: Record<PracticeTool, string> = {
  FLASHCARDS: 'Карточки',
  TEST: 'Тест',
  WRITE: 'Напиши слово',
  SPEAK: 'Скажи слово',
  YES_NO: '네 / 아니요',
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
  const tools = (pack.tools ?? []) as PracticeTool[]
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
      const done = count > 0 && feedback.every(Boolean)
      update({
        ...progress,
        currentTool: tool,
        tools: {
          ...progress.tools,
          [tool]: { ...current, feedback, done, step: index },
        },
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось проверить')
    } finally {
      setPending(false)
    }
  }

  async function finishPack() {
    const cardCount = countFor('FLASHCARDS')
    const cardMarked = toolState('FLASHCARDS').marked ?? []
    const cardsAnswered = Array.from({ length: cardCount }, (_, index) => cardMarked[index]).every(Boolean)
    if (tools.includes('FLASHCARDS') && cardCount > 0 && !cardsAnswered) {
      setError('Отметьте все карточки, прежде чем завершить')
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
    const state = toolState(tool)
    const total = countFor(tool)
    const answered =
      tool === 'FLASHCARDS'
        ? (state.marked ?? []).filter(Boolean).length
        : (state.feedback ?? []).filter(Boolean).length
    return {
      tool,
      label: labels[tool],
      done: Boolean(state.done) || (total > 0 && answered >= total),
      percent: total ? Math.round((answered / total) * 100) : 0,
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
            К теме
          </button>
        ) : null}
      </div>

      <div className="flex-1 overflow-auto p-5 lg:p-8">
        <div className="mx-auto max-w-3xl">
          {!currentTool ? (
            <div className="rounded-2xl border border-line bg-paper p-5">
              <p className="text-[14px] text-ink-soft">Выполните инструменты по очереди. Прогресс сохраняется.</p>
              <div className="mt-4 space-y-2">
                {summaries.map((item) => (
                  <button
                    key={item.tool}
                    type="button"
                    onClick={() => update({ ...progress, currentTool: item.tool })}
                    className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left ${
                      item.done ? 'border-mint/40 bg-mint/[0.06]' : 'border-line hover:bg-blush'
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[12px] ${
                        item.done ? 'bg-mint text-white' : 'border border-line text-ink-soft'
                      }`}
                    >
                      {item.done ? '✓' : ''}
                    </span>
                    <span className="flex-1 text-[15px] font-semibold">{item.label}</span>
                    <span className="text-[12px] text-ink-soft">{item.percent}%</span>
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
  const last = step >= total - 1

  function goNext() {
    onState({ ...state, step: Math.min(total - 1, step + 1) })
  }

  return (
    <div className="rounded-2xl border border-line bg-paper p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[18px] font-semibold">{labels[tool]}</h2>
        <p className="text-[13px] text-ink-soft">
          {step + 1} из {Math.max(total, 1)}
        </p>
      </div>

      {tool === 'FLASHCARDS' && cards[step] ? (
        <div>
          <button type="button" className="w-full rounded-2xl bg-blush px-6 py-14 text-center" onClick={onFlip}>
            <div
              className={`${flipped ? '' : 'hangul '}text-[40px] font-medium leading-none`}
              lang={flipped ? undefined : 'ko'}
            >
              {flipped ? cards[step].back : cards[step].front}
            </div>
            {cards[step].hint && !flipped ? (
              <div className="mt-3 text-ink-soft">{cards[step].hint}</div>
            ) : null}
          </button>
          <div className="mt-4 flex gap-2">
            <Button
              tone="ghost"
              disabled={!flipped && !state.marked?.[step]}
              onClick={() => {
                const known = [...(state.known ?? [])]
                const marked = [...(state.marked ?? [])]
                known[step] = false
                marked[step] = true
                const nextStep = last ? step : Math.min(cards.length - 1, step + 1)
                if (flipped) onFlip()
                onState({
                  ...state,
                  known,
                  marked,
                  step: nextStep,
                  done: marked.filter(Boolean).length >= cards.length,
                })
              }}
            >
              Ещё учу
            </Button>
            <Button
              disabled={!flipped && !state.marked?.[step]}
              onClick={() => {
                const known = [...(state.known ?? [])]
                const marked = [...(state.marked ?? [])]
                known[step] = true
                marked[step] = true
                const nextStep = last ? step : Math.min(cards.length - 1, step + 1)
                if (flipped) onFlip()
                onState({
                  ...state,
                  known,
                  marked,
                  step: nextStep,
                  done: marked.filter(Boolean).length >= cards.length,
                })
              }}
            >
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
              className="mt-4"
              disabled={pending || !state.texts?.[step]?.trim()}
              onClick={() => onCheck(step, { text: state.texts?.[step] })}
            >
              Проверить
            </Button>
          ) : null}
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
            <Button className="mt-6" disabled={listening || pending} onClick={() => onListen(step)}>
              {listening ? 'Слушаю корейскую речь…' : 'Нажать и сказать'}
            </Button>
          ) : null}
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
            <div className="mt-3">
              <p className={`text-[15px] font-medium ${feedback.correct ? 'text-mint' : 'text-seal'}`}>
                {feedback.correct ? 'Верно' : `Правильный ответ: ${feedback.expected}`}
              </p>
              {last ? (
                <Button className="mt-2" onClick={onBack}>
                  К теме
                </Button>
              ) : (
                <Button className="mt-2" onClick={goNext}>
                  Дальше
                </Button>
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {feedback && tool !== 'YES_NO' && tool !== 'FLASHCARDS' ? (
        <div className="mt-5">
          <p className={`text-[15px] font-medium ${feedback.correct ? 'text-mint' : 'text-seal'}`}>
            {feedback.correct ? 'Верно' : `Правильный ответ: ${feedback.expected}`}
          </p>
          {last ? (
            <Button className="mt-4" onClick={onBack}>
              К теме
            </Button>
          ) : (
            <Button className="mt-4" onClick={goNext}>
              Дальше
            </Button>
          )}
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
