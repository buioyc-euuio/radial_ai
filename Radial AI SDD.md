｀# **Software Design Document (SDD): Radial AI (放射狀思維 AI 對話系統)**

## **1\. 產品概述 (Project Overview)**

Radial AI 是一款為解決傳統「線性 AI 對話」痛點而設計的創新介面。它捨棄了傳統對話流，採用 **「左側無限畫布 (Infinite Canvas) ＋ 右側閱讀面板 (Reading Panel)」** 的雙欄佈局。

左側畫布將對話轉化為具有層級、關聯性的「思維節點 (Thought Cards)」，呈現思維發散的脈絡；右側面板則提供如 Notion 般純粹無干擾的文字閱讀與互動體驗。使用者可以在右側輕鬆反白特定段落進行延伸詢問，系統會自動提取「直系血親」歷史路徑發送給 AI，確保回覆精準且大幅節省 Token 成本。

## **2\. 核心名詞定義 (Glossary)**

* **Split View (雙欄佈局):** 左側為 Graph Canvas，右側為 Detail Reading Panel 的整體介面架構。  
* **Thought Card (思維卡片/畫布節點):** 畫布上的精簡實體，僅顯示對話摘要或開頭幾句話，用於拖曳排版與展示脈絡。  
* **Reading Panel (側邊閱讀面板):** 螢幕右側的固定區塊，點擊畫布卡片後，在此顯示完整的 Prompt 與 AI 回覆，支援純文字編輯與反白操作。  
* **Annotation Block (批註區塊):** 衍生自特定文本段落，用於記錄使用者心得的筆記實體。  
* **Global Input Palette (全局輸入框):** 固定於螢幕底部的輸入區域，負責接收 Prompt 與管理當前引用的 Context。  
* **Context Capsule (上下文膠囊):** 顯示在輸入框中的視覺元件，代表使用者「加入引用」的特定文本段落。  
* **Floating Toolbar (懸浮工具列):** 在閱讀面板中反白文字後，出現的快捷操作選單（類似 Medium）。  
* **Ancestral Tracing (直系血親追溯):** 系統自動沿著畫布箭頭往回追溯單一路徑上的歷史對話機制。

## **3\. 用戶流程與核心功能 (User Flow & Features)**

### **3.1 雙欄佈局與基礎對話 (Split View & Main Timeline)**

1. 用戶進入專案，左側畫布空白，右側閱讀面板關閉。  
2. 用戶在底部的 **Global Input Palette** 輸入問題並發送。  
3. 左側畫布生成第一個 **Thought Card (Node 1\)**（僅顯示摘要），同時右側 **Reading Panel** 展開，顯示完整的問答內容。  
4. 若直接在輸入框繼續提問，左側會在 Node 1 下方生成 Node 2 並連線，右側面板則更新為 Node 2 的內容。

### **3.2 文本互動與放射狀引用 (Contextual Interaction in Reading Panel)**

所有的「文字選取」操作皆轉移至右側 **Reading Panel** 進行，徹底解決畫布拖曳衝突：

1. **Floating Toolbar (懸浮工具列):** 使用者在右側面板反白任何文字，立即彈出類似 Medium 的工具列。  
2. **Highlight (螢光筆):** 標記選取文字為黃色底色。  
3. **精準引用 (Quote to Context / 快捷鍵 Cmd/Ctrl \+ Shift \+ Q):** *【核心操作】*  
   * 反白文字後按下快捷鍵或點擊工具列的 Quote 按鈕。  
   * 該文字化作 **Context Capsule (上下文膠囊)** 飛入底部的 Global Input Palette 中。  
   * 可跨越多個節點收集片段（點擊左側不同卡片切換右側內容，繼續反白收集）。  
4. **多節點完整引用:** 在左側畫布上按住 Shift 點擊多張 Thought Card，直接將完整節點化為膠囊加入輸入框。

**觸發新分支:** 帶有 Context 膠囊發送新問題時，左側畫布會在主要被引用卡片的**右側**生成新分支卡片，並產生箭頭。右側面板隨即顯示新生成的內容。

