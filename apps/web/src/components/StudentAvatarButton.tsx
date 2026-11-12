import { useRef, useState } from 'react'
import { api } from '../api.ts'
import { useAuth } from '../auth.tsx'
import { compressAvatar } from '../lib/compressAvatar.ts'
import type { AuthUser } from '../types.ts'
import { Avatar } from './ui.tsx'

export function StudentAvatarButton({ size = 40 }: { size?: number }) {
  const { user, patchUser } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const badge = Math.max(22, Math.round(size * 0.26))

  if (!user) return null

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        title="Сменить фото"
        aria-label="Сменить фото"
        disabled={busy}
        className="relative shrink-0 rounded-full outline-offset-2 hover:opacity-90 disabled:opacity-60"
        onClick={() => inputRef.current?.click()}
      >
        <Avatar name={user.name} src={user.avatarUrl} size={size} />
        <span
          className="pointer-events-none absolute flex items-center justify-center rounded-full bg-cedar text-white shadow"
          style={{ width: badge, height: badge, right: 2, bottom: 2 }}
        >
          <CameraIcon size={Math.round(badge * 0.55)} />
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (!file) return
          setBusy(true)
          setError('')
          try {
            const blob = await compressAvatar(file)
            const body = new FormData()
            body.append('file', blob, 'avatar.jpg')
            const next = await api<AuthUser>('/users/me/avatar', {
              method: 'PATCH',
              body,
            })
            patchUser({ avatarUrl: next.avatarUrl })
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Не получилось сохранить фото')
          } finally {
            setBusy(false)
          }
        }}
      />
      {error ? (
        <p className="mt-2 text-center text-[13px] text-seal">{error}</p>
      ) : busy ? (
        <p className="mt-2 text-center text-[13px] text-ink-soft">Сохраняю…</p>
      ) : null}
    </div>
  )
}

function CameraIcon({ size = 12 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} fill="none" aria-hidden>
      <path
        d="M3.2 12.2h9.6A1.2 1.2 0 0 0 14 11V6.8A1.2 1.2 0 0 0 12.8 5.6h-1.4l-.7-1.2H5.3l-.7 1.2H3.2A1.2 1.2 0 0 0 2 6.8V11a1.2 1.2 0 0 0 1.2 1.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="8" cy="8.6" r="2.1" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}
