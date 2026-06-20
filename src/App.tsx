import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Work from './pages/Work'
import Playground from './pages/Playground'
import WorkDetail from './pages/WorkDetail'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="work" element={<Work />} />
        <Route path="playground" element={<Playground />} />
        <Route path="work/:slug" element={<WorkDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
