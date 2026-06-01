# Radial AI — 問題追蹤與版本紀錄

> 這是一份持續更新的文件。每次發現新問題、修正問題、或發布版本，都應在此更新。
> 最後更新：2026-06-01（B1 測試、B2 Lint 全數修復）

---

## 一、待修正問題（依嚴重度排序）

### 🔴 高 — 影響使用者 / Demo

| # | 問題 | 位置 | 狀態 | 備註 |
|---|------|------|------|------|
| A1 | 登入白名單帳號後，未顯示 / 無法使用 API Key | 白名單流程（`api/_whitelist.ts` → `HomePage.tsx` → `ApiKeyModal.tsx`） | 🔍 調查中 | 疑似與 A2 同源：表單→試算表同步失效導致 `checkWhitelisted` 回傳 false |
| A2 | Google 表單 → Google 試算表自動更新白名單失效 | `api/_whitelist.ts:12` `fetchFromSheet()` | ⏸ 延後處理（使用者指示） | 可能成因：Service Account 環境變數缺失、Sheet 分頁名稱 `'表單回覆 1'` 變動、權限未開 |

### 🟡 中 — 程式碼品質 / 測試

| # | 問題 | 位置 | 狀態 | 備註 |
|---|------|------|------|------|
| B1 | 測試失敗 16/70 | 見下方「測試失敗明細」 | ✅ 已修（70/70 通過）| 過時測試，已對齊現行程式碼 |
| B2 | Lint 11 errors / 3 warnings | 見下方「Lint 明細」 | ✅ 已修（0 errors / 0 warnings）| react-hooks 規則：可重構者重構，誤報處加註 disable |

---

## 二、測試明細（✅ 已修：70/70 通過）

執行：`cd radial-ai && npm test`

### `ThoughtNode.test.tsx`（原 9 失敗）✅
- **根因**：`ThoughtNode.tsx` 新增 `computeNodeNumbers(nodes)` 編號功能，但測試的 `useCanvasStore` mock 未提供 `nodes` → `TypeError: nodes is not iterable`。
- **修法**：mock 補上 `nodes: []`、`edges: []`；順手修掉同檔 `any` 型別與未用 eslint-disable。

### `canvasStore.test.ts`（原 3 失敗）✅
- **決策**：`deleteNode` 維持現行「直接硬刪除」行為（PlaceholderNode 元件仍保留供 minimap/舊資料使用，但刪除不再轉換）。測試已改為驗證硬刪除：移除節點 + 清除相連的邊。
- 「first project gets demo nodes」→ 改為「建立空專案」：onboarding 已改為每次安裝種一次的 **Tutorial 專案**（`canvasStore.ts` `tutorialSeeded`），`createProject` 一律建空專案。

### `ReadingPanel.test.tsx`（原 4 失敗）✅
- **根因**：jsdom mock Range 缺 `cloneRange`，且工具列按鈕 aria-label 由 `引用 (⌘K)`→`引用` 等已更名，mock store 缺多個 action。
- **修法**：mock Range 補 `cloneRange`；測試按鈕名稱對齊現行（`引用`/`螢光筆`/`筆記`）；mock store 補齊 `updateMarkedHtml`、`setSelectedNode`、`sendPrompt` 等。

---

## 三、Lint 明細（✅ 已修：0 errors / 0 warnings）

執行：`cd radial-ai && npm run lint`

| 檔案 | 問題 | 修法 |
|------|------|------|
| `src/utils/nodeNumbers.ts` | `_edges` 參數未使用 | 移除參數，更新 2 處呼叫端 |
| `src/components/ReadingPanel.tsx` | 4 處空 catch block | 加註 `/* ignore invalid range */` |
| `src/components/ReadingPanel.tsx` | render 期間寫 ref（promptBoxHeight）| 改為 `useEffect` 同步 |
| `src/components/ReadingPanel.tsx` | render 期間讀 ref（autofocus）| `newAnnIdRef` 改為 `useState`（重構，非 disable）|
| `src/components/ReadingPanel.tsx` | `annotations` 未 memo（exhaustive-deps）| 包成 `useMemo` |
| `src/App.tsx` / `UsageBar.tsx` / `ReadingPanel.tsx` | effect 內 setState | 屬合理用途（資料抓取／狀態重置／彈窗同步），加註 `eslint-disable` + 理由 |
| `src/components/__tests__/ThoughtNode.test.tsx` | `any` 型別 | 改為 `ComponentProps<typeof ThoughtNode>` |

