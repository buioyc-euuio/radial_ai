# Radial AI

將 AI 對話以**樹狀圖**呈現的無限畫布工具。左側畫布展示節點結構，右側閱讀面板提供完整閱讀與互動體驗。

---

## 跑起來 (Quick Start)

### 1. 安裝依賴

```bash
cd radial-ai
npm install
```

### 2. 啟動開發伺服器

```bash
npm run dev
```

瀏覽器打開 **http://localhost:5173**。

### 3. 設定 API Key

點右上角 **⚠ Set API Key**，選擇模型並填入 API Key：

- **Anthropic Claude** → [console.anthropic.com](https://console.anthropic.com/)
- **Google Gemini** → [aistudio.google.com](https://aistudio.google.com/app/apikey)

填完就可以在底部輸入框輸入問題，按 **Enter** 發送。

---

## 怎麼用

### 主時間線（無引用）
直接在底部輸入框輸入問題 → Enter 發送。新節點自動加入**左側垂直時間線**。

### 建立分支（有引用）
1. 點擊左側任意節點 → 右側顯示完整內容
2. 在右側**選取文字**
3. 按 **⌘K**（或點浮動工具列的「引用」）→ 文字以**脈絡膠囊**出現在輸入框上方
4. 輸入問題 → Enter → 新節點以**分支**連接被引用節點

> 可同時引用多個節點：每個被引用的節點都會各自拉一條箭頭指向新節點。

### 全節點引用
**Alt / Shift + 點擊**節點 → 整個節點加入引用。

### 閱讀面板快速鍵

| 快速鍵 | 功能 |
|--------|------|
| **⌘K** (選取後) | 引用文字為脈絡膠囊 |
| **H** (選取後) | 螢光筆（藍色） |
| **N** (選取後) | 建立側邊筆記 |
| **⌘/** | 聚焦底部輸入框 |
| **Enter** | 發送訊息 |
| **Shift+Enter** | 輸入框換行 |

### 節點操作

| 動作 | 方法 |
|------|------|
| 拖曳節點 | 拖動節點本體 |
| 刪除節點 | 點標題列右側 **✕** |
| 切換版面 | 右上角 Canvas / Split / Panel 按鈕 |

---

## 其他指令

```bash
npm run build      # 產出 production build → dist/
npm run preview    # 本地預覽 production build
npm run lint       # ESLint
```

---

## 資料儲存

所有畫布資料存在瀏覽器 **IndexedDB**，無需後端。清除瀏覽器資料即可重置。

---

## Tech Stack

| Layer | Library |
|-------|---------|
| Framework | React 19 + TypeScript |
| Canvas | @xyflow/react (React Flow) 12 |
| State | Zustand 5（IndexedDB persist） |
| Styling | Tailwind CSS v4 |
| Build | Vite 8 |
| AI APIs | Anthropic Claude API, Google Gemini API |
