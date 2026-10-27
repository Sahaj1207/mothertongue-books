import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AppHeader } from './components/AppHeader'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { CreatePage } from './pages/CreatePage'
import { LibraryPage } from './pages/LibraryPage'
import { ProgressPage } from './pages/ProgressPage'
import { ReaderPage } from './pages/ReaderPage'

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<LibraryPage />} />
          <Route path="books/:id" element={<ReaderPage />} />
          <Route path="create" element={<CreatePage />} />
          <Route path="making/:jobId" element={<ProgressPage />} />
          <Route path="*" element={<ComingSoonPage title="Page not found" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