---

## 四、版本更迭紀錄（Changelog）

格式參考 [Keep a Changelog](https://keepachangelog.com/)。日期為 YYYY-MM-DD。

### [Unreleased]
#### Added
- 手動白名單 `MANUAL_WHITELIST`（`api/_whitelist.ts`）：新增 `yaan.md13@nycu.edu.tw`，獨立於 Google 表單/試算表同步，供 Demo 使用。
  - 合併進 `checkWhitelisted()`：來源為 Sheet ∪ `WHITELISTED_EMAILS` 環境變數 ∪ `MANUAL_WHITELIST`。
  - ⚠️ 尚未 commit / push / 部署 — 需 push 至 `main` 觸發 Vercel 自動部署後才於線上生效。
- 初始畫布（Starter Canvases）：所有使用者（含未登入）進站即可見兩個預載 session（`canvasStore.ts`）。
  - 「Tutorial」教學畫布：新增 `tutorial-6`「開始使用：API Key 與登入」節點 + 邊 `e-t4-t6`，補齊新功能說明。
  - 「關於 Radial AI」動機畫布：依 `Radial AI SDD.md` 整理開發動機，5 張繁中 Q&A Thought Card（`about-1`～`about-5`），佈局為 DAG（含多親收斂）。
  - 版本化種子機制：以 `STARTER_SEED_VERSION`（取代舊 `tutorialSeeded` 布林）控管。`merge` 時若持久化版本落後，會移除舊 starter 副本並重新植入最新兩個畫布，不影響使用者自建專案。

#### Fixed
- 初始畫布對「全新訪客」不顯示：Zustand persist 的 `merge` 只在 storage 已有資料時觸發，空 IndexedDB 的首訪者（含未登入）不會跑 `merge`，導致 `projects` 維持 `[]`。修法：在預設 state 直接植入 `createTutorialProject()` + `createAboutProject()` 並設 `starterSeedVersion: STARTER_SEED_VERSION`；既有使用者仍由 `merge` 的版本檢查重新植入。
- 測試套件：16 個失敗的過時測試全數修復 → 70/70 通過（`ThoughtNode` / `canvasStore` / `ReadingPanel`）。
- Lint：11 errors + 警告全數清除 → 0 errors / 0 warnings（`nodeNumbers` 移除未用參數、`ReadingPanel` 空 catch、ref 用法重構、effect setState 加註）。

#### Changed
- `ReadingPanel`：`newAnnIdRef`（ref）改為 `newAnnId`（state）以符合 react-hooks 規則；`annotations` 以 `useMemo` 穩定化。
- 種子機制：`tutorialSeeded`（布林，僅首裝植入一次）改為 `starterSeedVersion`（數字版本），讓既有使用者也能在版本更新時收到新的初始畫布。

#### Known Issues
- A1：白名單帳號未顯示 API Key（調查中，預期被手動白名單繞過）
- A2：表單→試算表白名單同步失效（延後）

---

<!--
維護指引：
- 每發現一個新問題 → 在「一、待修正問題」加一列，給定編號（A=高、B=中、C=低）。
- 每修好一個問題 → 將狀態改為 ✅ 已修，並在 Changelog 對應版本的 #### Fixed 加註。
- 每次發版 → 把 [Unreleased] 內容移到新的版本標題下，例如 ## [0.2.0] - 2026-06-XX。
狀態圖示：❌ 未修　🔍 調查中　⏸/⏸️ 延後　✅ 已修
-->
