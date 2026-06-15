# Privacy Policy — Radial AI for Gemini

_Last updated: 2026-06-10_

Radial AI for Gemini ("the Extension") is a browser extension that overlays an
organizational canvas onto **gemini.google.com**. This policy explains exactly
what data the Extension accesses, stores, and transmits.

**Short version:** Everything stays on your own device. The Extension has no
servers, no analytics, and no tracking. The only time any data leaves your
browser is when *you* provide a Google Gemini API key and trigger AI summaries —
in which case the relevant question/answer text is sent **only** to Google's
official Gemini API to generate a short title.

---

## 1. What the Extension accesses

While you are on `gemini.google.com`, the Extension reads, from the page you are
viewing:

- The text of your prompts and Gemini's answers in the **current conversation**.
- The conversation's identifier (from the page URL).
- Any highlights / notes you create on the page using the Extension.

It does **not** read other tabs, other websites, your Google account, your
browsing history, or anything outside the active Gemini conversation.

## 2. What the Extension stores (locally, on your device)

Stored in your browser's local extension storage (`chrome.storage.local`), which
is sandboxed to this Extension and never leaves your machine:

- The parsed conversation (questions, answer text), your node layout, names,
  topics, read-status, and branch structure.
- Your highlights and notes.
- Your settings, including your Gemini API key (if you choose to provide one).

You can delete all of it at any time by removing the Extension, or by clearing
the site/extension data in your browser.

## 3. What is transmitted, and to whom

- **By default: nothing is transmitted off your device.** Importing, the canvas,
  highlighting, and note-taking are entirely local.
- **Only if you provide a Gemini API key and use the AI summary feature:** the
  text of the relevant question and answer (truncated) is sent directly from your
  browser to Google's official Gemini API endpoint
  (`https://generativelanguage.googleapis.com`) to produce a short topic title.
  This request is made with **your** API key and is subject to
  [Google's Gemini API / AI Studio terms and privacy policy](https://ai.google.dev/terms).
- Your API key is sent only to Google's API and is never sent to the Extension's
  author or any third party. The Extension has no backend server of its own.

## 4. What we do NOT do

- No analytics, telemetry, or usage tracking.
- No advertising, and no selling or sharing of any data.
- No collection of personal information by the Extension's author.
- No third-party services other than Google's Gemini API (and only at your
  initiation, with your key).

## 5. Permissions

The Extension requests the minimum permissions needed:

- `storage` — to save your canvas, notes, and settings locally.
- `activeTab` — to act on the Gemini tab when you click the toolbar icon.
- Host access to `gemini.google.com` — to read the conversation and inject the
  panel/toolbar.
- Host access to `generativelanguage.googleapis.com` — to call Google's Gemini
  API for summaries (only when you provide a key).

## 6. Children

The Extension is a productivity tool not directed at children and collects no
personal information.

## 7. Changes

If this policy changes, the "Last updated" date above will change. Material
changes will be reflected in the extension listing.

## 8. Contact

Questions about this policy: **<your-contact-email@example.com>**

> _Note: replace the contact email above and host this file at a public URL
> (e.g. GitHub Pages / a Gist / Notion public page), then paste that URL into the
> Chrome Web Store "Privacy policy" field._
