import { Analytics } from '@vercel/analytics/react'
import { useState } from 'react'
import { BrowserRouter, Route, Routes, useParams } from 'react-router'
import { createStorage, type ProgressStore } from './core/storage.ts'
import { CaseListPage } from './ui/CaseListPage.tsx'
import { CasePage } from './ui/CasePage.tsx'
import { LandingPage } from './ui/LandingPage.tsx'
import { NotFoundPage } from './ui/NotFoundPage.tsx'

/** `key={id}` пересоздаёт CasePage при переходе на другое дело — своё состояние загрузки на каждое. */
function CaseRoute({ storage }: { storage: ProgressStore }) {
  const { id } = useParams<{ id: string }>()
  if (!id) return <NotFoundPage />
  return <CasePage key={id} id={id} storage={storage} />
}

function App() {
  const [storage] = useState(() => createStorage(localStorage))

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage storage={storage} />} />
        <Route path="/archive" element={<CaseListPage storage={storage} />} />
        <Route path="/case/:id" element={<CaseRoute storage={storage} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  )
}

export default App
