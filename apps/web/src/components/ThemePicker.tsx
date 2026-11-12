import { themes, useTheme } from '../theme.tsx'

export function ThemePicker({ labeled = false }: { labeled?: boolean }) {
  const { theme, setTheme } = useTheme()

  return (
    <div className={labeled ? 'px-2 pb-4 lg:px-4' : ''}>
      {labeled ? (
        <p className="mb-2 hidden text-[11px] font-medium text-ink-soft lg:block">Тема</p>
      ) : null}
      <div
        className={
          labeled
            ? 'flex flex-col items-center gap-1.5 lg:flex-row lg:flex-wrap lg:justify-start'
            : 'flex flex-wrap items-center gap-1.5'
        }
      >
        {themes.map((item) => {
          const active = theme === item.id
          return (
            <button
              key={item.id}
              type="button"
              title={item.label}
              aria-label={item.label}
              aria-pressed={active}
              className={`h-5 w-5 rounded-full ${
                active ? 'ring-2 ring-ink ring-offset-2 ring-offset-paper' : 'ring-1 ring-line'
              }`}
              style={{ backgroundColor: item.swatch }}
              onClick={() => setTheme(item.id)}
            />
          )
        })}
      </div>
    </div>
  )
}
