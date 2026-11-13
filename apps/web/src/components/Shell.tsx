import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.tsx'
import { ThemePicker } from './ThemePicker.tsx'
import { Wordmark } from './ui.tsx'

const teacherLinks = [
  { to: '/teacher', label: 'Ученики', icon: UsersIcon },
  { to: '/teacher/catalog', label: 'Материалы', icon: FolderIcon },
]

const studentLinks = [
  { to: '/student', label: 'Мои задания', icon: TasksIcon },
  { to: '/student/progress', label: 'Прогресс', icon: ChartIcon },
]

export function Shell() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const links = user?.role === 'TEACHER' ? teacherLinks : studentLinks
  const player = location.pathname.includes('/play/')

  function signOut() {
    logout()
    navigate('/login')
  }

  if (player) {
    return (
      <div className="min-h-svh bg-paper">
        <Outlet />
      </div>
    )
  }

  return (
    <div className="flex min-h-svh flex-col bg-paper lg:flex-row">
      <aside className="hidden w-[220px] shrink-0 flex-col border-r border-line bg-paper lg:flex">
        <div className="flex items-start justify-between gap-2 px-4 py-4">
          <div className="min-w-0">
            <Wordmark />
            <p className="mt-1 truncate text-[12px] text-ink-soft">{user?.name}</p>
          </div>
          <LogoutButton onClick={signOut} />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {links.map((link) => (
            <SideLink key={link.to} {...link} />
          ))}
        </nav>
        <ThemePicker labeled />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-paper px-4 py-3 lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">{user?.name}</p>
          </div>
          <ThemePicker />
          <LogoutButton onClick={signOut} />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-4 pb-24 sm:px-5 sm:py-6 lg:pb-6">
          <Outlet />
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="grid grid-cols-2">
          {links.map((link) => {
            const Icon = link.icon
            return (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === '/teacher' || link.to === '/student'}
                className={({ isActive }) =>
                  `flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                    isActive ? 'text-cedar' : 'text-ink-soft'
                  }`
                }
              >
                <Icon />
                {link.label}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function SideLink({
  to,
  label,
  icon: Icon,
}: {
  to: string
  label: string
  icon: () => JSX.Element
}) {
  return (
    <NavLink
      to={to}
      end={to === '/teacher' || to === '/student'}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium ${
          isActive ? 'bg-cedar text-white' : 'text-ink-soft hover:bg-blush hover:text-ink'
        }`
      }
    >
      <Icon />
      {label}
    </NavLink>
  )
}

function LogoutButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      title="Выйти"
      aria-label="Выйти"
      className="rounded-lg p-2 text-ink-soft hover:bg-blush hover:text-cedar"
      onClick={onClick}
    >
      <LogoutIcon />
    </button>
  )
}

function TasksIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="none" aria-hidden>
      <rect x="3" y="3.5" width="14" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.5 8h7M6.5 11.5h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="none" aria-hidden>
      <path d="M4 15V9M10 15V5M16 15v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="none" aria-hidden>
      <circle cx="7" cy="8" r="2.4" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="13.2" cy="8.2" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.5 15c.4-2 2.1-3.2 3.6-3.2S10.2 13 10.5 15M11.2 12.2c1.4 0 3 .9 3.4 2.8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" aria-hidden>
      <path
        d="M8 4.5H5.5A1.5 1.5 0 0 0 4 6v8a1.5 1.5 0 0 0 1.5 1.5H8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8.5 10H16m0 0-2.5-2.5M16 10l-2.5 2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="none" aria-hidden>
      <path
        d="M3 6.2A1.7 1.7 0 0 1 4.7 4.5h3.1L9.5 6.2H15.3A1.7 1.7 0 0 1 17 7.9v6.4A1.7 1.7 0 0 1 15.3 16H4.7A1.7 1.7 0 0 1 3 14.3V6.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  )
}
