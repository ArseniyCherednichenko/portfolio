import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import WorkDetail from './pages/WorkDetail'
import About from './pages/About'
import Playground from './pages/Playground'
import Uses from './pages/Uses'
import NotFound from './pages/NotFound'

// Route table. The Layout holds the persistent chrome (background, nav, footer)
// and renders the active page into its <Outlet />.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="playground" element={<Playground />} />
        <Route path="uses" element={<Uses />} />
        <Route path="work/:slug" element={<WorkDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
