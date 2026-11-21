export function registerPwa() {
  if (!('serviceWorker' in navigator)) return

  const register = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })

      const refresh = () => {
        void registration.update()
      }

      // Pick up a new build soon after deploy.
      window.setInterval(refresh, 60_000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refresh()
      })
      window.addEventListener('focus', refresh)

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing
        if (!worker) return
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version ready: activate immediately and reload once.
            worker.postMessage('SKIP_WAITING')
          }
        })
      })

      let refreshing = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return
        refreshing = true
        window.location.reload()
      })
    } catch {
      // Installability still works via manifest if SW registration fails temporarily.
    }
  }

  if (document.readyState === 'complete') void register()
  else window.addEventListener('load', () => void register())
}
