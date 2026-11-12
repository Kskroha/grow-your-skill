import { useMemo, useState } from 'react'
import {
  buildActivityDays,
  formatActivityDate,
  type ActivityDay,
  type ActivityEvents,
  type ActivityRange,
} from '../lib/activity.ts'

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
const LEVEL_CLASS = [
  'bg-line',
  'bg-blush',
  'bg-cedar/45',
  'bg-cedar',
  'bg-cedar-dark',
]

function attemptsLabel(count: number) {
  const mod10 = count % 10
  const mod100 = count % 100
  if (mod10 === 1 && mod100 !== 11) return `${count} попытка`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} попытки`
  return `${count} попыток`
}

function cellLabel(day: ActivityDay) {
  const when = formatActivityDate(day.date)
  if (day.attempts === 0 && !day.visited) {
    return `${when}: тихо`
  }
  const bits = [when]
  if (day.visited) bits.push('вход')
  if (day.attempts > 0) bits.push(attemptsLabel(day.attempts))
  return bits.join(' · ')
}

function MonthGrid({
  days,
  selected,
  onSelect,
  compact,
}: {
  days: ActivityDay[]
  selected: string | null
  onSelect: (date: string) => void
  compact?: boolean
}) {
  const weeks: ActivityDay[][] = []
  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7))
  }
  const size = compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5'

  return (
    <div className="flex gap-3">
      <div className={`flex flex-col justify-between py-0.5 text-[10px] text-ink-soft ${compact ? 'hidden' : ''}`}>
        {WEEKDAYS.map((label, index) => (
          <span key={label} className={index % 2 === 1 ? 'invisible' : ''}>
            {label}
          </span>
        ))}
      </div>
      <div className="flex gap-[3px]">
        {weeks.map((week) => (
          <div key={week[0]?.date} className="flex flex-col gap-[3px]">
            {week.map((day) => (
              <button
                key={day.date}
                type="button"
                aria-label={cellLabel(day)}
                aria-pressed={selected === day.date}
                title={cellLabel(day)}
                onClick={() => onSelect(day.date)}
                className={`${size} rounded-[3px] ${LEVEL_CLASS[day.level]} ${
                  selected === day.date ? 'ring-2 ring-ink ring-offset-1' : ''
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function WeekRow({
  days,
  selected,
  onSelect,
  compact,
}: {
  days: ActivityDay[]
  selected: string | null
  onSelect: (date: string) => void
  compact?: boolean
}) {
  const size = compact ? 'h-3 w-3' : 'h-8 w-8'
  return (
    <div className="grid grid-cols-7 gap-[3px]">
      {days.map((day) => (
        <div key={day.date} className="min-w-0">
          {compact ? null : (
            <div className="mb-1 text-center text-[10px] text-ink-soft">{WEEKDAYS[day.weekday]}</div>
          )}
          {compact ? (
            <span
              title={cellLabel(day)}
              className={`${size} block w-full rounded-[4px] ${LEVEL_CLASS[day.level]}`}
            />
          ) : (
            <button
              type="button"
              aria-label={cellLabel(day)}
              aria-pressed={selected === day.date}
              title={cellLabel(day)}
              onClick={() => onSelect(day.date)}
              className={`${size} w-full rounded-[4px] ${LEVEL_CLASS[day.level]} ${
                selected === day.date ? 'ring-2 ring-ink ring-offset-1' : ''
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

export function ActivityHeatmap({
  events,
  range: lockedRange,
  defaultRange = 'week',
  compact = false,
}: {
  events: ActivityEvents
  range?: ActivityRange
  defaultRange?: ActivityRange
  compact?: boolean
}) {
  const [range, setRange] = useState<ActivityRange>(lockedRange ?? defaultRange)
  const [selected, setSelected] = useState<string | null>(null)
  const activeRange = lockedRange ?? range
  const days = useMemo(() => buildActivityDays(events, activeRange), [events, activeRange])
  const picked = days.find((day) => day.date === selected) ?? [...days].reverse().find((day) => day.level > 0)
  const showToggle = !lockedRange && !compact

  return (
    <div>
      {showToggle ? (
        <div className="mb-3 flex gap-1">
          {(['week', 'month'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setRange(value)
                setSelected(null)
              }}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium ${
                activeRange === value ? 'bg-cedar text-white' : 'bg-paper text-ink-soft'
              }`}
            >
              {value === 'week' ? 'Неделя' : 'Месяц'}
            </button>
          ))}
        </div>
      ) : null}
      {activeRange === 'week' ? (
        <WeekRow days={days} selected={selected} onSelect={setSelected} compact={compact} />
      ) : (
        <MonthGrid days={days} selected={selected} onSelect={setSelected} compact={compact} />
      )}
      {compact ? null : (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-ink-soft">
          <p>{picked ? cellLabel(picked) : 'Пока нет активности.'}</p>
          <p className="flex items-center gap-1">
            меньше
            {LEVEL_CLASS.map((tone) => (
              <span key={tone} className={`h-2.5 w-2.5 rounded-[3px] ${tone}`} />
            ))}
            больше
          </p>
        </div>
      )}
    </div>
  )
}
