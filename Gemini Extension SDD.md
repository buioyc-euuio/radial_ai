# Radial AI for Gemini — Chrome Extension 詳細規格（L1 + L2）

> 把 radial_ai 的「放射狀分支思考」概念，做成一個疊在 **gemini.google.com 傳統網頁版** 上的 Chrome 擴充。
> 範圍：本文件涵蓋 **L1（目錄層）** 與 **L2（半自動分支）**。L3（全自動驅動）暫不實作。

---

## 0. 產品定位與核心使用情境

**一句話**：你照常用 Gemini 網頁聊天；當你發現「這串對話開始長出很多分支問題」時，**一鍵把目前對話快照成一張 canvas 目錄**，自己拉箭頭整理先後與歸屬；需要深挖某節點時，再用半自動分支問下去。

**主情境（Capture-then-Organize）**
1. 使用者在 Gemini 正常問答（傳統線性）。
2. 某刻按下 extension 的「匯入目前對話」→ 目前所有 QA 變成 canvas 上一個個節點。
3. 使用者**手動拉箭頭**定義先後順序 / 分支歸屬（主要給自己看，不一定反映 Gemini 真實順序）。
4. 看著目錄，點節點可跳回 Gemini 對應訊息；可在 side panel 閱讀、引用、highlight、註解。
5. 想深挖時，在某節點按「分支」→ 預設「順著問」（同對話接續）；必要時切「深挖」（開新對話、記憶隔離）。

**設計原則**
- **快照優先，不做即時鏡像**：L1 是「按下才匯入」的快照，不持續同步 Gemini DOM。降低脆弱度，也符合「整理」的心智模型。
- **手動編排優先於自動推斷**：邊（箭頭）預設由使用者自己拉；自動 layout 只給初始擺放。
- **目錄層永遠可用**：即使 L2 自動化壞掉，L1 目錄與閱讀/註解照常運作。
- **複用既有 radial_ai 架構**：React Flow、Zustand store、ReadingPanel、祖先脈絡組裝邏輯盡量原封搬。

---

## 1. 名詞定義

| 名詞 | 定義 |
|---|---|
| **QA 節點 (QANode)** | 一組「使用者提問 + Gemini 回應」。Canvas 上的基本單位。 |
| **邊 (Edge)** | 節點間使用者手拉的箭頭，表達先後/歸屬。預設使用者定義，非自動。 |
| **血親脈絡 (Lineage)** | 從某節點沿著邊往上追溯到根的祖先節點集合。 |
| **記憶集 (Memory Set)** | 分支送出時要餵給 Gemini 的脈絡來源節點集合。可 = 血親，或使用者自訂勾選。 |
| **快照 (Snapshot)** | 一次「匯入目前 Gemini 對話」的結果。 |
| **對話映射 (Conversation Map)** | node ↔ Gemini conversation id / 訊息錨點 的對應關係。 |

---

## 2. 系統架構（Manifest V3）

```
┌──────────── Gemini Tab (gemini.google.com/app/*) ────────────┐
│  Content Script (gemini-bridge.ts)                            │
│   · 解析對話 DOM → QA pairs（匯入時）                          │
│   · 跳轉/highlight 指定訊息                                    │
│   · L2：填入輸入框、（半自動）等使用者送出、擷取回應           │
└───────────────────────────△──────────────────────────────────┘
                            │ chrome.runtime messaging（JSON）
┌───────────────────────────▽──── Side Panel (React App) ──────┐
│  · React Flow Canvas（樹狀目錄 + 手動拉箭頭）                  │
│  · ReadingPanel（複用：引用 / highlight / 註解）              │
│  · Zustand Store（複用祖先脈絡組裝；新增 conversation map）    │
│  · Branch Composer（脈絡組裝 + 摘要壓縮 + 記憶集選擇）         │
└───────────────────────────────────────────────────────────────┘
        ▲
        │ chrome.storage（持久化快照/節點/邊/註解）
┌───────▽──── Background Service Worker ────────┐
│  · 開啟/聚焦 side panel                         │
│  · （L2 深挖）開新 Gemini 分頁/對話、傳遞脈絡   │
│  · 持久化協調                                   │
└────────────────────────────────────────────────┘
```

