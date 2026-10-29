import { Component, type ReactNode } from 'react'

interface State {
  failed: boolean
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="mx-auto max-w-xl px-4 py-20 text-center">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">This page stopped working</h1>
        <p className="mt-2 text-ink-soft">Reload the page to try again. Your books are saved.</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-on-ink hover:bg-ink-soft"
        >
          Reload
        </button>
      </main>
    )
  }
}
