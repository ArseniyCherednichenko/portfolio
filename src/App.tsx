import { lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
// Home is eager — it's the landing page, so it ships in the initial bundle and
// never shows a route-loading flash. Every other page (the Playground alone
// pulls in most of the experiment components) is code-split into its own chunk
// and streamed in on navigation, so first paint stays lean. The Suspense
// boundary that catches these lives in Layout.
import Home from './pages/Home'
const About = lazy(() => import('./pages/About'))
const Work = lazy(() => import('./pages/Work'))
const Playground = lazy(() => import('./pages/Playground'))
const Writing = lazy(() => import('./pages/Writing'))
const WritingDetail = lazy(() => import('./pages/WritingDetail'))
const Now = lazy(() => import('./pages/Now'))
const Toolkit = lazy(() => import('./pages/Toolkit'))
const WorkDetail = lazy(() => import('./pages/WorkDetail'))
const Contact = lazy(() => import('./pages/Contact'))
const Colophon = lazy(() => import('./pages/Colophon'))
const Answers = lazy(() => import('./pages/Answers'))
const Craft = lazy(() => import('./pages/Craft'))
const Design = lazy(() => import('./pages/Design'))
const Resume = lazy(() => import('./pages/Resume'))
const TerminalPage = lazy(() => import('./pages/Terminal'))
const Changelog = lazy(() => import('./pages/Changelog'))
const Contents = lazy(() => import('./pages/Contents'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="about" element={<About />} />
        <Route path="work" element={<Work />} />
        <Route path="playground" element={<Playground />} />
        <Route path="writing" element={<Writing />} />
        <Route path="writing/:slug" element={<WritingDetail />} />
        <Route path="now" element={<Now />} />
        <Route path="toolkit" element={<Toolkit />} />
        <Route path="work/:slug" element={<WorkDetail />} />
        <Route path="contact" element={<Contact />} />
        <Route path="colophon" element={<Colophon />} />
        <Route path="answers" element={<Answers />} />
        <Route path="craft" element={<Craft />} />
        <Route path="design" element={<Design />} />
        <Route path="resume" element={<Resume />} />
        <Route path="terminal" element={<TerminalPage />} />
        <Route path="changelog" element={<Changelog />} />
        <Route path="contents" element={<Contents />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