**為什麼用 Side Panel 而非注入 React 到 Gemini 頁面**
- Gemini 的 CSP 會擋外部注入的重型框架；side panel 有自己乾淨的執行環境與 CSP。
- iframe 嵌 Gemini 不可行（`frame-ancestors` 阻擋），所以必為「side panel ↔ Gemini tab」雙視窗 + 訊息橋接。

---

## 3. L1 規格 — 目錄層

### 3.1 一鍵匯入：DOM 解析策略（整個 extension 的地基）

**核心風險**：Gemini DOM 是 Angular 動態渲染、class name 混淆、會改版。對策是**集中化、設定驅動的 selector 表**，壞了只改一處。

```ts
// gemini-selectors.ts —— 唯一需要隨 Gemini 改版維護的檔案
export const GEMINI_SELECTORS = {
  conversationRoot: 'main',                 // 對話主容器（待對實際 DOM 確認）
  turnUser:        'user-query',            // 使用者提問 turn（Angular 自訂元素，待確認）
  turnModel:       'model-response',        // 模型回應 turn（待確認）
  userText:        '.query-text',           // 提問文字
  modelText:       '.markdown, message-content', // 回應 markdown
  inputBox:        'rich-textarea .ql-editor, textarea', // 輸入框
  sendButton:      'button[aria-label*="Send"], button.send-button',
};
```

**解析流程（匯入時觸發一次）**
1. content script 在 `conversationRoot` 下，依 DOM 順序蒐集 user / model turn。
2. 配對：第 i 個 user turn + 其後第一個 model turn = 一個 QA pair。
3. 每個 pair 抽出：`question`（純文字）、`answer`（markdown 原文 + 純文字）、`domOrder`（索引）。
4. 從 URL 取 `conversationId`（`/app/<id>`）。

**穩定 id 策略**（Gemini 不保證每則訊息有穩定 DOM id）
- `nodeId = hash(conversationId + domOrder + question前64字)`。
- 重複匯入同一對話時，用相同 hash → 可**去重/更新**而非重複建立。

**解析韌性**
- 找不到 selector 時：回傳明確錯誤碼（不是默默空白），side panel 提示「Gemini 版面可能更新，請回報」。
- 容忍「最後一則仍在串流中」：偵測到 stop/regenerate 狀態則跳過未完成的 turn。
- 容忍長對話：分批讀取、避免一次 freeze。

### 3.2 資料模型（擴充現有 types.ts）

```ts
interface QANodeData {
  id: string;                 // hash 穩定 id
  question: string;
  answerMarkdown: string;
  answerText: string;
  topic?: string;             // 主題標籤（手動或自動，見 3.4）
  conversationId: string;     // 來源 Gemini 對話
  domOrder: number;           // 來源訊息順序（用於跳轉與去重）
  anchor: MessageAnchor;      // 跳轉錨點（見 3.5）
  // 複用 radial_ai 既有欄位：
  highlights: Highlight[];
  annotations: Annotation[];
  createdVia: 'import' | 'branch';
}

interface MessageAnchor {
  conversationId: string;
  domOrder: number;
  questionHash: string;       // DOM 重繪後仍可重新定位
}

// 邊：使用者自訂，沿用 React Flow edge
interface CanvasEdge { id: string; source: string; target: string; }
```

### 3.3 Canvas 呈現 + 手動拉箭頭

- React Flow canvas（複用現有元件，節點換成 QANode 卡片）。
- 卡片內容：主題標籤 + 提問預覽（截斷）+ 已讀/註解狀態點。**不在卡片內編輯文字**（沿用「canvas 唯讀、文字互動在 ReadingPanel」鐵則）。
- **初始 layout**：匯入後依 `domOrder` 縱向排列（dagre/簡單堆疊），給一個合理起點。
- **手動編排**（核心需求）：
  - 使用者可自由拖曳節點位置。
  - 使用者可從節點把手拉出箭頭連到另一節點 → 建立 `CanvasEdge`。
  - 可刪邊、改向。**邊純粹是使用者的心智地圖**，不影響 Gemini。
- 多選、框選、刪除節點（刪節點不刪 Gemini 對話，只刪 canvas 上的呈現）。

### 3.4 主題 / 分支標籤

