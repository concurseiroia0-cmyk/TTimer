// PWA registration helper (kept separate so failures never break the app).

export function registerServiceWorker(): void {
  // Only production builds ship a service worker; dev has none.
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  // import.meta.env.BASE keeps this correct on GitHub Pages subpaths (/TTimer/).
  navigator.serviceWorker
    .register(`${import.meta.env.BASE}sw.js`, { scope: import.meta.env.BASE })
    .catch(() => {
      // SW registration failed (e.g. unsupported context). The app still works.
    })
}
