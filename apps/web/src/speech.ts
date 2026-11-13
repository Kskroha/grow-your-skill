type SpeechCtor = new () => KoreanSpeech

export type KoreanSpeech = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives?: number
  start: () => void
  abort?: () => void
  onresult: ((event: {
    resultIndex: number
    results: ArrayLike<{ isFinal: boolean } & ArrayLike<{ transcript: string }>>
  }) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

function speechCtor(): SpeechCtor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechCtor
    webkitSpeechRecognition?: SpeechCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function startKoreanSpeech(handlers: {
  onCaption: (text: string, isFinal: boolean) => void
  onError: (code: string) => void
  onEnd: () => void
}): boolean {
  const Ctor = speechCtor()
  if (!Ctor) return false

  const html = document.documentElement
  const previousLang = html.getAttribute('lang')
  html.setAttribute('lang', 'ko')

  const recognition = new Ctor()
  recognition.continuous = false
  recognition.interimResults = true
  if (recognition.maxAlternatives !== undefined) recognition.maxAlternatives = 1
  recognition.lang = 'ko-KR'

  const restore = () => {
    if (previousLang) html.setAttribute('lang', previousLang)
    else html.removeAttribute('lang')
  }

  recognition.onresult = (event) => {
    let interim = ''
    let finalText = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const piece = event.results[i]?.[0]?.transcript ?? ''
      if (event.results[i]?.isFinal) finalText += piece
      else interim += piece
    }
    if (finalText.trim()) handlers.onCaption(finalText.trim(), true)
    else if (interim.trim()) handlers.onCaption(interim.trim(), false)
  }
  recognition.onerror = (event) => {
    handlers.onError(event.error)
  }
  recognition.onend = () => {
    restore()
    handlers.onEnd()
  }

  recognition.lang = 'ko-KR'
  try {
    recognition.start()
  } catch {
    restore()
    handlers.onEnd()
    return false
  }
  return true
}
