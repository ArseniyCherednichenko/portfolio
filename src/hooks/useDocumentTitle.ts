import { useEffect } from 'react'

// Sets document.title for the lifetime of the mounting route, restoring the
// previous title on unmount. Gives this SPA real per-page titles for tabs,
// history, bookmarks, and screen-reader page announcements.
export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title
    document.title = title
    return () => {
      document.title = previous
    }
  }, [title])
}
