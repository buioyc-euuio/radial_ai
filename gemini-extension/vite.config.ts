import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './src/manifest'

// crxjs handles bundling the MV3 manifest entries (side panel html,
// content script, background service worker) and wires up HMR in dev.
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  server: {
    // Bind IPv4 explicitly. Default `localhost` binds IPv6 (::1) on macOS,
    // but Chrome resolves localhost → 127.0.0.1, so the extension can't reach it.
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    hmr: { host: '127.0.0.1', port: 5174 },
  },
})
