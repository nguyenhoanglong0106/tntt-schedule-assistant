import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  // host: true listens on IPv4 + IPv6; default binds only [::1] on Windows, so "localhost"
  // resolving to 127.0.0.1 gets ERR_CONNECTION_REFUSED and lazy routes fail to load.
  server: { port: 5180, host: true },
  preview: { port: 5180 },
})
