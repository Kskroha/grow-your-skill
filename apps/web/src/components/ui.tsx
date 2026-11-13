import { useEffect, useId, useRef, useState } from 'react'
import type {
  ButtonHTMLAttributes,
  CSSProperties,
  FormEvent,
  InputHTMLAttributes,
  ReactNode,
} from 'react'
import type { AssignmentStatus, TopicKind } from '../types.ts'

export function Wordmark() {
  return <p className="hangul text-[15px] font-semibold leading-none text-ink">한국어 연습</p>
}

export function KindBadge({ kind }: { kind: TopicKind }) {
  const ru = kind === 'GRAMMAR' ? 'Грамматика' : 'Слова'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        kind === 'GRAMMAR' ? 'bg-cedar/10 text-cedar-dark' : 'bg-amber-100 text-amber-800'
      }`}
    >
      {ru}
    </span>
  )
}

export function Avatar({
  name,
  src,
  size = 40,
}: {
  name: string
  src?: string | null
  size?: number
}) {
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="inline-block shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-cedar font-semibold text-white"
      style={{ width: size, height: size, fontSize: Math.max(12, size * 0.38) }}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

export function HomeworkChip({
  status,
  score,
}: {
  status: AssignmentStatus
  score?: number | null
}) {
  if (status === 'COMPLETED') {
    return (
      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-700">
        Сдано{score != null ? ` · ${score}` : ''}
      </span>
    )
  }
  if (status === 'IN_PROGRESS') {
    return (
      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
        В работе
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-600">
      Новое
    </span>
  )
}

export function StatusMark({ status }: { status: AssignmentStatus }) {
  const label =
    status === 'COMPLETED' ? 'Готово' : status === 'IN_PROGRESS' ? 'Продолжить' : 'Начать'
  const color =
    status === 'COMPLETED' ? 'text-mint' : status === 'IN_PROGRESS' ? 'text-cedar' : 'text-ink-soft'
  return <span className={`text-[13px] font-medium ${color}`}>{label}</span>
}

export function Ring({ value, size = 40 }: { value: number; size?: number }) {
  const stroke = 4
  const radius = (size - stroke) / 2
  const circ = 2 * Math.PI * radius
  const offset = circ - (Math.min(100, Math.max(0, value)) / 100) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-line)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-cedar)"
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="54%"
        textAnchor="middle"
        dominantBaseline="middle"
        fontFamily="Pretendard Variable, Pretendard, sans-serif"
        fontWeight="650"
        fontSize={size * 0.28}
        fill="var(--color-ink)"
      >
        {Math.round(value)}
      </text>
    </svg>
  )
}

export function Meter({
  label,
  value,
  total,
}: {
  label: string
  value: number
  total: number
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100)
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px] text-ink-soft">
        <span>{label}</span>
        <span>
          {value} из {total}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-sm bg-line">
        <div className="h-full bg-cedar" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-ink-soft">{label}</span>
      {children}
    </label>
  )
}

const fieldClass =
  'w-full rounded border border-line bg-cream px-2.5 py-1.5 text-[14px] outline-none focus:border-cedar'

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClass} ${props.className ?? ''}`} />
}

