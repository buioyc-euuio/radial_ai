# Radial AI for Gemini — Chrome Extension

把 gemini.google.com 的線性對話,變成一個**可拖曳的節點畫布**:自動把每組問答抓成節點、可分支、可在原文上螢光筆/筆記,並用你自己的免費 Gemini API 金鑰自動產生節點主題標題。獨立於 web 版（`../radial-ai/`）的專案。

完整規格見 [`../Gemini Extension SDD.md`](../Gemini%20Extension%20SDD.md)。

## 功能

- **注入式可停靠面板**:點工具列圖示在 Gemini 頁面長出面板(可停靠左/右/上/下、拖分隔線調整與 Gemini 的寬窄比例,Gemini 會真的讓出空間)。
- **自動匯入**:打開面板就自動把目前對話畫成節點;送出新問題會即時長出「產生中」節點,回答完自動填入並摘要。
- **可拖曳畫布(React Flow)**:節點可拖、可拉線建立分支、點線選整條分支一起移動、Delete 刪線、Ctrl+Z 復原。
- **點節點跳回 Gemini 原訊息**(對齊 prompt 頂端);圓點切換閱讀狀態(未讀/已閱/重要)。
- **頁面上選字工具列**:引用回覆(⌘K/L/C/E)、螢光筆(H)、筆記(D)。螢光筆/筆記寫進 Gemini 回應、用字元位置持久化,重整/切換對話後自動還原。
- **筆記分頁**:所有筆記成可點擊的 stack,點一下跳到對應文字段落並置中。
- **AI 摘要**:用你的免費 Gemini API 金鑰(⚙ 設定),為節點產生精簡主題標題。可在設定關閉「送出後自動摘要」以省額度。

## 隱私

- API 金鑰只存在你本機的 `chrome.storage.local`,僅用於呼叫 Google 的 `generativelanguage.googleapis.com`。
- 對話內容(提問/回答/你的筆記)存在本機;只有在你設了金鑰並觸發摘要時,問答文字才會送到 Google 的 Gemini API。沒有任何第三方伺服器、分析或追蹤。
- 權限只用 `storage` + `activeTab` + gemini.google.com / generativelanguage 的 host 權限。

## 開發

```bash
npm install
npm run dev        # vite + crxjs,產物在 dist/
# 或
npm run build      # 正式打包到 dist/
npm run typecheck  # tsc --noEmit
```

載入擴充:Chrome → `chrome://extensions` → 開「開發人員模式」→「載入未封裝項目」→ 選 `gemini-extension/dist`。
到 gemini.google.com 的對話頁,**點工具列上的擴充圖示**開啟面板(若分頁在載入擴充前就開著,先重整)。

## 架構

- **content script**(`src/content/`):跑在 Gemini 頁面。`gemini-selectors.ts` 集中所有 Gemini DOM 依賴(改版只改這裡);`parse.ts` 解析對話;`dock.ts` 注入 iframe 面板 + postMessage RPC + 推擠 Gemini 版面;`annotate.ts` 選字工具列與標記;`watch.ts` 偵測送出/回答完成。
- **panel**(`src/sidepanel/`):iframe 內的 React app。Zustand store(`store.ts`)+ chrome.storage 持久化;`Canvas.tsx` React Flow 畫布;`gemini-bridge.ts` 對 content script 的 RPC;`summarize.ts` 呼叫 Gemini API。
- 面板與 content script 用 `postMessage` 溝通,兩端都驗證 origin/source。

## 維護重點

Gemini 改版時,**主要只需要改** [`src/content/gemini-selectors.ts`](src/content/gemini-selectors.ts)。少數編碼了 Gemini DOM 假設的地方:`parse.ts`(螢幕報讀器標籤剝除)、`annotate.ts`(引用插入輸入框)、`getConversationId`(URL 形狀)。
