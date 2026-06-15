import { defineManifest } from '@crxjs/vite-plugin'

// Single source of truth for the extension manifest.
const ICONS = {
  '16': 'icons/icon16.png',
  '32': 'icons/icon32.png',
  '48': 'icons/icon48.png',
  '128': 'icons/icon128.png',
}

export default defineManifest({
  manifest_version: 3,
  name: 'Radial AI for Gemini',
  version: '0.1.0',
  description:
    'Turn a linear Gemini conversation into a radial canvas directory — import QA nodes, draw your own branches, jump back to any message.',
  icons: ICONS,
  action: {
    default_title: 'Radial AI for Gemini',
    default_icon: ICONS,
  },
  background: {
    service_worker: 'src/background/background.ts',
    type: 'module',
  },
  permissions: ['storage', 'activeTab'],
  host_permissions: [
    'https://gemini.google.com/*',
    'https://generativelanguage.googleapis.com/*',
  ],
  content_scripts: [
    {
      matches: ['https://gemini.google.com/*'],
      js: ['src/content/content.ts'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['sidepanel.html', 'assets/*'],
      matches: ['https://gemini.google.com/*'],
    },
  ],
})
