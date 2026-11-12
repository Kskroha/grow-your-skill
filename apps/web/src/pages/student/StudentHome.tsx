import { useEffect, useState } from 'react'
import { api } from '../../api.ts'
import { useAuth } from '../../auth.tsx'
import { AssignmentCard } from '../../components/AssignmentCard.tsx'
import type { Assignment } from '../../types.ts'

export function StudentHome() {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [error, setError] = useState('')

  function load() {
    api<Assignment[]>('/assignments')
      .then(setAssignments)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Не получилось загрузить задания. Обновите страницу.')
      })
  }

  useEffect(() => {
    load()
  }, [])

  const open = assignments.filter((item) => item.status !== 'COMPLETED')
  const done = assignments.filter((item) => item.status === 'COMPLETED')

  return (
    <div>
      <header className="mb-5">
        <h1 className="text-[24px] font-semibold">Мои задания</h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          {user?.name}
          {open.length > 0 ? ` · открыто ${open.length}` : assignments.length > 0 ? ' · всё сдано' : ''}
        </p>
      </header>

      {error ? <p className="text-seal">{error}</p> : null}

      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-line bg-paper px-5 py-12 text-center text-[14px] text-ink-soft">
          Учитель ещё не назначил упражнения.
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
              Нужно выполнить
            </h2>
            {open.length === 0 ? (
              <div className="rounded-2xl border border-line bg-paper px-5 py-8 text-center text-[14px] text-ink-soft">
                Всё сдано — можно повторить выполненное ниже.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {open.map((item) => (
                  <AssignmentCard
                    key={item.id}
                    id={item.id}
                    topicTitle={item.exercise.topic?.title}
                    exerciseTitle={item.exercise.title}
                    started={item.status === 'IN_PROGRESS' || (item.progressPercent ?? 0) > 0}
                    percent={item.progressPercent ?? 0}
                    tools={item.packTools}
                    done={false}
                    onRestarted={load}
                  />
                ))}
              </div>
            )}
          </section>

          {done.length > 0 ? (
            <section>
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-soft">
                Выполненные
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {done.map((item) => (
                  <AssignmentCard
                    key={item.id}
                    id={item.id}
                    topicTitle={item.exercise.topic?.title}
                    exerciseTitle={item.exercise.title}
                    tools={item.packTools}
                    done
                    onRestarted={load}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  )
}
