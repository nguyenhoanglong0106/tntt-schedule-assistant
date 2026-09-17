import { ref, onMounted } from 'vue'

export function useUpdateChecker() {
  const updateAvailable = ref(false)
  let currentRegistration: ServiceWorkerRegistration | null = null

  async function checkUpdate() {
    if (!('serviceWorker' in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      currentRegistration = reg
      const waiting = (reg as any).waiting as ServiceWorker | null
      if (waiting) {
        updateAvailable.value = true
        return
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (!newWorker) return
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            updateAvailable.value = true
          }
        })
      })
      await reg.update()
    } catch { }
  }

  function applyUpdate() {
    if (currentRegistration?.waiting) {
      currentRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }
    window.location.reload()
  }

  onMounted(() => {
    checkUpdate()
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'UPDATE_AVAILABLE') {
        updateAvailable.value = true
      }
    })
  })

  return { updateAvailable, checkUpdate, applyUpdate }
}