import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.ts'
import type { PackToolSummary } from '../types.ts'

export function AssignmentCard({
  id,
  topicTitle,
  exerciseTitle,
  done,
  started = false,
  percent = 0,
  tools,
  onRestarted,
}: {
  id: string
  topicTitle?: string
  exerciseTitle: string
  done: boolean
  started?: boolean
  percent?: number
  tools?: PackToolSummary[]
  onRestarted?: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const shownPercent = done ? 100 : percent

  async function restart() {
    if (pending) return
    setPending(true)
    setError('')
    try {
      await api(`/assignments/${id}/restart`, { method: 'POST' })
      onRestarted?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не получилось сбросить задание')
    } finally {
      setPending(false)
    }
  }

  return (
    <article
      className={`flex flex-col rounded-2xl border p-4 ${
        done
          ? 'border-mint/30 bg-mint/[0.07]'
          : tools?.some((tool) => tool.needsRetry)
            ? 'border-amber-300/70 bg-amber-50/60'
            : 'border-line bg-paper'
      }`}
    >
      <div className="flex items-start gap-3">
        {done ? (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint text-white">
            <CheckIcon />
          </span>
        ) : (
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-line">
            <span className="h-2 w-2 rounded-full bg-line" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-semibold leading-snug">{topicTitle}</h3>
          {tools && tools.length > 0 ? null : (
            <p className="mt-0.5 text-[13px] text-ink-soft">{exerciseTitle}</p>
          )}
          {tools && tools.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {tools.map((tool) => (
                <li key={tool.key} className="flex items-center gap-2 text-[13px]">
                  <span
                    className={
                      tool.done || done
                        ? 'text-mint'
                        : tool.needsRetry
                          ? 'text-amber-600'
                          : 'text-ink-soft'
                    }
                  >
                    {tool.done || done ? '✓' : tool.needsRetry ? '!' : '○'}
                  </span>
                  <span
                    className={
                      tool.done || done ? 'text-ink' : tool.needsRetry ? 'text-amber-800' : 'text-ink-soft'
                    }
                  >
                    {tool.label}
                    {tool.needsRetry ? ' · повторить ошибки' : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="mt-auto pt-4">
        {done ? null : (
          <>
            <div className="mb-1.5 flex items-center justify-between text-[12px] font-medium text-ink-soft">
              <span>{started ? 'Начато' : 'Ещё не начато'}</span>
              <span>{shownPercent}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full ${shownPercent > 0 ? 'bg-cedar' : 'bg-cedar/30'}`}
                style={{ width: `${shownPercent}%` }}
              />
            </div>
          </>
        )}
        <div className={`flex flex-wrap items-stretch gap-2 ${done ? '' : 'mt-4'}`}>
          <Link
            to={`/student/play/${id}`}
            className={`inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 py-2 text-center text-[14px] font-semibold sm:flex-none ${
              done
                ? 'border border-mint/40 bg-paper text-mint hover:bg-mint/10'
                : 'bg-cedar text-white hover:bg-cedar-dark'
            }`}
          >
            {done ? 'Повторить' : started ? 'Продолжить' : 'Выполнить'}
          </Link>
          {done ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => void restart()}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg px-4 py-2 text-[14px] font-semibold text-ink-soft hover:bg-paper hover:text-ink disabled:opacity-60 sm:flex-none"
            >
              {pending ? 'Сбрасываю…' : 'Пройти заново'}
            </button>
          ) : null}
        </div>
        {error ? <p className="mt-2 text-[12px] text-seal">{error}</p> : null}
      </div>
    </article>
  )
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" aria-hidden>
      <path
        d="M3.5 8.2 6.4 11l6.1-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
