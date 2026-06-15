import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest'

// crxjs bundles the manifest entries (content script, background). sidepanel.html
// is no longer a manifest page (it's the injected-dock iframe source, exposed via
// web_accessible_resources), so we add it as an explicit build input (path is
// relative to the project root).
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    rollupOptions: {
      input: { sidepanel: 'sidepanel.html', onboarding: 'onboarding.html' },
    },
  },
  server: {
    // Bind IPv4 explicitly. Default `localhost` binds IPv6 (::1) on macOS,
    // but Chrome resolves localhost → 127.0.0.1, so the extension can't reach it.
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    hmr: { host: '127.0.0.1', port: 5174 },
  },
})
