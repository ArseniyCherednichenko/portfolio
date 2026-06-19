import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import Playground from './pages/Playground'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="playground" element={<Playground />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
