export type Role = 'TEACHER' | 'STUDENT'
export type TopicKind = 'GRAMMAR' | 'VOCABULARY'
export type ExerciseType = 'MULTIPLE_CHOICE' | 'FILL_BLANK' | 'FLASHCARDS' | 'VOCAB_PACK'
export type PracticeTool = 'FLASHCARDS' | 'TEST' | 'WRITE' | 'SPEAK' | 'YES_NO'
export type AssignmentStatus = 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED'

export type AuthUser = {
  id: string
  email: string
  name: string
  role: Role
  avatarUrl?: string | null
}

export type VocabWord = { ko: string; ru: string; roman?: string }

export type PackToolSummary = {
  key: PracticeTool
  label: string
  done: boolean
  percent: number
  needsRetry?: boolean
}

export type Topic = {
  id: string
  title: string
  description: string
  kind: TopicKind
  words?: VocabWord[]
  _count?: { exercises: number }
  exercises?: Exercise[]
}

export type McItem = {
  prompt: string
  options: Array<{ id: string; text: string; correct?: boolean }>
}

export type FillItem = {
  prompt: string
  answer?: string
  hint?: string
}

export type FlashCard = {
  front: string
  back: string
  hint?: string
}

export type Exercise = {
  id: string
  title: string
  prompt: string
  type: ExerciseType
  payload: {
    items?: Array<McItem | FillItem | { prompt: string; answer?: string; ko?: string; ru?: string; correct?: boolean }>
    cards?: FlashCard[]
    words?: VocabWord[]
    tools?: PracticeTool[]
    activities?: {
      FLASHCARDS?: { cards: FlashCard[] }
      TEST?: { items: McItem[] }
      WRITE?: { items: FillItem[] }
      SPEAK?: { items: FillItem[] }
      YES_NO?: { items: Array<{ ko: string; ru: string; correct?: boolean }> }
    }
  }
  topicId: string
  topic?: Pick<Topic, 'id' | 'title' | 'kind'>
}

export type Attempt = {
  id: string
  score: number
  maxScore: number
  createdAt: string
  review?: {
    items: Array<{ correct: boolean; expected?: string; selected?: string }>
  }
}

export type PlayProgress = {
  step?: number
  selected?: string[]
  texts?: string[]
  heard?: string[]
  known?: boolean[]
  marked?: boolean[]
  answers?: boolean[]
  done?: boolean
  retry?: boolean
  queue?: number[]
  currentTool?: PracticeTool | null
  tools?: Partial<Record<PracticeTool, PlayProgress>>
  feedback?: Array<{ correct: boolean; expected: string; expectedId?: string } | null>
}

export type Assignment = {
  id: string
  status: AssignmentStatus
  bestScore: number | null
  dueAt: string | null
  createdAt: string
  completedAt: string | null
  progress?: PlayProgress | null
  progressPercent?: number
  packTools?: PackToolSummary[]
  student: { id: string; name: string; email: string }
  exercise: Exercise
  attempts: Attempt[]
}

export type StudentListItem = {
  id: string
  email: string
  name: string
  avatarUrl?: string | null
  createdAt: string
  progress: {
    total: number
    completed: number
    averageScore: number | null
    lastActiveAt: string | null
  }
  activity: {
    visits: string[]
    attempts: Array<{ at: string; score?: number }>
  }
}

export type ProgressPayload = {
  student: { id: string; name: string; email: string; avatarUrl?: string | null }
  totals: {
    total: number
    completed: number
    averageScore: number | null
    streakDays: number
  }
  byKind: Array<{
    kind: TopicKind
    total: number
    completed: number
    averageScore: number | null
  }>
  byTopic: Array<{
    topicId: string
    title: string
    kind: TopicKind
    total: number
    completed: number
  }>
  practiced: Array<{
    id: string
    title: string
    topicTitle: string
    kind: TopicKind
    bestScore: number | null
  }>
  activity: {
    visits: string[]
    attempts: Array<{ at: string; score: number }>
  }
}