export function Select({
  value,
  onChange,
  options,
  disabled,
  className = '',
}: {
  value: string
  onChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  disabled?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const selected = options.find((option) => option.value === value) ?? options[0]

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (!options.length) return
      const index = options.findIndex((option) => option.value === value)
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        const next = options[(index + 1) % options.length]
        onChange(next.value)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        const next = options[(index - 1 + options.length) % options.length]
        onChange(next.value)
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, options, value, onChange])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className={`${fieldClass} flex items-center justify-between gap-3 text-left`}
      >
        <span className="min-w-0 truncate">{selected?.label ?? 'Выберите'}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`h-4 w-4 shrink-0 text-ink-soft transition-transform ${open ? 'rotate-180' : ''}`}
        >
          <path
            fill="currentColor"
            d="M4.2 6.2a.75.75 0 0 1 1.06 0L8 8.94l2.74-2.74a.75.75 0 1 1 1.06 1.06l-3.27 3.27a.75.75 0 0 1-1.06 0L4.2 7.26a.75.75 0 0 1 0-1.06Z"
          />
        </svg>
      </button>
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded border border-line bg-cream py-1 shadow-sm"
        >
          {options.map((option) => {
            const active = option.value === value
            return (
              <li key={option.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  className={`flex w-full px-2.5 py-1.5 text-left text-[14px] ${
                    active ? 'bg-blush text-cedar-dark' : 'text-ink hover:bg-paper'
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault()
                    onChange(option.value)
                    setOpen(false)
                  }}
                >
                  {option.label}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}

export function Button({
  children,
  tone = 'cedar',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'cedar' | 'ink' | 'ghost' }) {
  const styles: Record<string, string> = {
    cedar: 'bg-cedar text-white hover:bg-cedar-dark',
    ink: 'bg-ink text-white hover:bg-ink/90',
    ghost: 'border border-line bg-cream text-ink hover:bg-paper',
  }
  return (
    <button
      type={type}
      {...props}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-[14px] font-semibold disabled:opacity-50 ${styles[tone]} ${props.className ?? ''}`}
    >
      {children}
    </button>
  )
}

export function ResultChip({
  correct,
  expected,
}: {
  correct: boolean
  expected?: string
}) {
  return (
    <div className={`result-chip ${correct ? 'result-chip--ok' : 'result-chip--no'}`}>
      <span className="result-mark" aria-hidden>
        {correct ? (
          <svg viewBox="0 0 20 20" className="result-mark-icon" fill="none">
            <path
              d="M4.5 10.5 8.2 14.2 15.5 6.2"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 20 20" className="result-mark-icon" fill="none">
            <path
              d="M6 6l8 8M14 6l-8 8"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        )}
      </span>
      {correct ? (
        <span className="result-title">Верно</span>
      ) : expected ? (
        <span className="hangul result-answer">{expected}</span>
      ) : null}
    </div>
  )
}

export function ResultNav({
  last,
  onNext,
  onDone,
  doneLabel = 'Завершить',
  pending,
  align = 'end',
  compact,
}: {
  last: boolean
  onNext: () => void
  onDone: () => void
  doneLabel?: string
  pending?: boolean
  align?: 'start' | 'center' | 'end'
  compact?: boolean
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Enter' || event.isComposing || pending) return
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'TEXTAREA') return
      if (tag === 'INPUT' && !(event.target as HTMLInputElement).disabled) return
      event.preventDefault()
      if (last) onDone()
      else onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [last, onDone, onNext, pending])

  return (
    <div
      className={`result-nav flex h-14 sm:h-12 ${compact ? '' : 'mt-6'} ${
        align === 'center' ? 'justify-center' : align === 'start' ? 'justify-start' : 'justify-end'
      }`}
    >
      <button
        type="button"
        disabled={pending}
        aria-label={pending ? 'Сохраняю…' : last ? doneLabel : 'Дальше'}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-cedar text-white hover:bg-cedar-dark disabled:opacity-50 sm:h-12 sm:w-12"
        onClick={last ? onDone : onNext}
      >
        {pending ? (
          <span className="text-[16px]">…</span>
        ) : (
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
            <path
              d="M4 10h12m0 0-4.5-4.5M16 10l-4.5 4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>
    </div>
  )
}

export function Block({
  title,
  action,
  children,
  className = '',
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`border border-line bg-cream ${className}`}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  )
}

export function Panel({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <section className={`border border-line bg-cream ${className}`} style={style}>
      {children}
    </section>
  )
}

export function Form({
  onSubmit,
  children,
  className = '',
}: {
  onSubmit: (event: FormEvent) => void
  children: ReactNode
  className?: string
}) {
  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(event)
      }}
    >
      {children}
    </form>
  )
}

export function Stat({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[12px] text-ink-soft">{label}</span>
      <span className="stat text-[18px] leading-none">{value}</span>
    </div>
  )
}
