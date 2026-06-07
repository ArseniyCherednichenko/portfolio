// Keyboard users can jump straight past the nav to the main content.
// Hidden until focused (Tab on page load).
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[130] focus:rounded-full focus:bg-[#DCF87C] focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-black"
    >
      Skip to content
    </a>
  )
}