- **手動**：使用者可給節點打 `topic` 標籤，同標籤同色，一眼看出歸屬。
- **自動（可選、加分）**：匯入後用一次輕量分類（可先用本地啟發式：關鍵詞 / 標題；或之後接 API）給初步主題建議，使用者可改。
- Canvas 提供「依主題上色 / 依血親上色」切換，呼應你「清楚看出每個 QA 隸屬哪些分支/主題」的需求。

### 3.5 跳轉：節點 → Gemini 訊息

1. side panel 點節點 → 送 `JUMP_TO {anchor}` 給 content script。
2. content script 依 `questionHash` 重新定位該 turn 的 DOM（DOM 可能已重繪），`scrollIntoView` + 閃一下 highlight。
3. 找不到（對話已切換/清掉）→ 回報「該訊息目前不在頁面上」，提示切回原對話。

### 3.6 Reading View（複用 ReadingPanel）

- 點節點時，side panel 右側顯示完整 Q + A（markdown 渲染）。
- **引用 / highlight / 註解** 全在此面板進行——直接複用現有 ReadingPanel 與其 toolbar/快捷鍵（H/F 螢光筆、N/A/E 筆記、⌘K/L/C 引用）。
- 註解、highlight 存在節點資料上，隨快照持久化。

### 3.7 持久化

- 用 `chrome.storage.local`（或 IndexedDB）存：snapshots、nodes、edges、annotations、conversationMap。
- 以 `conversationId` 為單位分組；同一對話重複匯入 → 合併更新（依 hash 去重），保留使用者已拉的邊與註解。

---

## 4. L2 規格 — 半自動分支

### 4.1 兩種分支模式（**預設順著問**）

| 模式 | 行為 | 記憶 | 何時用 |
|---|---|---|---|
| **順著問（預設）** | 留在**同一個** Gemini 對話接續送出 | 不隔離，Gemini 記得全部 | 一般追問 |
| **深挖（真分支）** | **開新** Gemini 對話，第一則塞壓縮脈絡 | 隔離乾淨，只記得你給的 | 想開乾淨脈絡、避免污染 |

- UI：節點上的「分支」按鈕預設走「順著問」；旁邊有切換可選「深挖」。
- 深挖才需要開新對話（成本見 SDD 優缺點討論）；順著問不開。

### 4.2 脈絡組裝 + 摘要壓縮

- 複用現有 **ancestral tracing**：沿邊往上收集 lineage。
- **壓縮策略**（避免第一則 prompt 過長 / 撞長度上限）：
  - 預設：把每個來源節點壓成「Q 摘要 + A 重點」短段。
  - 過長時：保留引用過/highlight 過的片段優先（使用者標記的 = 重要訊號），其餘進一步摘要。
  - 摘要可先用本地規則（取被 highlight/引用片段 + 首尾），之後可升級成呼叫一次 LLM 摘要。
- 組好的脈絡格式（填入 Gemini 的第一則訊息）：
  ```
  【背景脈絡（我先前的探討摘要）】
  - 主題A：…（節點1摘要）
  - 主題B：…（節點2摘要）
  【接下來的問題】
  {使用者新問題}
  ```

### 4.3 自訂歷史記憶 / 血親記憶（你的明確需求）

分支送出前，彈出 **Memory Set 選擇器**：
- **血親模式（預設）**：自動帶 lineage（沿邊往上的祖先）。
- **自訂模式**：在 canvas/清單上**手動勾選**要納入記憶的節點（可跨分支挑）。
- 可預覽「壓縮後實際要送出的脈絡全文」，使用者可在送出前**手動編輯**。
- 記住每次選擇，方便重複。

### 4.4 半自動送出流程（人在迴路）

1. 節點按「分支」→ 選模式 + Memory Set → 預覽脈絡。
2. extension 行為：
   - **順著問**：把「脈絡（若有）+ 新問題」填入**目前對話**的輸入框。
   - **深挖**：請 background 開新 Gemini 對話分頁，待載入後把脈絡填入其輸入框。
3. **由使用者按送出**（可先檢視/微調）。← L2 與 L3 的唯一差別。
4. 送出後使用者按「擷取回應」→ content script 讀剛產生的 model turn → 建立 `createdVia:'branch'` 的新節點，並自動連一條邊（來源節點 → 新節點）。

### 4.5 擷取回應