### **3.3 上下文記憶機制 (Context Window Management)**

* **歷史打包 (Ancestral Tracing):** 沿著左側畫布的箭頭反向尋找直系路徑，轉換為 API Messages Array。遇到刪除的「佔位空節點」則略過內容。  
* **注意力錨點 (Attention Anchoring):** 收集的所有膠囊與最新問題，會在最後一個 user message 中組裝為結構化 Prompt。

**🔧 API Payload 實作範例:**

{  
  "messages": \[  
    { "role": "user", "content": "節點 1 的問題" },  
    { "role": "assistant", "content": "節點 1 的回答" },  
    {   
      "role": "user",   
      "content": "【引用上下文 1】：\\n\\"...\\"\\n\\n【最新問題】：\\n{新問題}\\n\\n請根據上述引用與歷史回答。"   
    }  
  \]  
}

### **3.4 畫布與節點操作 (Canvas & Node Manipulation)**

* **Drag & Drop:** 左側畫布專心處理圖形操作，卡片可自由拖曳，連線跟隨重繪。  
* **節點刪除 (Placeholder Logic):** 刪除卡片時轉為「佔位空節點 (Placeholder)」，保留位置與連線，清空內容。支援方框批次選取刪除。  
* **編輯與覆蓋:** 在右側面板編輯已送出的 Prompt，直接覆蓋舊內容並觸發 AI 重新生成。不產生多餘分支。

## **4\. 系統架構與資料模型 (Architecture & Data Model)**

### **4.1 建議技術棧 (Recommended Tech Stack)**

* **前端框架:** React (TypeScript) \+ Tailwind CSS  
* **畫布引擎 (左側):** React Flow (專注渲染 Thought Cards、Edges、拖曳與多選)。  
* **文本處理 (右側):** TipTap 或 Prosemirror (負責 Reading Panel 內的 Medium 風格反白、浮動選單與豐富文本渲染)。  
* **狀態管理:** Zustand (同步左側 Active Node ID，以正確切換右側面板內容)。

### **4.2 儲存與部署策略 (Web-First Strategy)**

* **MVP 階段 (Local First):** 純前端 Web App。於 Mac localhost 運行，資料存在瀏覽器 **IndexedDB**。最快、免後端。  
* **未來擴張:** \* 部署至 Vercel 實現無資料庫訪客網頁版。  
  * 整合 Firebase/Supabase 實現雲端帳號同步。  
  * 使用 Tauri 封裝為原生 Mac .app。
### 4.3 資料庫設計：實體化路徑模型 (Materialized Path) 🌟

AI 對話有一個核心特性：**不可變的歷史 (Immutable History)**。你一旦問了問題、產生了節點，這個節點的「祖先是誰」就永遠固定了，不會哪天突然把 Node 5 拔下來接到 Node 1 去。

利用這個特性，我們可以在每個節點建立時，直接把它的「族譜」存進去！

#### 4.3.1 資料結構範例

```json
// Node 3 的資料庫紀錄
{
  "id": "node_3",
  "canvas_id": "proj_123",
  "prompt": "那相對論呢？",
  "ai_response": "相對論由愛因斯坦提出...",
  // 關鍵：直接存入它的祖宗陣列
  "ancestor_ids": ["node_1", "node_2"],

  // 如果有引用特定膠囊，可以記錄
  "context_capsules": [
    { "source_node": "node_1", "quote_text": "量子糾纏" }
  ]
}
```

#### 4.3.2 直系血親追溯：O(1) 極速查詢

當使用者在 node_3 發送新問題時，程式只需要看它的 `ancestor_ids`，然後下一道簡單的查詢：

```
撈取 Nodes 條件：ID 包含在 ["node_1", "node_2"] 之中。
```

一次就能把所有歷史精準抓回來打包給 AI。

#### 4.3.3 實作細節

* **前端狀態管理：** 配合 React Flow 的 `nodes` 陣列，在每一個 node 的 `data` 屬性裡塞入 `ancestor_ids`。
* **新節點生成邏輯：** 新節點的 `ancestor_ids` = 父節點的 `ancestor_ids` + 父節點的 `id`。

