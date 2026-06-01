# Radial AI — 放射狀思維 AI 對話系統

> 捨棄線性對話流，改用「**左側無限畫布 + 右側閱讀面板**」的雙欄佈局，把 AI 對話轉化為一張可發散、可收斂的思維地圖。

線上版：**[radialai.vercel.app](https://radialai.vercel.app)**

---

## 為什麼要做 Radial AI？

傳統 AI 對話是一條**線性時間軸**：訊息越長，脈絡越難回溯，每次提問都把整段歷史塞給模型，既花 Token 又稀釋焦點。當你想針對某段回覆延伸出多個不同方向時，線性介面只能一路往下捲，分支彼此互相干擾。

Radial AI 把對話拆解成畫布上有層級、有關聯的**思維節點（Thought Cards）**：

- 想延伸某個想法 → 在那個節點長出新分支。
- 想把不同分支的結論整合 → 讓多個節點匯合成一個新節點。
- 想精準提問 → 反白特定段落引用，系統只把「直系血親」路徑送給 AI。

你就是 AI 的記憶管理員 —— 由你決定它記得什麼、忘記什麼。

---

## 核心概念 (Glossary)

| 名詞 | 說明 |
|------|------|
| **Split View（雙欄佈局）** | 左側 Graph Canvas + 右側 Detail Reading Panel 的整體架構。 |
| **Thought Card（思維卡片）** | 畫布上的精簡節點，顯示對話摘要，用於拖曳排版與展示脈絡。 |
| **Reading Panel（閱讀面板）** | 右側固定區塊，點擊卡片後顯示完整 Prompt 與 AI 回覆，支援反白互動。 |
| **Global Input Palette（全局輸入框）** | 螢幕底部的輸入區，接收 Prompt 並管理當前引用的 Context。 |
| **Context Capsule（上下文膠囊）** | 輸入框中的視覺元件，代表使用者「加入引用」的特定段落。 |
| **Floating Toolbar（懸浮工具列）** | 在閱讀面板反白文字後彈出的快捷選單（Medium 風格）。 |
| **Ancestral Tracing（直系血親追溯）** | 沿畫布箭頭往回追溯單一路徑歷史，組裝成 API messages 的機制。 |

---

## 主要功能

### 1. 雙欄佈局與基礎對話
在底部輸入框提問 → 左側生成第一個 Thought Card，右側同步展開完整問答。繼續提問則在下方長出新節點並連線。

### 2. 文本互動與放射狀引用
所有文字選取都在右側閱讀面板進行，徹底避開畫布拖曳衝突：
- **螢光筆**：標記選取文字。
- **精準引用（⌘K）**：反白文字化作 Context Capsule 飛入輸入框，可跨多個節點收集片段。
- **多節點完整引用**：Shift+Click 多張卡片，直接把整個節點化為膠囊。

帶著膠囊發送新問題時，畫布會在被引用卡片旁長出**新分支**。

### 3. DAG 多父節點匯合
Shift+Click 選取 2 個以上節點後發送，新節點會以箭頭**同時連接所有父節點**，AI 整合各分支的完整脈絡 —— 適合把不同討論收斂成一個新觀點。

### 4. 上下文範圍控制
輸入框上方可切換 AI 看見的歷史範圍：

| 模式 | 說明 | 適用 |
|------|------|------|
| 🔗 **血親路徑**（預設） | 僅追溯當前節點往上的祖先 | 延伸單一思路、最省 Token |
| 🌐 **所有節點** | 傳送畫布全部節點 | 跨分支綜合歸納 |
| 👆 **自定義** | 手動框選特定節點作為 Context | 精確控制上下文 |

### 5. AI Persona
為每個畫布設定專屬角色與系統指令（例如「蘇格拉底」、「程式審查員」），與畫布一起儲存。

### 6. 內建初始畫布
每位使用者（含未登入）進站即可見兩個預載 session：**Tutorial** 教學畫布與 **關於 Radial AI** 動機畫布。

---

## 資料模型：實體化路徑 (Materialized Path) 🌟

AI 對話有一個核心特性 —— **不可變的歷史**：節點一旦生成，它的祖先就永遠固定。利用這點，我們在每個節點直接存入它的「族譜」：

```jsonc
// Node 3 的紀錄
{
  "id": "node_3",
  "prompt": "那相對論呢？",
  "ai_response": "相對論由愛因斯坦提出...",
  "ancestor_ids": ["node_1", "node_2"],          // 關鍵：直接存祖先陣列
  "context_capsules": [
    { "source_node": "node_1", "quote_text": "量子糾纏" }
  ]
}
```

新節點生成時：

```ts
const newAncestorIds = [...parentNode.data.ancestorIds, parentNode.id];
```

**好處**：撈取上下文是 O(1)，不必「爬樹」；節點彼此獨立，好做協作；未來上雲到 Firebase / Supabase 結構完全不用改寫。

---

## 技術棧 (Tech Stack)

| 層 | 技術 |
|-----|------|
| 框架 | React 19 + TypeScript |
| 畫布引擎 | @xyflow/react (React Flow) 12 |
| 文本處理 | Tiptap（Reading Panel 的反白、浮動選單、富文本） |
| 狀態管理 | Zustand 5（IndexedDB persist） |
| 樣式 | Tailwind CSS v4 |
| 建置 | Vite |
| AI APIs | Anthropic Claude API、Google Gemini API |
| 部署 | Vercel（push `main` 自動部署） |

---

## 快速開始 (Quick Start)

```bash
cd radial-ai
npm install
npm run dev          # 開發伺服器 → http://localhost:5173
```

點右上角 **⚠ Set API Key**，選擇模型並填入 API Key：

- **Anthropic Claude** → [console.anthropic.com](https://console.anthropic.com/)
- **Google Gemini** → [aistudio.google.com](https://aistudio.google.com/app/apikey)

接著在底部輸入框輸入問題，按 **Enter** 發送。

### 其他指令

```bash
npm run build      # production build → dist/
npm run preview    # 本地預覽 production build
npm run lint       # ESLint
npm test           # Vitest
```

> 更詳細的操作說明與快速鍵一覽，見 [`radial-ai/README.md`](radial-ai/README.md)。

---

## 儲存與部署策略

- **目前（Local First）**：純前端 Web App，所有畫布資料存在瀏覽器 **IndexedDB**，無需後端。清除瀏覽器資料即可重置。
- **未來擴張**：整合 Firebase / Supabase 實現雲端帳號同步；以 Tauri 封裝為原生 Mac `.app`。

---

## 未來藍圖 (Roadmap)

- Global Input Palette 進階 UI/UX：附件上傳、Drag & Drop、模型切換器、Deep Research。
- 進階上下文控制：語義相似度過濾（RAG / Gemini Embedding），自動挑出最相關的節點餵給 AI。
- 雲端同步與多人協作。

---

## 專案文件

- 設計文件：[`Radial AI SDD.md`](Radial%20AI%20SDD.md)
- 問題追蹤與版本紀錄：[`ISSUES.md`](ISSUES.md)
- 應用使用手冊：[`radial-ai/README.md`](radial-ai/README.md)
