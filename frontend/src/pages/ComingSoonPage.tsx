import { Link } from 'react-router-dom'

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-20 text-center">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">{title}</h1>
      <p className="mt-2 text-ink-soft">This page is being built.</p>
      <Link to="/" className="mt-6 inline-block font-medium underline underline-offset-4">
        Back to the library
      </Link>
    </main>
  )
}
