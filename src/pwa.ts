// PWA registration helper (kept separate so failures never break the app).

export function registerServiceWorker(): void {
  // Only production builds ship a service worker; dev has none.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // Resolve relative to the page URL (document.baseURI): works both at '/'
  // and at GitHub Pages subpaths like '/TTimer/'.
  const swUrl = new URL('sw.js', document.baseURI).href
  const scope = new URL('./', document.baseURI).pathname
  navigator.serviceWorker
    .register(swUrl, { scope })
    .catch(() => {
      // SW registration failed (e.g. unsupported context). The app still works.
    })
}