```typescript
// 生成新節點時
const newAncestorIds = [...parentNode.data.ancestorIds, parentNode.id];
```

#### 4.3.4 優缺點分析

| 優點 | 說明 |
|------|------|
| 最完美的效能 | 無論本地端還是雲端，撈取上下文速度最快，不浪費運算資源「爬樹」 |
| 節點獨立性 | 兼具方案 B 的節點獨立性（好做協作），解決 NoSQL 難以追溯關聯的痛點 |
| 無痛上雲 | 未來擴張到 Firebase / Supabase 時，結構完全不需要改寫 |

| 缺點 | 說明 |
|------|------|
| 前端邏輯 | 生成新節點時需正確寫入 `ancestor_ids` |

#### 4.3.5 綜合結論

對於 Radial AI 來說，強烈建議採用 **實體化路徑模型 (Materialized Path)** 的思維來設計前端狀態與 IndexedDB 的資料結構。

**為什麼？**

你的核心痛點是「控制傳給 AI 的 Context」。方案 C 讓你在組合 API Payload 時，幾乎不費吹灰之力就能抓出精準的對話歷史。

配合 React Flow 的 `nodes` 陣列，只要在每一個 node 的 `data` 屬性裡塞入 `ancestor_ids`，邏輯會變得異常乾淨。

未來擴張到 Firebase / Supabase 時，這個結構完全不需要改寫，直接無痛上雲。

5. 未來發展藍圖 (Future Roadmap & Sprints)
註：以下不在 MVP 範圍內，將於後續 Sprint 逐步迭代。
5.1 Global Input Palette 進階 UI/UX
快捷鍵操作: 支援 Enter 送出，Shift + Enter 換行。
附件上傳 (+ 按鈕): 支援點擊 + 號上傳，或 Drag & Drop 檔案至對話框。
模型切換器 (Model Switcher): 輸入框提供下拉選單，無縫切換不同模型。
進階擴充功能: Deep Research 網路搜尋、特定 Artifacts/文件檔案級別的 Context 整合。
5.2 進階上下文歷史控制 (Advanced Context Scope Control)
於輸入框功能列新增「歷史範圍選取器」，發送前決定打包多少歷史：
直系血親 (Ancestral Tracing - 預設): 僅傳送當前路徑歷史。
所有節點 (Global History): 傳送畫布上所有節點（包含所有分支），適用於綜合歸納。
自定義節點 (Custom Selection): 觸發畫布選取模式，手動框選特定歷史節點作為 Context
透過 google api key 寫程式，我能控制history 傳入的東西嗎？可以！太棒了
你的產品是「放射狀」的，這意味著你可以發展出很多精妙的策略：
直系血親路徑 (Ancestry Path)： 當使用者點擊某個節點進行提問時，你的程式碼自動往回找它的「父親節點」、「祖父節點」，直到根節點。只把這條「垂直線」上的內容當作 history 傳給 AI。這樣即便畫布有 100 個節點，AI 也只會聚焦在相關的脈絡上。
手動勾選 (Manual Selection)： 你可以做一個功能，讓使用者在畫布上按住 Shift 點選特定三個節點，然後按「針對這些節點提問」。這時候你的程式碼就只抓這三個節點的 text 組成 contents。
語義相似度過濾 (RAG)： 如果你之後用到 Gemini Embedding 1（就是你之前問的那個），你可以把使用者的最新問題拿去跟畫布上所有節點比對，只找出「最相關」的三個節點餵給 AI。
這樣做的好處：
節省 Token： 你不用每次都傳幾百個節點過去。
更精準的回覆： 減少無關資訊（雜訊）干擾 AI 的判斷。
打破線性限制： 使用者可以在同一個畫布上，同時進行多條互不干擾的對話路徑，因為每一條路徑傳給 API 的 history 都是你動態生成的。
這就是開發 API 產品最迷人的地方——你就是 AI 的記憶管理員，你可以決定它記得什麼，忘記什麼。



