import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api.ts'
import { ActivityHeatmap } from '../../components/ActivityHeatmap.tsx'
import {
  Avatar,
  Button,
  HomeworkChip,
  KindBadge,
  Meter,
} from '../../components/ui.tsx'
import type { Assignment, Exercise, PracticeTool, ProgressPayload, Topic } from '../../types.ts'

const packTools: Array<{ key: PracticeTool; label: string }> = [
  { key: 'FLASHCARDS', label: 'Карточки' },
  { key: 'YES_NO', label: '네 / 아니요' },
  { key: 'TEST', label: 'Тест' },
  { key: 'WRITE', label: 'Напиши слово' },
  { key: 'SPEAK', label: 'Скажи слово' },
]

export function StudentDetailPage() {
  const { id } = useParams()
  const [progress, setProgress] = useState<ProgressPayload | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [packTopic, setPackTopic] = useState('')
  const [pickedTools, setPickedTools] = useState<PracticeTool[]>(['FLASHCARDS', 'YES_NO', 'TEST', 'WRITE', 'SPEAK'])
  const [error, setError] = useState('')

  async function load() {
    if (!id) return
    const [nextProgress, nextAssignments, nextExercises, nextTopics] = await Promise.all([
      api<ProgressPayload>(`/progress/${id}`),
      api<Assignment[]>(`/assignments?studentId=${id}`),
      api<Exercise[]>('/catalog/exercises'),
      api<Topic[]>('/catalog/topics'),
    ])
    setProgress(nextProgress)
    setAssignments(nextAssignments)
    setExercises(nextExercises)
    setTopics(nextTopics)
    const vocab = nextTopics.filter((topic) => topic.kind === 'VOCABULARY' && (topic.words?.length ?? 0) > 0)
    if (!packTopic && vocab[0]) setPackTopic(vocab[0].id)
  }

  useEffect(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить ученика')
    })
  }, [id])

  if (error && !progress) return <p className="text-seal">{error}</p>
  if (!progress) return <p className="text-ink-soft">Открываю…</p>

  return (
    <div>
      <Link to="/teacher" className="text-[13px] font-medium text-ink-soft hover:text-ink">
        ← Ученики
      </Link>
      <header className="mt-3 mb-5 flex flex-wrap items-center gap-4">
        <Avatar name={progress.student.name} src={progress.student.avatarUrl} size={48} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[24px] font-semibold">{progress.student.name}</h1>
          <p className="text-[13px] text-ink-soft">{progress.student.email}</p>
        </div>
        <div className="flex gap-6 text-[13px]">
          <div>
            <div className="text-ink-soft">Балл</div>
            <div className="stat text-[20px]">{progress.totals.averageScore ?? '—'}</div>
          </div>
          <div>
            <div className="text-ink-soft">Сдано</div>
            <div className="stat text-[20px]">
              {progress.totals.completed}/{progress.totals.total}
            </div>
          </div>
          <div>
            <div className="text-ink-soft">Серия</div>
            <div className="stat text-[20px]">{progress.totals.streakDays}</div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-3">
          {assignments.map((item) => (
            <article key={item.id} className="flex items-center gap-4 rounded-2xl border border-line bg-paper p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <HomeworkChip status={item.status} score={item.bestScore} />
                  <KindBadge kind={item.exercise.topic?.kind ?? 'GRAMMAR'} />
                </div>
                <div className="mt-1 text-[15px] font-semibold">{item.exercise.topic?.title ?? item.exercise.title}</div>
                {item.packTools && item.packTools.length > 0 ? (
                  <p className="mt-1 text-[12px] text-ink-soft">
                    {item.packTools.map((tool) => tool.label).join(' · ')}
                  </p>
                ) : (
                  <p className="mt-1 text-[12px] text-ink-soft">{item.exercise.title}</p>
                )}
              </div>
              <div className="stat text-[18px] text-cedar">{item.bestScore ?? '—'}</div>
            </article>
          ))}
          {assignments.length === 0 ? (
            <div className="rounded-2xl border border-line bg-paper px-5 py-10 text-center text-[14px] text-ink-soft">
              Ещё ничего не назначено.
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-paper p-4">
            <h2 className="mb-3 text-[14px] font-semibold">Активность</h2>
            <ActivityHeatmap events={progress.activity} defaultRange="month" />
          </div>
          <div className="rounded-2xl border border-line bg-paper p-4">
            <h2 className="mb-3 text-[14px] font-semibold">По типам</h2>
            <div className="space-y-3">
              {progress.byKind.map((item) => (
                <Meter
                  key={item.kind}
                  label={item.kind === 'GRAMMAR' ? 'Грамматика' : 'Лексика'}
                  value={item.completed}
                  total={item.total}
                />
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-4">
            <h2 className="mb-1 text-[14px] font-semibold">Назначить лексику</h2>
            <p className="mb-3 text-[13px] text-ink-soft">Одна карточка с выбранными инструментами.</p>
            <select
              className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[14px]"
              value={packTopic}
              onChange={(event) => setPackTopic(event.target.value)}
            >
              {topics
                .filter((topic) => topic.kind === 'VOCABULARY')
                .map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    {topic.title} · {topic.words?.length ?? 0} слов
                  </option>
                ))}
            </select>
            <div className="mt-3 space-y-1">
              {packTools.map((tool) => (
                <label key={tool.key} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-blush">
                  <input
                    type="checkbox"
                    checked={pickedTools.includes(tool.key)}
                    onChange={(event) => {
                      setPickedTools((current) => {
                        const next = event.target.checked
                          ? [...current, tool.key]
                          : current.filter((value) => value !== tool.key)
                        return packTools.map((item) => item.key).filter((key) => next.includes(key))
                      })
                    }}
                  />
                  <span className="text-[13px]">{tool.label}</span>
                </label>
              ))}
            </div>
            <Button
              className="mt-3"
              disabled={!packTopic || pickedTools.length === 0}
              onClick={async () => {
                if (!id) return
                setError('')
                try {
                  await api('/assignments/pack', {
                    method: 'POST',
                    body: JSON.stringify({ studentId: id, topicId: packTopic, tools: pickedTools }),
                  })
                  await load()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Не удалось назначить тему')
                }
              }}
            >
              Назначить тему
            </Button>
          </div>
          <div className="rounded-2xl border border-line bg-paper p-4">
            <h2 className="mb-3 text-[14px] font-semibold">Назначить упражнение</h2>
            <div className="max-h-64 space-y-1 overflow-auto">
              {exercises.filter((exercise) => exercise.type !== 'VOCAB_PACK').map((exercise) => (
                <label key={exercise.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-paper">
                  <input
                    type="checkbox"
                    checked={picked.includes(exercise.id)}
                    onChange={(event) => {
                      setPicked((current) =>
                        event.target.checked
                          ? [...current, exercise.id]
                          : current.filter((value) => value !== exercise.id),
                      )
                    }}
                  />
                  <span className="flex-1 text-[13px]">{exercise.title}</span>
                </label>
              ))}
            </div>
            <Button
              className="mt-3"
              disabled={picked.length === 0}
              onClick={async () => {
                if (!id) return
                setError('')
                try {
                  await api('/assignments', {
                    method: 'POST',
                    body: JSON.stringify({ studentId: id, exerciseIds: picked }),
                  })
                  setPicked([])
                  await load()
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Не удалось назначить')
                }
              }}
            >
              Назначить
            </Button>
            {error ? <p className="mt-2 text-seal">{error}</p> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
