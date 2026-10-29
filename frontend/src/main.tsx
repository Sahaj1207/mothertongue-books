import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from './components/AppHeader'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import { AuthProvider, RequireSignIn } from './lib/auth'
import { I18nProvider } from './lib/i18n'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { CreatePage } from './pages/CreatePage'
import { LibraryPage } from './pages/LibraryPage'
import { MyBooksPage } from './pages/MyBooksPage'
import { PrintPage } from './pages/PrintPage'
import { ProgressPage } from './pages/ProgressPage'
import { ReaderPage } from './pages/ReaderPage'
import { ReviewPage } from './pages/ReviewPage'
import { SignInPage } from './pages/SignInPage'

function Layout() {
  // Keyed by path so a crash on one page doesn't stay stuck after navigating away.
  const { pathname } = useLocation()
  return (
    <>
      <AppHeader />
      <ErrorBoundary key={pathname}>
        <Outlet />
      </ErrorBoundary>
    </>
  )
}

const signedIn = (page: React.ReactNode) => <RequireSignIn>{page}</RequireSignIn>

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* No site header: this page is the PDF. */}
          <Route path="books/:id/print" element={<PrintPage />} />
          <Route element={<Layout />}>
            <Route index element={<LibraryPage />} />
            <Route path="books/:id" element={<ReaderPage />} />
            <Route path="books/:id/review" element={signedIn(<ReviewPage />)} />
            <Route path="create" element={signedIn(<CreatePage />)} />
            <Route path="making/:jobId" element={signedIn(<ProgressPage />)} />
            <Route path="my-books" element={signedIn(<MyBooksPage />)} />
            <Route path="sign-in" element={<SignInPage />} />
            <Route path="*" element={<ComingSoonPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </I18nProvider>
  </StrictMode>,
)
