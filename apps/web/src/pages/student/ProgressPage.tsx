import { useEffect, useState } from 'react'
import { api } from '../../api.ts'
import { useAuth } from '../../auth.tsx'
import { ActivityHeatmap } from '../../components/ActivityHeatmap.tsx'
import { AssignmentCard } from '../../components/AssignmentCard.tsx'
import { StudentAvatarButton } from '../../components/StudentAvatarButton.tsx'
import { Meter } from '../../components/ui.tsx'
import type { ProgressPayload } from '../../types.ts'

export function ProgressPage() {
  const { user } = useAuth()
  const [progress, setProgress] = useState<ProgressPayload | null>(null)
  const [error, setError] = useState('')

  function load() {
    api<ProgressPayload>('/progress/me')
      .then(setProgress)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить прогресс')
      })
  }

  useEffect(() => {
    load()
  }, [])

  if (error) return <p className="text-seal">{error}</p>
  if (!progress) return <p className="text-ink-soft">Считаю отметки…</p>

  return (
    <div>
      <header className="mb-4 flex items-center gap-4 rounded-2xl border border-line bg-paper p-4 sm:mb-5 sm:gap-5 sm:p-5">
        <StudentAvatarButton size={80} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[22px] font-semibold sm:text-[24px]">Прогресс</h1>
          <p className="mt-1 text-[16px] font-medium sm:text-[18px]">{user?.name}</p>
          <p className="mt-1 text-[13px] text-ink-soft">Нажмите на фото, чтобы сменить</p>
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-paper p-4">
          <div className="text-[12px] font-medium text-ink-soft">Сдано</div>
          <div className="stat mt-1 text-[28px] text-cedar">
            {progress.totals.completed}
            <span className="text-[16px] font-medium text-ink-soft">/{progress.totals.total}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <div className="text-[12px] font-medium text-ink-soft">Средний балл</div>
          <div className="stat mt-1 text-[28px]">{progress.totals.averageScore ?? '—'}</div>
        </div>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <div className="text-[12px] font-medium text-ink-soft">Серия</div>
          <div className="stat mt-1 text-[28px]">{progress.totals.streakDays} дн.</div>
        </div>
      </div>

      <div className={`mt-4 grid gap-4 ${progress.byTopic.length > 0 ? 'lg:grid-cols-[1.2fr_1fr]' : ''}`}>
        <div className="rounded-2xl border border-line bg-paper p-4">
          <h2 className="mb-3 text-[14px] font-semibold">Активность</h2>
          <ActivityHeatmap events={progress.activity} defaultRange="week" />
        </div>
        {progress.byTopic.length > 0 ? (
          <div className="rounded-2xl border border-line bg-paper p-4">
            <h2 className="mb-3 text-[14px] font-semibold">По темам</h2>
            <div className="space-y-3">
              {progress.byTopic.map((topic) => (
                <Meter key={topic.topicId} label={topic.title} value={topic.completed} total={topic.total} />
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {progress.practiced.length > 0 ? (
        <section className="mt-4">
          <h2 className="mb-3 text-[14px] font-semibold">Пройденные задания</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {progress.practiced.map((item) => (
              <AssignmentCard
                key={item.id}
                id={item.id}
                topicTitle={item.topicTitle}
                exerciseTitle={item.title}
                done
                onRestarted={load}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
