import { useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router'
import { createStorage, type ProgressStore } from './core/storage.ts'
import { CaseListPage } from './ui/CaseListPage.tsx'
import { CasePage } from './ui/CasePage.tsx'

/** `key={id}` пересоздаёт CasePage при переходе на другое дело — своё состояние загрузки на каждое. */
function CaseRoute({ storage }: { storage: ProgressStore }) {
  const { id } = useParams<{ id: string }>()
  if (!id) return <Navigate to="/" replace />
  return <CasePage key={id} id={id} storage={storage} />
}

function App() {
  const [storage] = useState(() => createStorage(localStorage))

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CaseListPage storage={storage} />} />
        <Route path="/case/:id" element={<CaseRoute storage={storage} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
