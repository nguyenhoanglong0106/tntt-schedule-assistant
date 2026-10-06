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
