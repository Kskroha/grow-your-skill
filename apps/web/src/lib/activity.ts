export type ActivityAttempt = { at: string; score?: number }

export type ActivityEvents = {
  visits: string[]
  attempts: ActivityAttempt[]
}

export type ActivityDay = {
  date: string
  weekday: number
  visited: boolean
  attempts: number
  level: 0 | 1 | 2 | 3 | 4
}

export type ActivityRange = 'week' | 'month'

function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function localDayKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function parseDay(key: string) {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function shiftLocalDay(key: string, days: number) {
  const date = parseDay(key)
  date.setDate(date.getDate() + days)
  return localDayKey(date)
}

function startOfMonday(key: string) {
  const date = parseDay(key)
  const weekday = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - weekday)
  return localDayKey(date)
}

export function activityLevel(visited: boolean, attempts: number): ActivityDay['level'] {
  if (attempts >= 4) return 4
  if (attempts >= 2) return 3
  if (attempts >= 1) return 2
  if (visited) return 1
  return 0
}

export function buildActivityDays(events: ActivityEvents, range: ActivityRange, now = new Date()): ActivityDay[] {
  const today = localDayKey(now)
  const monday = startOfMonday(today)
  const start = range === 'week' ? shiftLocalDay(today, -6) : startOfMonday(shiftLocalDay(today, -27))
  const end = range === 'week' ? today : shiftLocalDay(monday, 6)

  const visits = new Set(events.visits.map(localDayKey))
  const attemptCount = new Map<string, number>()
  for (const attempt of events.attempts) {
    const key = localDayKey(attempt.at)
    attemptCount.set(key, (attemptCount.get(key) ?? 0) + 1)
  }

  const days: ActivityDay[] = []
  let cursor = start
  while (cursor <= end) {
    const visited = visits.has(cursor)
    const attempts = attemptCount.get(cursor) ?? 0
    days.push({
      date: cursor,
      weekday: (parseDay(cursor).getDay() + 6) % 7,
      visited,
      attempts,
      level: activityLevel(visited, attempts),
    })
    cursor = shiftLocalDay(cursor, 1)
  }
  return days
}

export function formatActivityDate(key: string) {
  return parseDay(key).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}
