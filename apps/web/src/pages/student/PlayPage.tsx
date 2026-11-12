import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api.ts'
import { Button, ResultNav } from '../../components/ui.tsx'
import type { Assignment, FillItem, FlashCard, McItem, PlayProgress } from '../../types.ts'
import { VocabPackPlay } from './VocabPackPlay.tsx'

type ItemFeedback = {
  correct: boolean
  expected: string
  expectedId?: string
}

function emptyPlayState(data: Assignment) {
  const payload = data.exercise.payload
  const count =
    data.exercise.type === 'FLASHCARDS'
      ? (payload.cards ?? []).length
      : (payload.items ?? []).length
  return {
    selected: Array(count).fill('') as string[],
    texts: Array(count).fill('') as string[],
    known: Array(count).fill(false) as boolean[],
    marked: Array(count).fill(false) as boolean[],
    feedback: Array(count).fill(null) as Array<ItemFeedback | null>,
    step: 0,
  }
}

function restorePlayState(data: Assignment) {
  const empty = emptyPlayState(data)
  const saved = data.status === 'COMPLETED' ? null : data.progress
  if (!saved) return empty
  const take = <T,>(value: T[] | undefined, fallback: T[]) =>
    value && value.length === fallback.length ? value : fallback
  return {
    selected: take(saved.selected, empty.selected),
    texts: take(saved.texts, empty.texts),
    known: take(saved.known, empty.known),
    marked: take(saved.marked, empty.marked),
    feedback: take(saved.feedback, empty.feedback),
    step: Math.min(Math.max(saved.step ?? 0, 0), Math.max(empty.selected.length - 1, 0)),
  }
}

