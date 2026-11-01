import { BrowserRouter, Route, Routes } from 'react-router'
import { EmptyState } from './components/EmptyState'
import { Layout } from './components/Layout'
import { Agenda } from './pages/Agenda'
import { Courts } from './pages/Courts'
import { Dashboard } from './pages/Dashboard'
import { Items } from './pages/Items'
import { Orders } from './pages/Orders'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="quadras" element={<Courts />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="pedidos" element={<Orders />} />
          <Route path="itens" element={<Items />} />
          <Route path="*" element={<EmptyState title="Página não encontrada" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
