import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth.tsx'
import { Shell } from './components/Shell.tsx'
import { LoginPage } from './pages/LoginPage.tsx'
import { PlayPage } from './pages/student/PlayPage.tsx'
import { ProgressPage } from './pages/student/ProgressPage.tsx'
import { StudentHome } from './pages/student/StudentHome.tsx'
import { CatalogPage } from './pages/teacher/CatalogPage.tsx'
import { StudentDetailPage } from './pages/teacher/StudentDetailPage.tsx'
import { StudentsPage } from './pages/teacher/StudentsPage.tsx'
import type { Role } from './types.ts'

function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="p-8 text-[14px] text-ink-soft">Секунду…</div>
  }
  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (user.role !== role) {
    return <Navigate to={user.role === 'TEACHER' ? '/teacher' : '/student'} replace />
  }
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/student"
        element={
          <Guard role="STUDENT">
            <Shell />
          </Guard>
        }
      >
        <Route index element={<StudentHome />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="play/:id" element={<PlayPage />} />
      </Route>
      <Route
        path="/teacher"
        element={
          <Guard role="TEACHER">
            <Shell />
          </Guard>
        }
      >
        <Route index element={<StudentsPage />} />
        <Route path="students/:id" element={<StudentDetailPage />} />
        <Route path="catalog" element={<CatalogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
