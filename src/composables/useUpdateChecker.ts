import { onBeforeUnmount, onMounted, ref } from 'vue'

const CHECK_EVERY = 10 * 60_000
const RELOAD_KEY = 'tntt-update-reload-at'

/** Reload to pick up a new deploy, at most once per 30s so a broken deploy can't cause a reload loop */
export function reloadForNewVersion(path?: string): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < 30_000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch { /* storage blocked: still reload once */ }
  if (path) window.location.assign(path)
  else window.location.reload()
  return true
}

async function latestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()).version ?? null
  } catch { return null }
}

export function useUpdateChecker() {
  const updateAvailable = ref(false)
  const updating = ref(false)
  const updateError = ref('')
  let timer: ReturnType<typeof setInterval> | undefined

  async function checkUpdate(): Promise<boolean> {
    // The dev server has no version.json; only built deploys update themselves
    if (import.meta.env.DEV) return false
    const latest = await latestVersion()
    if (latest && latest !== __APP_VERSION__) updateAvailable.value = true
    return updateAvailable.value
  }

  async function applyUpdate(): Promise<boolean> {
    updating.value = true; updateError.value = ''
    try { await (await navigator.serviceWorker?.getRegistration())?.update() } catch { /* the page reload alone is enough */ }
    if (reloadForNewVersion()) return true
    updating.value = false
    updateError.value = 'Chưa cập nhật được. Vui lòng đóng hẳn app rồi mở lại.'
    return false
  }

  // Coming back to the app (from Zalo, the home screen…) is the safe moment: nothing is half-typed,
  // so a found update applies right away instead of waiting for a tap
  async function onVisible() {
    if (document.visibilityState !== 'visible') return
    if (await checkUpdate()) applyUpdate()
  }

  onMounted(() => {
    checkUpdate()
    document.addEventListener('visibilitychange', onVisible)
    timer = setInterval(() => { if (document.visibilityState === 'visible') checkUpdate() }, CHECK_EVERY)
  })
  onBeforeUnmount(() => { document.removeEventListener('visibilitychange', onVisible); clearInterval(timer) })

  return { updateAvailable, updating, updateError, checkUpdate, applyUpdate }
}
