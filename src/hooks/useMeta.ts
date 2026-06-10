import { useEffect } from 'react'

// Sets the document's meta description for the lifetime of the mounting route,
// restoring the previous value on unmount. Creates the tag if the page lacks
// one. Pairs with useDocumentTitle to give this SPA real per-route SEO/meta.
export function useMeta(description: string) {
  useEffect(() => {
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const existed = tag !== null
    const previous = tag?.getAttribute('content') ?? null

    if (!tag) {
      tag = document.createElement('meta')
      tag.setAttribute('name', 'description')
      document.head.appendChild(tag)
    }
    tag.setAttribute('content', description)

    return () => {
      if (!tag) return
      if (previous !== null) tag.setAttribute('content', previous)
      else if (!existed) tag.remove()
    }
  }, [description])
}
