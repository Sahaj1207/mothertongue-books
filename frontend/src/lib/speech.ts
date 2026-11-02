import { useEffect, useState } from 'react'
import { api, type AnyLanguage } from './api'
import { languageDisplay } from './languages'

/** Languages Meta's MMS voices read on the server (backend/app/speech.py); the rest use the device's voice. */
const META_VOICES = new Set<AnyLanguage>(['kn', 'te', 'mr', 'sw', 'ht', 'eu'])

/** A voice for the language on this device, if it has one. Voices load asynchronously in most browsers. */
export function useVoice(language: AnyLanguage): SpeechSynthesisVoice | null {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const prefix = languageDisplay(language).speech.slice(0, 2)
    const pick = () =>
      setVoice(speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefix)) ?? null)
    pick()
    speechSynthesis.addEventListener('voiceschanged', pick)
    return () => speechSynthesis.removeEventListener('voiceschanged', pick)
  }, [language])
  return voice
}

type Kind = 'page' | 'word'
const DEVICE_RATE: Record<Kind, number> = { page: 0.85, word: 0.8 }

// One thing is read at a time on the whole page: tapping a word stops the page being read.
let playing: { onEnd?: () => void } | null = null
let audio: HTMLAudioElement | null = null
const clips = new Map<string, Promise<string>>()
const ready = new Map<string, string>()

export function stopSpeaking() {
  const was = playing
  playing = null
  audio?.pause()
  if ('speechSynthesis' in window) speechSynthesis.cancel()
  was?.onEnd?.()
}

function clip(bookId: string, language: AnyLanguage, text: string): Promise<string> {
  const key = `${bookId}|${language}|${text}`
  let url = clips.get(key)
  if (!url) {
    url = api.speech({ book_id: bookId, language, text }).then((r) => {
      ready.set(key, r.url)
      return r.url
    })
    url.catch(() => clips.delete(key))
    clips.set(key, url)
  }
  return url
}

function deviceSay(voice: SpeechSynthesisVoice, text: string, kind: Kind, onEnd?: () => void) {
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.voice = voice
  utterance.lang = voice.lang
  utterance.rate = DEVICE_RATE[kind]
  utterance.onend = utterance.onerror = () => onEnd?.()
  speechSynthesis.speak(utterance)
}

/**
 * Reads a book's text aloud: Meta's voice from the server where we have one (any browser), otherwise
 * the device's voice. `available` is false when neither exists, so no button stays silent.
 */
export function useSpeaker(language: AnyLanguage, bookId?: string | null) {
  const voice = useVoice(language)
  const meta = Boolean(bookId) && META_VOICES.has(language)

  /** Asks for clips ahead of time, so pressing a button plays at once. */
  function prepare(texts: string[]) {
    if (meta) for (const text of texts) if (text) clip(bookId!, language, text).catch(() => {})
  }

  function say(text: string, kind: Kind, onEnd?: () => void) {
    stopSpeaking()
    if (!text) return onEnd?.()
    const mine = { onEnd }
    playing = mine
    const finish = () => {
      if (playing !== mine) return
      playing = null
      onEnd?.()
    }
    const fallBack = () => {
      if (playing !== mine) return
      if (voice) deviceSay(voice, text, kind, finish)
      else finish()
    }
    if (!meta) return fallBack()

    audio ??= new Audio()
    const player = audio
    const start = (url: string) => {
      if (playing !== mine) return
      player.src = url
      player.onended = finish
      player.onerror = fallBack
      // Started inside the tap when the clip is already known, which Safari requires.
      player.play().catch(fallBack)
    }
    const known = ready.get(`${bookId}|${language}|${text}`)
    if (known) start(known)
    else clip(bookId!, language, text).then(start, fallBack)
  }

  return { available: meta || voice !== null, say, prepare }
}
