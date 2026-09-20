import { ref, onMounted } from 'vue'

const CURRENT_VERSION = '1.0.1'

export function useUpdateChecker() {
  const updateAvailable = ref(false)
  const updating = ref(false)
  const updateError = ref('')
  let currentRegistration: ServiceWorkerRegistration | null = null

  async function checkVersion(): Promise<boolean> {
    try {
      const res = await fetch('/version.json')
      const data = await res.json()
      if (data.version !== CURRENT_VERSION) {
        return true
      }
    } catch { }
    return false
  }

  async function checkUpdate() {
    if (!('serviceWorker' in navigator)) return
    try {
      const reg = await navigator.serviceWorker.ready
      currentRegistration = reg

      const newVersion = await checkVersion()
      if (newVersion) {
        await reg.update()
      }

      const waiting = (reg as any).waiting as ServiceWorker | null
      if (waiting) {
        updateAvailable.value = true
        return
      }

      if (newVersion) {
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              updateAvailable.value = true
            }
          })
        })
      }
    } catch { }
  }

  function applyUpdate(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!currentRegistration?.waiting) {
        resolve(false)
        return
      }
      updating.value = true
      updateError.value = ''

      const timeout = setTimeout(() => {
        clearTimeout(timeout)
        window.removeEventListener('message', handler)
        updating.value = false
        updateError.value = 'Cập nhật thất bại. Vui lòng thử lại.'
        resolve(false)
      }, 15000)

      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'UPDATE_APPLIED') {
          clearTimeout(timeout)
          window.removeEventListener('message', handler)
          updating.value = false
          window.location.reload()
        }
        if (event.data?.type === 'UPDATE_FAILED') {
          clearTimeout(timeout)
          window.removeEventListener('message', handler)
          updating.value = false
          updateError.value = 'Cập nhật thất bại. Vui lòng thử lại.'
          resolve(false)
        }
      }
      window.addEventListener('message', handler)

      currentRegistration.waiting.postMessage({ type: 'SKIP_WAITING' })
    })
  }

  onMounted(() => {
    checkUpdate()
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'UPDATE_AVAILABLE') {
        updateAvailable.value = true
      }
    })
  })

  return { updateAvailable, updating, updateError, checkUpdate, applyUpdate }
}