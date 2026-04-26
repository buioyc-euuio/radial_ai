# Radial AI ✦

An infinite-canvas AI conversation tool. Instead of a boring linear chat, every AI response becomes a **Thought Node** on a canvas — you can branch, annotate, and quote specific passages to build a radial map of ideas.

---

## Quick Start

### 1. Install dependencies

```bash
cd radial-ai
npm install
```

### 2. (Optional) Set up your API key in `.env` for Dev Mode

Open `.env` and paste your Google Gemini API key:

```env
VITE_GOOGLE_API_KEY=your_gemini_api_key_here
```

> You can also enter API keys manually inside the app — no `.env` file required.

### 3. Start the dev server

```bash
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## First-Time Setup (in the browser)

1. Click **⚠ Set API Key** in the top-right corner.
2. Choose a model — **Anthropic Claude** or **Google Gemini**.
3. Paste the corresponding API key and click **Save**.
   - If you set `VITE_GOOGLE_API_KEY` in `.env`, click **Dev Mode** to load it automatically.
4. Type a question in the bottom input bar and press **Enter** (or **Return**).

---

## How to Use

### Basic conversation
Type in the bottom bar → press **Enter** to send. Each message + reply appears as a **Thought Node**, chained downward (main timeline).

### Branch the conversation
1. Hover over any AI response — the cursor turns into a text cursor (`I`).
2. **Click and drag** to select text.
3. Press **⌘L** (Mac) or **Ctrl+L** (Windows/Linux) — or click **Quote** in the popup toolbar.
4. The selected text appears as a **Context Capsule** in the input bar.
5. Type a new question and send → a new node branches off to the right.

### Annotate a passage
1. Select text in any response.
2. Click **Annotate** in the popup toolbar.
3. A sticky-note **Annotation Node** appears beside the source node — add your own notes and click **Ask AI** to send both the passage and your note as context.

### Add a full node as context
**Shift+Click** or **Alt+Click** any node → the entire node (prompt + response) is added as a Context Capsule.

### Node controls (header bar)
| Action | How |
|---|---|
| **Drag node** | Click and drag the pink/blue **header bar** |
| **Expand / Collapse** | Click **▼ / ▶** in the header |
| **Immersive View** | Click **⤢** → full-screen reading mode, press **Esc** to close |
| **Edit prompt** | Double-click the prompt text → edit → press **Enter** to re-generate |
| **Delete** | Click **✕** → node becomes a placeholder (keeps connections intact) |

### Keyboard shortcuts
| Shortcut | Action |
|---|---|
| **Enter** | Send message |
| **Shift+Enter** | New line in input |
| **⌘L / Ctrl+L** | Quote selected text into context |
| **⌘K / Ctrl+K** | Focus the input bar |
| **Esc** | Close Immersive View |

---

## Other npm commands

```bash
npm run build      # Production build → dist/
npm run preview    # Preview the production build locally
npm run lint       # Run ESLint
```

---

## Tech Stack

| Layer | Library |
|---|---|
| Framework | React 19 + TypeScript |
| Canvas | @xyflow/react (React Flow) |
| State | Zustand (persisted to IndexedDB) |
| Styling | Tailwind CSS v4 |
| Markdown | markdown-it |
| Build | Vite 8 |
| AI APIs | Anthropic Claude API, Google Gemini API |
