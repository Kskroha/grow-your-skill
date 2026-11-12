import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.tsx'
import { ThemePicker } from '../components/ThemePicker.tsx'
import { Button, Field, TextInput } from '../components/ui.tsx'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('teacher@grow.local')
  const [password, setPassword] = useState('teacher123')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (user) {
    return <Navigate to={user.role === 'TEACHER' ? '/teacher' : '/student'} replace />
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const next = await login(email, password)
      navigate(next.role === 'TEACHER' ? '/teacher' : '/student')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не получилось войти. Проверьте email и пароль.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <aside className="flex flex-col justify-between bg-cedar px-6 py-8 text-white lg:w-[42%] lg:px-12 lg:py-12">
        <p className="text-[22px] font-semibold">Тренажёр</p>
        <div className="mt-8 lg:mt-0">
          <p className="text-[28px] font-semibold leading-tight lg:text-[36px]">Тренажёр корейского</p>
          <p className="mt-3 max-w-sm text-[15px] text-white/85">
            Кабинет учителя и учеников: задания, лексика и прогресс в одном месте.
          </p>
        </div>
      </aside>
      <div className="flex flex-1 items-start justify-center bg-paper px-6 py-10 lg:items-center">
        <form onSubmit={onSubmit} className="w-full max-w-[360px] space-y-4">
          <h1 className="text-[22px] font-semibold">Вход</h1>
          <Field label="Почта">
            <TextInput
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field label="Пароль">
            <TextInput
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>
          {error ? <p className="text-[13px] font-medium text-seal">{error}</p> : null}
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? 'Секунду…' : 'Войти'}
          </Button>
          <div className="pt-1">
            <p className="mb-2 text-[12px] text-ink-soft">Тема</p>
            <ThemePicker />
          </div>
        </form>
      </div>
    </div>
  )
}
