import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { reloadForNewVersion } from './composables/useUpdateChecker'
import './styles.css'
// After a deploy the old build's lazy chunks are gone, so an app opened before it fails to load the
// next page; load the new version instead (at the page the user was heading to)
let heading = location.pathname + location.search
router.beforeEach(to => { heading = to.fullPath })
window.addEventListener('vite:preloadError', e => { if (reloadForNewVersion(heading)) e.preventDefault() })
router.onError((err, to) => {
  if (/dynamically imported module|Importing a module script failed|Failed to fetch/i.test(String(err?.message ?? err))) reloadForNewVersion(to.fullPath)
})
createApp(App).use(router).mount('#app')
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>undefined))
// iPhone keyboard: it covers the bottom of the screen without resizing fixed elements, hiding a sheet's Save button.
// While it is open, expose the visible band so .sheet-overlay sits above it. Only a large gap counts as the keyboard:
// home-screen apps report a layout height a status bar taller than the screen, which must not shift sheets.
const vv = window.visualViewport
if (vv) {
  const root = document.documentElement
  const fit = () => {
    const hidden = window.innerHeight - vv.height
    if (hidden > 150) {
      root.style.setProperty('--kb-top', `${Math.max(0, vv.offsetTop)}px`)
      root.style.setProperty('--kb-bottom', `${Math.max(0, window.innerHeight - vv.offsetTop - vv.height)}px`)
      root.classList.add('kb-open')
    } else if (root.classList.contains('kb-open')) {
      root.style.removeProperty('--kb-top'); root.style.removeProperty('--kb-bottom'); root.classList.remove('kb-open')
    }
  }
  vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit)
}
