import { defineManifest } from '@crxjs/vite-plugin'

// Single source of truth for the extension manifest.
// Icons intentionally omitted in Phase 0 (Chrome falls back to a default).
export default defineManifest({
  manifest_version: 3,
  name: 'Radial AI for Gemini',
  version: '0.1.0',
  description:
    'Turn a linear Gemini conversation into a radial canvas directory — import QA nodes, draw your own branches, jump back to any message.',
  action: {
    default_title: 'Radial AI for Gemini',
  },
  background: {
    service_worker: 'src/background/background.ts',
    type: 'module',
  },
  permissions: ['sidePanel', 'tabs', 'storage', 'activeTab'],
  host_permissions: ['https://gemini.google.com/*'],
  side_panel: {
    default_path: 'sidepanel.html',
  },
  content_scripts: [
    {
      matches: ['https://gemini.google.com/*'],
      js: ['src/content/content.ts'],
      run_at: 'document_idle',
    },
  ],
})
