import { Link } from 'react-router-dom'
import { GradientText } from '../components/GradientText'

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[80vh] w-full max-w-4xl flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-[#DCF87C]">Error 404</p>
      <h1 className="mt-6 text-7xl font-bold tracking-tight sm:text-9xl">
        <GradientText>Lost</GradientText>
      </h1>
      <p className="mt-6 max-w-md text-lg leading-relaxed text-white/55">
        This page wandered off. The good stuff is back home.
      </p>
      <Link
        to="/"
        className="mt-10 rounded-full bg-[#DCF87C] px-7 py-3.5 font-semibold text-black transition hover:brightness-105"
      >
        Take me home
      </Link>
    </section>
  )
}
