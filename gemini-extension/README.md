# Radial AI for Gemini — Chrome Extension

把 gemini.google.com 的線性對話，變成一張可分支的 canvas 目錄。獨立於 web 版（`../radial-ai/`）的專案。

完整規格見 [`../Gemini Extension SDD.md`](../Gemini%20Extension%20SDD.md)。

## 目前進度：Phase 1（git-tree 抽屜）

已完成：
- MV3 骨架（side panel + content script + background）
- 「匯入目前對話」：解析 Gemini DOM → QA 節點（已過濾螢幕報讀器標籤）
- **縱向 git-tree**：由上到下的節點軌道，**滑鼠移上去才懸浮顯示問答**，壓縮空間
- 點節點 → 跳回 Gemini 原訊息並閃光（用 Gemini 穩定 `id`）
- 點圓點 → 切換閱讀狀態（未讀 / 已閱 / 重要）
- 選取節點 → 內嵌主題標籤輸入；同主題同色
- `chrome.storage` 持久化（重新匯入保留主題/狀態）

刻意不做：ReadingPanel、React Flow 自由畫布（閱讀在 Gemini 原生視窗）。

尚未做：手動分支／重新指定父節點 → 多軌 git-graph（Phase 1b）、半自動分支（Phase 2）。

## 開發

```bash
npm install
npm run dev        # 啟動 vite + crxjs，產物在 dist/
```

載入擴充：Chrome → `chrome://extensions` → 開啟「開發人員模式」→「載入未封裝項目」→ 選 `gemini-extension/dist`。

> 若 Gemini 分頁在載入擴充之前就開著，content script 還沒注入 —— **重整該分頁** 再用。

正式打包：

```bash
npm run build      # 輸出到 dist/
```

## 維護重點

Gemini 改版時，**只需要改一個檔案**：[`src/content/gemini-selectors.ts`](src/content/gemini-selectors.ts)。
所有對 Gemini DOM 的依賴都集中在那裡。
