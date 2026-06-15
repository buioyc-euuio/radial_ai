# Chrome Web Store submission notes — Radial AI for Gemini

Copy/paste material for the Web Store developer dashboard. Replace the
bracketed placeholders before submitting.

---

## Single-purpose description

> Radial AI for Gemini turns a linear Gemini conversation into an organizable,
> branchable canvas: it imports the current chat as nodes, lets you arrange and
> branch them, highlight and annotate the responses, jump back to any message,
> and (optionally, with your own free Gemini API key) auto-generate short topic
> titles for each node.

Single purpose: **help users organize and navigate their own Gemini
conversations.**

## Permission justifications

Paste each into the matching "why do you need this permission?" box.

- **`storage`** — Stores the user's canvas (node layout, names, topics, branch
  structure, read-status), their highlights/notes, and settings locally in the
  browser. Required so the user's organization persists across sessions. No data
  leaves the device.

- **`activeTab`** — When the user clicks the toolbar icon, the extension toggles
  its panel on the active Gemini tab and sends it a message. `activeTab` (granted
  on click) is sufficient; the extension does not read tabs in the background.

- **Host permission `https://gemini.google.com/*`** — The core function: read the
  current conversation's text and inject the organizing panel and the on-page
  highlight/note toolbar. The extension only runs on Gemini.

- **Host permission `https://generativelanguage.googleapis.com/*`** — Used only
  when the user supplies their own Google Gemini API key and triggers the AI
  summary feature, to call Google's official Gemini API for a short topic title.
  Not used otherwise.

## Data-use disclosure (Privacy practices form)

Answer the dashboard's data questions as follows:

- **Does your extension collect or use data?** Yes (handled locally; one optional
  outbound call to Google's API).
- **Data types handled:**
  - "Website content" — reads the user's current Gemini conversation text.
  - "Authentication information" — the user-provided Gemini **API key** (stored
    locally; sent only to Google's API).
- **Stored where:** Locally in the browser (`chrome.storage.local`). No
  extension-owned server.
- **Transmitted off device:** Only the relevant Q&A text, only to Google's
  Gemini API, only when the user provides a key and uses AI summary.
- **Sold or shared with third parties:** No.
- **Used for purposes unrelated to single purpose:** No.
- **Used for creditworthiness / lending:** No.
- Certify compliance with the Developer Program Policies.

## Privacy policy URL

Host [`PRIVACY.md`](./PRIVACY.md) at a public URL and paste it into the
"Privacy policy URL" field. Options: GitHub Pages, a public GitHub Gist, or a
Notion public page.

## Listing assets checklist

- [x] Icons 16 / 32 / 48 / 128 (in `public/icons/`, wired in the manifest)
- [ ] Store icon 128×128 (can reuse `public/icons/icon128.png`)
- [ ] At least 1 screenshot, 1280×800 or 640×400 (show the dock + canvas on Gemini)
- [ ] Short description (≤132 chars) and detailed description
- [ ] A promotional tile (optional)
- [ ] Category: Productivity
- [ ] Pick a deliberate version number (currently `0.1.0`)

## Pre-submit sanity

- `npm run typecheck && npm run build`, then load `dist/` unpacked and smoke-test.
- Confirm no `console.log` of sensitive data (none currently).
- Confirm permissions in `dist/manifest.json` are only `storage` + `activeTab`
  + the two host permissions.
