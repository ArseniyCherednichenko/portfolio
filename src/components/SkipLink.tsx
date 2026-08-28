// The first stop for a keyboard or screen-reader visitor: a "Skip to content"
// link that is the very first focusable thing on the page, hidden until it is
// focused. Without it, every Tab into the site starts by walking the whole nav
// and its menus before reaching the page itself; with it, one Tab and one Enter
// jump straight past the chrome. Visually it stays off-screen until focused,
// then springs in from the top edge as an on-brand lime pill — so it is present
// for those who need it and invisible to those who do not.
//
// It targets the <main> landmark (id="main-content", made focusable with
// tabIndex={-1} in Layout), and calls focus() as well as moving the hash, so
// the next Tab continues from the content, not back at the top of the document.

export function SkipLink() {
  const onActivate = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById('main-content')
    if (target) {
      e.preventDefault()
      // Move real focus into the content so subsequent Tabs continue there.
      target.focus()
      target.scrollIntoView({ block: 'start' })
      // Keep the URL hash in sync for anyone who bookmarks the jump.
      history.replaceState(null, '', '#main-content')
    }
  }

  return (
    <a
      href="#main-content"
      onClick={onActivate}
      className="
        fixed left-1/2 top-3 z-[100] -translate-x-1/2 -translate-y-[160%]
        rounded-full bg-[#DCF87C] px-5 py-2.5 text-sm font-semibold text-black
        shadow-lg shadow-black/40 outline-none
        transition-transform duration-300 ease-out
        focus:translate-y-0
        focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]
        motion-reduce:transition-none
      "
    >
      Skip to content
    </a>
  )
}
