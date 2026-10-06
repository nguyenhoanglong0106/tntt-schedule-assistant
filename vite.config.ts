import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'

// A fresh id per build: baked into the bundle and published as /version.json,
// so an open app can tell a newer deploy exists without anyone bumping numbers by hand.
const BUILD_ID = new Date().toISOString()
const versionFile = (): Plugin => ({
  name: 'app-version-file',
  apply: 'build',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: BUILD_ID }) }) },
})

export default defineConfig({
  plugins: [vue(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(BUILD_ID) },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // host: true listens on IPv4 + IPv6; default binds only [::1] on Windows, so "localhost"
  // resolving to 127.0.0.1 gets ERR_CONNECTION_REFUSED and lazy routes fail to load.
  server: { port: 5180, host: true },
  preview: { port: 5180 },
})
