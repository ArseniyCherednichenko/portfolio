import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Work from './pages/Work'
import Playground from './pages/Playground'
import Writing from './pages/Writing'
import Now from './pages/Now'
import Toolkit from './pages/Toolkit'
import WorkDetail from './pages/WorkDetail'
import Contact from './pages/Contact'
import Colophon from './pages/Colophon'
import Resume from './pages/Resume'
import NotFound from './pages/NotFound'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="work" element={<Work />} />
        <Route path="playground" element={<Playground />} />
        <Route path="writing" element={<Writing />} />
        <Route path="now" element={<Now />} />
        <Route path="toolkit" element={<Toolkit />} />
        <Route path="work/:slug" element={<WorkDetail />} />
        <Route path="contact" element={<Contact />} />
        <Route path="colophon" element={<Colophon />} />
        <Route path="resume" element={<Resume />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
