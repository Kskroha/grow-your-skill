import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api.ts'
import { ActivityHeatmap } from '../../components/ActivityHeatmap.tsx'
import { Avatar, Button, Field, Form, TextInput } from '../../components/ui.tsx'
import type { StudentListItem } from '../../types.ts'

export function StudentsPage() {
  const [students, setStudents] = useState<StudentListItem[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [createdPassword, setCreatedPassword] = useState('')
  const [error, setError] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)

  async function load() {
    const data = await api<StudentListItem[]>('/users/students')
    setStudents(data)
  }

  useEffect(() => {
    load().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить учеников')
    })
  }, [])

  return (
    <div>
      <header className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[22px] font-semibold sm:text-[24px]">Ученики</h1>
          <p className="mt-1 text-[14px] text-ink-soft">{students.length} в кабинете</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => setInviteOpen((value) => !value)}>
          Добавить ученика
        </Button>
      </header>

      {inviteOpen ? (
        <div className="mb-4 rounded-2xl border border-line bg-paper p-4">
          <p className="mb-3 text-[13px] text-ink-soft">
            Логин создаёте вы и передаёте ученику — сам он зарегистрироваться не сможет.
          </p>
          <Form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
            onSubmit={async () => {
              setError('')
              setCreatedPassword('')
              try {
                const result = await api<{
                  student: StudentListItem
                  password: string
                }>('/users/students', {
                  method: 'POST',
                  body: JSON.stringify({
                    name,
                    email,
                    password: password || undefined,
                  }),
                })
                setCreatedPassword(result.password)
                setName('')
                setEmail('')
                setPassword('')
                await load()
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Не удалось создать ученика')
              }
            }}
          >
            <Field label="Имя">
              <TextInput value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Почта">
              <TextInput
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            <Field label="Пароль (необязательно)">
              <TextInput
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="сгенерируется сам"
              />
            </Field>
            <div className="flex items-end">
              <Button type="submit">Создать</Button>
            </div>
          </Form>
          {createdPassword ? (
            <p className="mt-3 text-[14px]">
              Пароль ученика: <span className="font-semibold">{createdPassword}</span>. Сохраните его —
              больше не покажем.
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mb-3 text-seal">{error}</p> : null}

      {students.length === 0 ? (
        <div className="rounded-2xl border border-line bg-paper px-5 py-12 text-center text-[14px] text-ink-soft">
          Пока никого нет — добавьте первого ученика.
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((student) => (
            <article
              key={student.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-paper p-4"
            >
              <Avatar name={student.name} src={student.avatarUrl} />
              <div className="min-w-0 flex-1">
                <div className="text-[16px] font-semibold">{student.name}</div>
                <div className="text-[13px] text-ink-soft">
                  {student.progress.completed}/{student.progress.total} сдано
                  {student.progress.averageScore !== null
                    ? ` · балл ${student.progress.averageScore}`
                    : ''}
                </div>
              </div>
              <div className="w-[140px]">
                <ActivityHeatmap events={student.activity} range="week" compact />
              </div>
              <Link
                to={`/teacher/students/${student.id}`}
                className="rounded-lg bg-cedar px-4 py-2 text-[14px] font-semibold text-white hover:bg-cedar-dark"
              >
                Открыть
              </Link>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