export function PlayPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [assignment, setAssignment] = useState<Assignment | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [texts, setTexts] = useState<string[]>([])
  const [known, setKnown] = useState<boolean[]>([])
  const [marked, setMarked] = useState<boolean[]>([])
  const [feedback, setFeedback] = useState<Array<ItemFeedback | null>>([])
  const [step, setStep] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const snapshot = useRef<PlayProgress>({})
  const canPersist = useRef(false)

  function applyState(data: Assignment, fresh = false) {
    const next = fresh ? emptyPlayState(data) : restorePlayState(data)
    setAssignment(data)
    setSelected(next.selected)
    setTexts(next.texts)
    setKnown(next.known)
    setMarked(next.marked)
    setFeedback(next.feedback)
    setStep(next.step)
    setFlipped(false)
    canPersist.current = data.status !== 'COMPLETED'
  }

  useEffect(() => {
    if (!id) return
    api<Assignment>(`/assignments/${id}`)
      .then((data) => applyState(data))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Не удалось открыть задание')
      })
  }, [id])

  snapshot.current = { step, selected, texts, known, marked, feedback }

  async function persist(progress: PlayProgress = snapshot.current) {
    if (!id || !canPersist.current) return
    await api(`/assignments/${id}/progress`, {
      method: 'POST',
      body: JSON.stringify({ progress }),
    })
  }

  async function exit() {
    if (leaving) return
    setLeaving(true)
    try {
      await persist()
    } catch {
      // still leave — answers already saved on each check
    }
    navigate('/student')
  }

  const cards = useMemo(
    () => (assignment?.exercise.payload.cards ?? []) as FlashCard[],
    [assignment],
  )

  async function checkCurrent(payload: { selected?: string; text?: string }) {
    if (!id || feedback[step]) return
    setPending(true)
    setError('')
    try {
      const next = await api<ItemFeedback>(`/assignments/${id}/check`, {
        method: 'POST',
        body: JSON.stringify({ index: step, ...payload }),
      })
      setFeedback((current) => {
        const copy = [...current]
        copy[step] = next
        return copy
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось проверить')
    } finally {
      setPending(false)
    }
  }

  async function submit() {
    if (!id || !assignment) return
    if (assignment.exercise.type === 'FLASHCARDS' && !marked.every(Boolean)) {
      setError('Отметьте все карточки, прежде чем завершить')
      return
    }
    setPending(true)
    setError('')
    const answers =
      assignment.exercise.type === 'MULTIPLE_CHOICE'
        ? { selected }
        : assignment.exercise.type === 'FLASHCARDS'
          ? { known, marked }
          : { texts }
    try {
      canPersist.current = false
      await api(`/assignments/${id}/attempts`, {
        method: 'POST',
        body: JSON.stringify({ answers }),
      })
      navigate('/student')
    } catch (err) {
      canPersist.current = assignment.status !== 'COMPLETED'
      setError(err instanceof Error ? err.message : 'Не удалось отправить')
    } finally {
      setPending(false)
    }
  }

  if (error && !assignment) {
    return <p className="p-6 text-seal">{error}</p>
  }
  if (!assignment) {
    return <p className="p-6 text-ink-soft">Открываю задание…</p>
  }
  if (assignment.exercise.type === 'VOCAB_PACK') {
    return <VocabPackPlay assignment={assignment} />
  }

  const exercise = assignment.exercise
  const allAnswered =
    exercise.type === 'FLASHCARDS'
      ? marked.length > 0 && marked.every(Boolean)
      : feedback.length > 0 && feedback.every(Boolean)
  const mcItems = (exercise.payload.items ?? []) as McItem[]
  const fillItems = (exercise.payload.items ?? []) as FillItem[]
  const sections =
    exercise.type === 'FLASHCARDS'
      ? cards.map((card, index) => card.front || `Карточка ${index + 1}`)
      : exercise.type === 'FILL_BLANK'
        ? fillItems.map((item, index) => item.prompt || `Пропуск ${index + 1}`)
        : mcItems.map((item, index) => item.prompt || `Вопрос ${index + 1}`)
  const currentFeedback = feedback[step] ?? null
  const last = step >= sections.length - 1
  const practice = assignment.status === 'COMPLETED'

  function goNext() {
    const nextStep = Math.min(sections.length - 1, step + 1)
    setStep(nextStep)
    setFlipped(false)
    void persist({ ...snapshot.current, step: nextStep })
  }

  function markCard(know: boolean) {
    if (!flipped && !marked[step]) {
      setError('Сначала переверните карточку')
      return
    }
    const nextKnown = [...known]
    const nextMarked = [...marked]
    nextKnown[step] = know
    nextMarked[step] = true
    setKnown(nextKnown)
    setMarked(nextMarked)
    setError('')
    setFlipped(false)
    const nextStep = last ? step : Math.min(cards.length - 1, step + 1)
    if (!last) setStep(nextStep)
    void persist({
      ...snapshot.current,
      known: nextKnown,
      marked: nextMarked,
      step: nextStep,
    })
  }

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-3 border-b border-line bg-paper px-4 py-3">
          <Button tone="ghost" onClick={() => void exit()} disabled={leaving}>
            {leaving ? 'Выхожу…' : 'Выйти'}
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold">{exercise.title}</h1>
          <p className="text-[13px] text-ink-soft">
            {step + 1} из {Math.max(sections.length, 1)}
          </p>
          {practice ? (
            <span className="text-[12px] font-medium text-ink-soft">Повтор</span>
          ) : (
            <button
              type="button"
              className="text-[13px] font-medium text-ink-soft hover:text-ink"
              onClick={() => {
                applyState(assignment, true)
                void persist(emptyPlayState(assignment))
              }}
            >
              Сначала
            </button>
          )}
        </div>

        <div className="flex-1 overflow-auto p-5 lg:p-8">
          <div className="mx-auto max-w-3xl rounded-2xl border border-line bg-paper p-6">
            {exercise.prompt ? (
              <p className="mb-4 text-[14px] text-ink-soft">{exercise.prompt}</p>
            ) : null}

            {exercise.type === 'MULTIPLE_CHOICE' && mcItems[step] ? (
              <div>
                <div className="hangul text-[22px] font-medium" lang="ko">
                  {mcItems[step].prompt}
                </div>
                <div className="mt-4 grid gap-2">
                  {mcItems[step].options.map((option) => {
                    const picked = selected[step] === option.id
                    const isRight = currentFeedback?.expectedId === option.id
                    const tone = currentFeedback
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
                        disabled={Boolean(currentFeedback) || pending}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left ${tone}`}
                        onClick={() => {
                          if (currentFeedback || pending) return
                          setSelected((current) => {
                            const next = [...current]
                            next[step] = option.id
                            return next
                          })
                          void checkCurrent({ selected: option.id })
                        }}
                      >
                        <span className="hangul text-[16px]">{option.text}</span>
                      </button>
                    )
                  })}
                </div>
                {currentFeedback ? (
                  <ResultNav
                    correct={currentFeedback.correct}
                    expected={currentFeedback.expected}
                    last={last}
                    pending={pending}
                    onNext={goNext}
                    onDone={() => void submit()}
                    doneLabel="Завершить"
                  />
                ) : (
                  <p className="mt-3 text-[13px] text-ink-soft">Выберите ответ</p>
                )}
              </div>
            ) : null}

            {exercise.type === 'FILL_BLANK' && fillItems[step] ? (
              <div>
                <div className="hangul text-[22px] font-medium" lang="ko">
                  {fillItems[step].prompt}
                </div>
                {fillItems[step].hint ? (
                  <div className="mt-1 text-[13px] text-ink-soft">{fillItems[step].hint}</div>
                ) : null}
                <input
                  className="hangul mt-4 w-full border-b-2 border-cedar bg-transparent py-2 text-[22px] outline-none disabled:opacity-70"
                  value={texts[step] ?? ''}
                  disabled={Boolean(currentFeedback) || pending}
                  onChange={(event) =>
                    setTexts((current) => {
                      const next = [...current]
                      next[step] = event.target.value
                      return next
                    })
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && texts[step]?.trim() && !currentFeedback && !pending) {
                      event.preventDefault()
                      void checkCurrent({ text: texts[step] })
                    }
                  }}
                />
                {!currentFeedback ? (
                  <Button
                    className="mt-3"
                    onClick={() => void checkCurrent({ text: texts[step] })}
                    disabled={pending || !texts[step]?.trim()}
                  >
                    {pending ? 'Проверяю…' : 'Проверить'}
                  </Button>
                ) : (
                  <ResultNav
                    correct={currentFeedback.correct}
                    expected={currentFeedback.expected}
                    last={last}
                    pending={pending}
                    onNext={goNext}
                    onDone={() => void submit()}
                    doneLabel="Завершить"
                  />
                )}
              </div>
            ) : null}

            {exercise.type === 'FLASHCARDS' && cards[step] ? (
              <div>
                <button
                  type="button"
                  className="flash-face w-full"
                  onClick={() => setFlipped((value) => !value)}
                >
                  <div
                    className={`flash-word ${flipped ? '' : 'hangul'}`}
                    lang={flipped ? undefined : 'ko'}
                  >
                    {flipped ? cards[step].back : cards[step].front}
                  </div>
                  <div className="flash-hint">{cards[step].hint && !flipped ? cards[step].hint : ' '}</div>
                </button>
                <div className="mt-4 flex gap-2">
                  <Button tone="ghost" disabled={!flipped && !marked[step]} onClick={() => markCard(false)}>
                    Ещё учу
                  </Button>
                  <Button disabled={!flipped && !marked[step]} onClick={() => markCard(true)}>
                    Знаю
                  </Button>
                </div>
                {last && allAnswered ? (
                  <Button className="mt-3" onClick={() => void submit()} disabled={pending}>
                    {pending ? 'Сохраняю…' : 'Завершить'}
                  </Button>
                ) : null}
              </div>
            ) : null}

            {error ? <p className="mt-4 text-seal">{error}</p> : null}
          </div>
        </div>
      </div>

      <aside className="w-full shrink-0 border-t border-line bg-paper lg:w-56 lg:border-t-0 lg:border-l">
        <div className="px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-ink-soft">
          Разделы
        </div>
        <div className="flex gap-1 overflow-auto px-2 pb-3 lg:flex-col">
          {sections.map((label, index) => {
            const itemFeedback = feedback[index]
            const firstOpen =
              exercise.type === 'FLASHCARDS'
                ? marked.findIndex((item) => !item)
                : feedback.findIndex((item) => !item)
            const reachable = firstOpen === -1 || index <= firstOpen
            const doneCard = Boolean(marked[index])
            return (
              <button
                key={index}
                type="button"
                disabled={!reachable}
                onClick={() => {
                  if (!reachable) return
                  setStep(index)
                  setFlipped(false)
                  void persist({ ...snapshot.current, step: index })
                }}
                className={`rounded-lg px-3 py-2 text-left text-[13px] ${
                  step === index
                    ? 'bg-cedar text-white'
                    : itemFeedback
                      ? itemFeedback.correct
                        ? 'text-mint hover:bg-paper'
                        : 'text-seal hover:bg-paper'
                      : doneCard
                        ? known[index]
                          ? 'text-mint hover:bg-paper'
                          : 'text-seal hover:bg-paper'
                        : 'text-ink-soft hover:bg-paper'
                }`}
              >
                {index + 1}. {label}
              </button>
            )
          })}
        </div>
      </aside>
    </div>
  )
}
