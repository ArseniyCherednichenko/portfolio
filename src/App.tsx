import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import WorkDetail from './pages/WorkDetail'
import NotFound from './pages/NotFound'

// Route table. The Layout holds the persistent chrome (background, nav, footer)
// and renders the active page into its <Outlet />.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="work/:slug" element={<WorkDetail />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
