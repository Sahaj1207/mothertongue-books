import { useEffect, useState } from 'react'
import { useT } from '../lib/i18n'

/**
 * Shares a published book: the phone's own share sheet (WhatsApp, Messages…) where there is one,
 * otherwise the link is copied. The link shows the book's cover when pasted into most apps.
 */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false)
  const t = useT()

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2500)
    return () => clearTimeout(timer)
  }, [copied])

  async function share() {
    const url = new URL(path, window.location.origin).href
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch (e) {
        // The reader closed the share sheet; nothing to do.
        if (e instanceof DOMException && e.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt(t('reader.copyLink'), url)
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className="text-ink-soft underline underline-offset-4 hover:text-ink"
      aria-live="polite"
    >
      {copied ? t('reader.linkCopied') : t('reader.share')}
    </button>
  )
}
