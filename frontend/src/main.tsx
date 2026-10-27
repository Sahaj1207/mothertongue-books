import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Outlet, Route, Routes } from 'react-router-dom'
import { AppHeader } from './components/AppHeader'
import './index.css'
import { ComingSoonPage } from './pages/ComingSoonPage'
import { LibraryPage } from './pages/LibraryPage'

function Layout() {
  return (
    <>
      <AppHeader />
      <Outlet />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<LibraryPage />} />
          <Route path="books/:id" element={<ComingSoonPage title="Book reader" />} />
          <Route path="create" element={<ComingSoonPage title="Create a book" />} />
          <Route path="*" element={<ComingSoonPage title="Page not found" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
