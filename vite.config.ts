import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// This site redeploys almost every day — a routine adds one hand-made component
// or a line of changelog and ships it. With everything in one shared bundle, a
// one-line content change re-hashes the whole thing, so a returning visitor
// (the author checks daily) re-downloads React, the router, and Framer Motion
// every time, even though none of it moved. Those libraries are the stable
// floor under the whole site, so we pin them into their own content-hashed
// chunks: the framework caches once and survives every daily content deploy,
// and only the small app chunk that actually changed is fetched again.
//
// The groups are coarse on purpose. react / react-dom / the router / scheduler
// are one runtime and belong together; Framer Motion is large and independent
// enough to cache on its own. Everything else (the app, the code-split routes)
// keeps Rollup's own splitting, which already hoists shared modules into shared
// chunks — we don't second-guess it by routing app code here.
function vendorChunk(id: string): string | undefined {
  if (!id.includes('node_modules')) return undefined
  if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
    return 'vendor-react'
  }
  if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) {
    return 'vendor-motion'
  }
  return undefined
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: vendorChunk,
      },
    },
    // The Playground alone pulls in most of the experiment library on one route,
    // so its chunk is legitimately large. It's code-split and loads only on
    // /playground; the 500 kB default warning just adds noise to every build.
    chunkSizeWarningLimit: 1600,
  },
})
