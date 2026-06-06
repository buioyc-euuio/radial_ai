import type { Node, Edge } from '@xyflow/react';
import type { NodeData, Project } from '../store/types';

// ── Tutorial canvas (pre-created on first load) ───────────────────────────────
const TUTORIAL_PROJECT_ID = 'tutorial';

const TUTORIAL_NODES: Node<NodeData>[] = [
  // ── Node 1: Root / Overview ────────────────────────────────────────────────
  {
    id: 'tutorial-1', type: 'thoughtNode',
    position: { x: 80, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '什麼是 Radial AI v2？',
      response: `Radial AI 是一款打破傳統線性對話的 **AI 思維畫布**。\n\n## 核心概念\n\n左側**無限畫布**將每一次 AI 問答化為可視化的「思維節點」，右側**閱讀面板**提供深度閱讀與互動。所有節點以**有向箭頭**連接，清楚呈現思路的脈絡與分支。\n\n## v2 全新升級\n\n- **🔀 DAG 多父節點匯聚**：Shift+Click 選取多個節點，讓新節點從多個來源同時繼承脈絡\n- **🎯 Context Scope 切換器**：輸入框下方切換「血親 / 全局 / 自定義」三種歷史打包模式\n- **🤖 AI Persona**：為每個畫布設定獨立的系統指令，打造專屬 AI 角色\n- **✨ Floating Edges**：邊線動態連接節點最近邊框，拖曳後自動重路由\n\n## 本畫布本身就是示範！\n\n你現在看到的節點佈局示範了 DAG 結構 — **節點 #5 同時從 #2 與 #3 匯聚**。\n\n👉 點擊其他節點繼續探索，或切換到右側閱讀面板閱讀完整內容。`,
      title: 'Radial AI v2 — 產品概覽',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 2: Main timeline ──────────────────────────────────────────────────
  {
    id: 'tutorial-2', type: 'thoughtNode',
    position: { x: 80, y: 360 },
    data: {
      type: 'thoughtNode',
      prompt: '如何建立節點？主時間線怎麼運作？',
      response: `## 主時間線（Main Timeline）\n\n在底部輸入框輸入問題，按 **Enter** 發送。\n\n**沒有任何引用膠囊時** → 新節點自動加入**左側垂直時間線**，向下堆疊。\n\n---\n\n## 建立分支\n\n**有引用膠囊時** → 新節點出現在被引用節點的右側，以箭頭連接。\n\n### 如何引用？\n\n1. 點擊畫布節點 → 右側顯示完整內容\n2. 在右側選取文字\n3. 按 **⌘K**（或點工具列「引用」）\n4. 文字化為輸入框上方的**脈絡膠囊**\n5. 輸入問題 → Enter → 生成分支節點\n\n---\n\n## 快速鍵\n\n| 鍵 | 功能 |\n|----|------|\n| **Enter** | 發送訊息 |\n| **Shift+Enter** | 輸入框換行 |\n| **⌘/** | 聚焦輸入框 |\n| **Option+點擊節點** | 整個節點加入引用 |`,
      title: '主時間線與分支建立',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 3: Referencing & branching ───────────────────────────────────────
  {
    id: 'tutorial-3', type: 'thoughtNode',
    position: { x: 380, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '引用與脈絡膠囊怎麼用？',
      response: `## 脈絡膠囊（Context Capsule）\n\n膠囊是你傳給 AI 的「精準注意力錨點」。你選取的段落會以結構化方式組裝進最後一則 user message，確保 AI 聚焦在你關心的部分。\n\n---\n\n## 三種加入方式\n\n**1. 精準引用（文字片段）**\n- 在閱讀面板選取文字 → 按 **⌘K / L / C**\n- 最常用、最省 Token\n\n**2. 全節點引用**\n- 在畫布上 **Option（Alt）+ 點擊**節點\n- 整個節點的 Prompt + Response 都加入\n\n**3. Shift+Click 多選（v2 新功能）**\n- 在畫布上 **Shift+點擊 2 個以上**節點\n- 這些節點成為新節點的**多個父節點**（DAG 匯聚）\n- 系統自動追溯所有父節點的祖先歷史並去重合併\n\n---\n\n## 多重引用\n\n可以同時引用**不同節點的不同段落**。每個被引用節點都會以獨立箭頭指向新節點，引用關係清晰可見。`,
      title: '引用、膠囊與多父節點',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 4: Reading panel shortcuts ───────────────────────────────────────
  {
    id: 'tutorial-4', type: 'thoughtNode',
    position: { x: 680, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '閱讀面板有哪些功能？',
      response: `## 閱讀面板（Reading Panel）\n\n右側面板是深度互動的主要區域。點擊畫布任意節點，完整內容在此展開。\n\n---\n\n## 選取文字後的浮動工具列\n\n| 快速鍵 | 功能 |\n|--------|------|\n| **⌘K / L / C** | 引用為脈絡膠囊 |\n| **H / F** | 螢光筆標記 |\n| **N / A / E** | 建立側邊筆記 |\n\n---\n\n## 側邊筆記（Annotation）\n\n選取段落後按 **N**，在右側建立筆記卡。筆記中可以繼續和 AI 對話，追蹤特定段落的想法而不污染主對話。\n\n---\n\n## 版面切換\n\n右上角三個按鈕切換：\n- 🖼 **畫布全螢幕**\n- ⬛ **左右分割（預設）**\n- 📄 **閱讀面板全螢幕**\n\n---\n\n## 其他快速鍵\n\n| 鍵 | 功能 |\n|----|------|\n| **⌘/** | 聚焦輸入框 |\n| 滑鼠側鍵 X1/X2 | 節點歷史前進/後退 |`,
      title: '閱讀面板快速鍵全覽',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 5: v2 features (DAG convergence — has 2 parents: nodes 2 & 3) ────
  {
    id: 'tutorial-5', type: 'thoughtNode',
    position: { x: 380, y: 360 },
    data: {
      type: 'thoughtNode',
      prompt: 'v2 三大新功能怎麼用？（此節點示範 DAG 匯聚：同時從節點 #2 和 #3 繼承）',
      response: `## 🔀 DAG 多父節點匯聚\n\n**你現在看到的這個節點本身就是示範** — 它同時有兩個父節點（#2 和 #3），兩條箭頭都指向這裡。\n\n### 如何觸發？\n\n在畫布上 **Shift+Click 2 個以上**節點，然後在輸入框發送問題。系統會：\n1. 為每個父節點各自拉一條箭頭\n2. 自動追溯所有父節點的祖先歷史\n3. 去重合併後按時間順序排列，再送給 AI\n\n---\n\n## 🎯 Context Scope 切換器\n\n輸入框上方有三個模式按鈕：\n\n| 模式 | 說明 | 適合場景 |\n|------|------|----------|\n| 🔗 **血親路徑**（預設）| 只追溯直系祖先 | 一般對話，省 Token |\n| 🌐 **所有節點** | 畫布全部節點 | 跨分支綜合歸納 |\n| 👆 **自定義** | Shift+Click 選取的節點本身（不追祖先）| 精準指定脈絡 |\n\n---\n\n## 🤖 AI Persona\n\n點擊**左上角 🤖 Persona 按鈕**，為這個畫布設定：\n- **角色名稱**（e.g. 蘇格拉底、程式審查員）\n- **系統指令**（繁體中文回答、特定角色扮演、輸出格式要求…）\n\nPersona 存在畫布內，每個畫布可以有不同的 AI 角色。有設定時按鈕會發光提醒你。`,
      title: 'v2 新功能：DAG 匯聚 · Scope · Persona',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 6: Getting started — API Key / login / Dev Mode ───────────────────
  {
    id: 'tutorial-6', type: 'thoughtNode',
    position: { x: 680, y: 360 },
    data: {
      type: 'thoughtNode',
      prompt: '如何開始真正對話？需要自己的 API Key 嗎？',
      response: `## 兩種使用方式\n\n你現在看到的兩個初始畫布（**Tutorial** 與 **關於 Radial AI**）不需登入、不需金鑰就能瀏覽。但要真正和 AI 對話，需要以下其一：\n\n---\n\n### 1. 自備 API Key（最自由）\n\n1. 點右上角 **⚙️ 設定**\n2. 貼上你的 **Google Gemini** 或 **Anthropic Claude** API Key\n3. 選擇模型 → 開始對話\n\n> 🔒 金鑰只存在你自己的瀏覽器（IndexedDB），不會上傳到任何伺服器。\n\n---\n\n### 2. 測試者模式 / Developer Mode\n\n1. 用**白名單 Google 帳號**登入\n2. 開啟 **Developer Mode** 開關\n3. 直接使用開發者後端金鑰（模型會鎖定）\n\n登入後右上角會出現**用量條（Usage Bar）**，即時顯示本月花費與額度。\n\n---\n\n## 切換模型\n\n設定面板可隨時切換不同模型。不同模型的速度、品質與成本各異，可依任務挑選。`,
      title: '開始使用：API Key 與登入',
      isLoading: false, isCollapsed: false,
    },
  },
];

const TUTORIAL_EDGES: Edge[] = [
  // Main timeline: 1 → 2
  { id: 'e-t1-t2', source: 'tutorial-1', target: 'tutorial-2', sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  // Branch: 1 → 3
  { id: 'e-t1-t3', source: 'tutorial-1', target: 'tutorial-3', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  // Branch: 3 → 4
  { id: 'e-t3-t4', source: 'tutorial-3', target: 'tutorial-4', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  // DAG convergence: 2 → 5 (demonstrates multi-parent)
  { id: 'e-t2-t5', source: 'tutorial-2', target: 'tutorial-5', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#a78bfa' } },
  // DAG convergence: 3 → 5 (second parent)
  { id: 'e-t3-t5', source: 'tutorial-3', target: 'tutorial-5', sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#a78bfa' } },
  // Getting started: 4 → 6
  { id: 'e-t4-t6', source: 'tutorial-4', target: 'tutorial-6', sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
];

function createTutorialProject(): Project {
  const now = Date.now();
  return { id: TUTORIAL_PROJECT_ID, name: 'Tutorial', createdAt: now, updatedAt: now, nodes: TUTORIAL_NODES, edges: TUTORIAL_EDGES };
}

// ── "About / Motivation" canvas (pre-created on first load) ────────────────────
// Q&A telling the story behind Radial AI — derived from the SDD.
const ABOUT_PROJECT_ID = 'about';

const ABOUT_NODES: Node<NodeData>[] = [
  // ── Node 1: Root — why ─────────────────────────────────────────────────────
  {
    id: 'about-1', type: 'thoughtNode',
    position: { x: 80, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '為什麼要打造 Radial AI？傳統 AI 對話有什麼問題？',
      response: `## 線性對話的痛點\n\n傳統 AI 聊天是一條**從上到下的單一捲軸**。對話一長，問題就浮現：\n\n- **脈絡被淹沒**：重要的早期回答被埋在幾百則訊息之下，難以回顧。\n- **無法分支**：想針對某句話追問一個小點，就會打斷主線，或讓對話越扯越遠。\n- **Context 暴漲**：整段歷史被無差別塞給 AI，**Token 成本飆升**、雜訊干擾判斷。\n- **思路被壓平**：人的思考是發散、網狀的，線性介面卻逼你走一條直線。\n\n---\n\n## Radial AI 的答案\n\n把對話變成一張**可視化的思維地圖**：每一次問答都是一個**節點**，可以分支、可以匯聚、可以精準挑選要傳給 AI 的歷史。\n\n> 一句話總結：**讓你成為 AI 的記憶管理員 —— 你決定它記得什麼、忘記什麼。**\n\n👉 這個畫布本身就用節點講述了 Radial AI 的設計故事，往下與往右繼續閱讀。`,
      title: '動機：打破線性對話',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 2: Core philosophy — split view ───────────────────────────────────
  {
    id: 'about-2', type: 'thoughtNode',
    position: { x: 80, y: 360 },
    data: {
      type: 'thoughtNode',
      prompt: 'Radial AI 的核心理念是什麼？為什麼要做成左右雙欄？',
      response: `## Split View（雙欄佈局）\n\nRadial AI 把畫面拆成各司其職的兩半：\n\n| 區域 | 角色 | 做什麼 |\n|------|------|--------|\n| 左：**無限畫布** | 結構與導航 | 拖曳節點、建立分支、綜觀整條思路脈絡 |\n| 右：**閱讀面板** | 深度閱讀與互動 | 如 Notion 般無干擾地閱讀、選取文字、引用、做筆記 |\n\n---\n\n## 為什麼要分開？\n\n單欄設計有一個致命衝突：**「拖曳畫布」和「選取文字」會搶同一個滑鼠手勢**。\n\nRadial AI 的解法是把**所有文字互動都集中在右側面板**，左側畫布則純粹處理圖形操作。各自專心，互不打架，體驗才會乾淨。`,
      title: '理念：雙欄佈局 Split View',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 3: Context control & cost (branch from 1) ─────────────────────────
  {
    id: 'about-3', type: 'thoughtNode',
    position: { x: 380, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '「放射狀引用」是怎麼解決 Token 成本與 Context 失控的？',
      response: `## 兩個核心機制\n\n### 1. 脈絡膠囊（Context Capsule）— 注意力錨點\n\n在右側面板選取段落 → 按 **⌘K** → 它化為一顆「膠囊」。發送時，只有你挑選的內容會被組裝進最後一則 user message，**精準告訴 AI「請聚焦這裡」**。\n\n### 2. 直系血親追溯（Ancestral Tracing）\n\n發送問題時，系統沿著畫布箭頭**往回追溯這條路徑的祖先節點**，把它們打包成歷史 —— 而不是把整張畫布幾百個節點全部塞給 AI。\n\n---\n\n## 帶來的好處\n\n- 💰 **省 Token**：只傳相關脈絡，不浪費。\n- 🎯 **更精準**：減少無關雜訊，AI 判斷更聚焦。\n- 🌿 **打破線性**：同一張畫布可同時跑多條互不干擾的對話路徑，每條傳給 API 的歷史都是你動態決定的。`,
      title: '引用機制：省 Token 又精準',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 4: Data model — materialized path (from 3) ────────────────────────
  {
    id: 'about-4', type: 'thoughtNode',
    position: { x: 680, y: 80 },
    data: {
      type: 'thoughtNode',
      prompt: '為什麼用「實體化路徑模型 (Materialized Path)」來設計資料？',
      response: `## 關鍵洞察：不可變的歷史\n\nAI 對話有個天然特性 —— **歷史一旦發生就不會改變**。節點一旦生成，「它的祖先是誰」就永遠固定，不會哪天把 Node 5 拔下來改接到 Node 1。\n\n---\n\n## 善用這個特性\n\n在每個節點建立時，**直接把它的「族譜」存進去**：\n\n\`\`\`json\n{\n  "id": "node_3",\n  "prompt": "那相對論呢？",\n  "ancestor_ids": ["node_1", "node_2"]\n}\n\`\`\`\n\n要打包歷史時，只看 \`ancestor_ids\` 一次撈回，**O(1) 極速查詢，不用每次爬樹**。\n\n生成新節點時：\n\`\`\`ts\nnewAncestorIds = [...parent.ancestorIds, parent.id]\n\`\`\`\n\n---\n\n## 為什麼這樣最好\n\n- ⚡ **效能最佳**：本地或雲端撈上下文都最快。\n- 🧩 **節點獨立**：好做協作，解決 NoSQL 難追溯關聯的痛點。\n- ☁️ **無痛上雲**：未來接 Firebase / Supabase，結構完全不用改寫。`,
      title: '資料模型：實體化路徑',
      isLoading: false, isCollapsed: false,
    },
  },
  // ── Node 5: Tech stack & roadmap (DAG convergence: 2 & 4) ──────────────────
  {
    id: 'about-5', type: 'thoughtNode',
    position: { x: 380, y: 360 },
    data: {
      type: 'thoughtNode',
      prompt: '用什麼技術做的？未來會長成什麼樣子？（此節點同時繼承「理念 #2」與「資料模型 #4」）',
      response: `## 技術棧\n\n| 層面 | 選擇 |\n|------|------|\n| 前端框架 | React + TypeScript + Tailwind CSS |\n| 左側畫布引擎 | React Flow（節點、邊線、拖曳、多選）|\n| 右側富文本 | Tiptap / ProseMirror（Medium 風格反白）|\n| 狀態管理 | Zustand（同步 Active Node，切換右側內容）|\n| 儲存 | IndexedDB（Local-First，免後端最快上線）|\n\n---\n\n## 部署策略\n\n1. **MVP**：純前端 Web App，資料存瀏覽器，零後端。\n2. **現在**：部署到 **Vercel**，任何人開網頁就能用。\n3. **未來**：整合 Firebase / Supabase 雲端同步；用 Tauri 封裝成原生 Mac App。\n\n---\n\n## 未來藍圖\n\n- 🔌 模型切換器、附件上傳、Deep Research 網路搜尋\n- 🎚️ 進階 Context Scope：全局歷史 / 自定義框選 / **RAG 語義相似度過濾**\n- ☁️ 雲端帳號與多人協作\n\n> 💡 這個節點本身示範了 **DAG 匯聚** —— 它同時從「雙欄理念」與「資料模型」兩條脈絡繼承而來。`,
      title: '技術棧與未來藍圖',
      isLoading: false, isCollapsed: false,
    },
  },
];

const ABOUT_EDGES: Edge[] = [
  // Timeline: 1 → 2
  { id: 'e-a1-a2', source: 'about-1', target: 'about-2', sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  // Branch: 1 → 3
  { id: 'e-a1-a3', source: 'about-1', target: 'about-3', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  // Branch: 3 → 4
  { id: 'e-a3-a4', source: 'about-3', target: 'about-4', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#f472b6' } },
  // DAG convergence: 2 → 5
  { id: 'e-a2-a5', source: 'about-2', target: 'about-5', sourceHandle: 'source-right', targetHandle: 'target-left', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#a78bfa' } },
  // DAG convergence: 4 → 5 (second parent)
  { id: 'e-a4-a5', source: 'about-4', target: 'about-5', sourceHandle: 'source-bottom', targetHandle: 'target-top', type: 'floatingEdge', markerEnd: { type: 'arrowclosed' as const }, style: { stroke: '#a78bfa' } },
];

function createAboutProject(): Project {
  const now = Date.now();
  return { id: ABOUT_PROJECT_ID, name: '關於 Radial AI', createdAt: now, updatedAt: now, nodes: ABOUT_NODES, edges: ABOUT_EDGES };
}

// Bump this whenever starter projects (tutorial / about) change so every
// install — new or existing — re-seeds the latest starter canvases.
const STARTER_PROJECT_IDS = new Set([TUTORIAL_PROJECT_ID, ABOUT_PROJECT_ID]);
const STARTER_SEED_VERSION = 1;

export {
  createTutorialProject,
  createAboutProject,
  STARTER_PROJECT_IDS,
  STARTER_SEED_VERSION,
};
