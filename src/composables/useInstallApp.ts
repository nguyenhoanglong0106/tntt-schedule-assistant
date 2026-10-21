import { computed, ref } from 'vue'

// Chrome, Edge and Samsung Internet offer their own install dialog through this event
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallHelp = 'in-app' | 'ios-safari' | 'ios-other' | 'android' | 'desktop'

const ua = navigator.userAgent
// iPadOS presents itself as a Mac; touch support tells the two apart
const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
// Links shared in the Zalo group open in Zalo's own browser, which cannot add anything to the home screen
const inAppBrowser = /Zalo|FBAN|FBAV|FB_IAB|Instagram|Line\//i.test(ua)
const standaloneQuery = matchMedia('(display-mode: standalone)')
const isStandalone = () => standaloneQuery.matches || (navigator as { standalone?: boolean }).standalone === true

const deferred = ref<InstallPromptEvent | null>(null)
const installed = ref(isStandalone())
/** Link that opens the app with its install steps showing (the QR code and the copy button share it) */
export const installLink = () => `${location.origin}/?install=1`
/** Set when the page was opened from the install QR code, so the steps show right away */
export const wantsInstall = ref(false)

/** Called before the app mounts: the browser fires beforeinstallprompt once, often right after load */
export function listenForInstallPrompt() {
  // Read ?install before the router runs: its redirect to /login drops the query
  wantsInstall.value = new URLSearchParams(location.search).has('install')
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred.value = e as InstallPromptEvent })
  window.addEventListener('appinstalled', () => { installed.value = true; deferred.value = null })
  standaloneQuery.addEventListener?.('change', () => { installed.value = isStandalone() })
}

export function useInstallApp() {
  const canPrompt = computed(() => !!deferred.value)
  const help = computed<InstallHelp>(() => {
    if (inAppBrowser) return 'in-app'
    if (isIOS) return /CriOS|FxiOS|EdgiOS/.test(ua) ? 'ios-other' : 'ios-safari'
    return /Android/i.test(ua) ? 'android' : 'desktop'
  })

  /** Opens the browser's install dialog; false when there is none and the steps have to be shown instead */
  async function promptInstall(): Promise<boolean> {
    const e = deferred.value
    if (!e) return false
    // Each event can prompt only once
    deferred.value = null
    await e.prompt()
    if ((await e.userChoice).outcome === 'accepted') installed.value = true
    return true
  }

  return { installed, canPrompt, help, promptInstall }
}
