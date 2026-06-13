import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { RouteFallback } from './components/RouteFallback'
import Home from './pages/Home'

// The homepage loads eagerly (it is the landing surface). Secondary routes are
// code-split so a first-time visitor only downloads the homepage chunk, then
// fetches About/Playground/Uses/case-studies on demand.
const About = lazy(() => import('./pages/About'))
const Now = lazy(() => import('./pages/Now'))
const Work = lazy(() => import('./pages/Work'))
const Playground = lazy(() => import('./pages/Playground'))
const Uses = lazy(() => import('./pages/Uses'))
const WorkDetail = lazy(() => import('./pages/WorkDetail'))
const NotFound = lazy(() => import('./pages/NotFound'))

// Route table. The Layout holds the persistent chrome (background, nav, footer)
// and renders the active page into its <Outlet />.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route
          path="about"
          element={
            <Suspense fallback={<RouteFallback />}>
              <About />
            </Suspense>
          }
        />
        <Route
          path="now"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Now />
            </Suspense>
          }
        />
        <Route
          path="work"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Work />
            </Suspense>
          }
        />
        <Route
          path="playground"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Playground />
            </Suspense>
          }
        />
        <Route
          path="uses"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Uses />
            </Suspense>
          }
        />
        <Route
          path="work/:slug"
          element={
            <Suspense fallback={<RouteFallback />}>
              <WorkDetail />
            </Suspense>
          }
        />
        <Route
          path="*"
          element={
            <Suspense fallback={<RouteFallback />}>
              <NotFound />
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}
