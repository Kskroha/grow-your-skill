import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export const THEME_KEY = 'haru-theme'

export const themes = [
  { id: 'black', label: 'Чёрный', swatch: '#1a1a1a' },
  { id: 'pink', label: 'Розовый', swatch: '#e85a8c' },
  { id: 'teal', label: 'Бирюзовый', swatch: '#1aa7a1' },
  { id: 'blue', label: 'Синий', swatch: '#3b6fe0' },
] as const

export type ThemeId = (typeof themes)[number]['id']

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((theme) => theme.id === value)
}

const ThemeContext = createContext<{
  theme: ThemeId
  setTheme: (id: ThemeId) => void
} | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemeId>(() => {
    const stored = localStorage.getItem(THEME_KEY)
    if (stored === 'coral') return 'black'
    return isThemeId(stored) ? stored : 'black'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('ThemeProvider is missing')
  }
  return ctx
}