- 半自動：使用者點「擷取」時才讀（不需自動偵測串流結束，避開 L3 最脆弱的部分）。
- 讀取目前對話最新的 model turn，配對其上方 user turn → 新 QANode。
- 記錄新節點的 `conversationId`（深挖模式 = 新對話 id）。

### 4.6 對話映射維護

- `conversationMap: { nodeId → { conversationId, domOrder } }`。
- 深挖開的新對話：標題自動帶上「↳ 來源節點主題」方便在 Gemini 原生列表辨識。
- 提供「節點 → 在 Gemini 開啟其來源對話」的捷徑。

---

## 5. 訊息協定（content script ↔ side panel ↔ background）

```ts
// side panel → content script
{ type: 'IMPORT_CONVERSATION' }                  → { ok, nodes[], conversationId }
{ type: 'JUMP_TO', anchor }                       → { ok }
{ type: 'FILL_INPUT', text, target:'current' }    → { ok }
{ type: 'CAPTURE_LATEST_RESPONSE' }               → { ok, qaPair }

// side panel → background
{ type: 'OPEN_NEW_GEMINI_CHAT', seedText }        → { ok, tabId, conversationId }
{ type: 'OPEN_SIDE_PANEL' }

// content script → side panel（被動通知，可選）
{ type: 'SELECTORS_BROKEN', detail }              // 解析失敗時提示使用者
```

所有 payload 純 JSON、可序列化；content script 不回傳 DOM 節點，只回傳資料 + anchor。

---

## 6. 風險與對策

| 風險 | 對策 |
|---|---|
| Gemini 改版打掉 selector | 全部集中在 `gemini-selectors.ts`；解析失敗有明確錯誤碼與使用者提示；L1 快照式降低觸發頻率 |
| 第一則脈絡 prompt 過長 | 摘要壓縮 + 優先保留被標記片段 + 送出前可編輯 |
| 跳轉時 DOM 已重繪 | 用 `questionHash` 重新定位，而非存活的 DOM 參照 |
| 深挖產生大量 Gemini 對話 | 對話標題帶來源、canvas 當主入口、提供清理捷徑 |
| CSP / 注入限制 | UI 走 Side Panel，不注入重型框架到 Gemini 頁 |
| Gemini「跨對話 Saved info」污染隔離 | 文件標明隔離非 100%；對使用情境影響小 |

---

## 7. 實作計劃（Milestones）

### Phase 0 — 偵察與骨架（地基）
- [ ] 對著實際 gemini.google.com DOM 確認 `GEMINI_SELECTORS`（**動手前必做**）。
- [ ] MV3 專案骨架：manifest、background、content script、side panel（複用現有 Vite React app）。
- [ ] content script ↔ side panel 訊息通道打通（先傳個 ping/pong）。

### Phase 1 — L1 目錄層（核心，先做扎實）
- [ ] `IMPORT_CONVERSATION`：解析 DOM → QA pairs → 建節點。
- [ ] React Flow canvas 呈現 + 初始 layout。
- [ ] 手動拖曳節點 / 拉箭頭 / 刪邊。
- [ ] 主題標籤（手動）+ 依主題/血親上色切換。
- [ ] `JUMP_TO` 跳轉 + highlight。
- [ ] ReadingPanel 複用：引用 / highlight / 註解。
- [ ] `chrome.storage` 持久化 + 重複匯入去重合併。

### Phase 2 — L2 半自動分支
- [ ] 分支按鈕 + 模式切換（預設順著問 / 深挖）。
- [ ] 祖先脈絡組裝 + 摘要壓縮。
- [ ] Memory Set 選擇器（血親 / 自訂勾選）+ 脈絡預覽可編輯。
- [ ] `FILL_INPUT`（順著問）/ `OPEN_NEW_GEMINI_CHAT`（深挖）。
- [ ] `CAPTURE_LATEST_RESPONSE` → 新節點 + 自動連邊。
- [ ] conversationMap 維護 + 「開啟來源對話」捷徑。

### Phase 3 — 打磨（可選）
- [ ] 自動主題分類（本地啟發式或一次性 LLM）。
- [ ] LLM 摘要升級脈絡壓縮品質。
- [ ] 匯出/匯入快照（沿用現有 export/import）。

**先後**：Phase 0 → 1 必須穩；Phase 2 疊上去；任何時刻 Phase 1 都能獨立運作。
```
