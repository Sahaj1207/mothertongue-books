import { useEffect } from 'react'

/** The browser tab and history show where you are: "ಸತ್ಯ ಹೇಳುವ ಪುಣ್ಯಕೋಟಿ · MotherTongue Books". */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · MotherTongue Books` : 'MotherTongue Books'
  }, [title])
}
