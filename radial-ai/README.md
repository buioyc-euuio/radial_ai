# Radial AI

將 AI 對話以**有向無環圖（DAG）**呈現的無限畫布工具。左側畫布展示節點結構，右側閱讀面板提供完整閱讀與互動體驗。

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

### 建立分支（引用單一節點）
1. 點擊左側任意節點 → 右側顯示完整內容
2. 在右側**選取文字**
3. 按 **⌘K**（或點浮動工具列的「引用」）→ 文字以**脈絡膠囊**出現在輸入框上方
4. 輸入問題 → Enter → 新節點以**分支**連接被引用節點

### DAG 多父節點匯合（v2 新功能）
同時 **Shift+Click** 選取 2 個以上的節點，再在輸入框輸入問題 → Enter。

新節點將以**箭頭同時連接所有選取的節點**，AI 回答時會整合所有父節點的完整對話脈絡。適合將不同討論分支的結論**收斂為一個新觀點**。

> 選取節點後，節點邊框會顯示粉紅色高亮，確認選取狀態再發送。

### 全節點引用
**Alt / Option + 點擊**節點 → 整個節點加入引用膠囊。

---

## Context 範圍選擇器（v2 新功能）

輸入框上方的 Context 列可切換 AI 在回答時看到的對話範圍：

| 模式 | 圖示 | 說明 | 適用場景 |
|------|------|------|----------|
| **血親路徑** | 🔗 | 僅追溯當前節點沿箭頭往上的祖先對話（預設） | 延伸單一思路、最省 Token |
| **所有節點** | 🌐 | 傳送畫布上全部節點的內容 | 跨分支綜合歸納 ⚠ 高 Token |
| **自定義** | 👆 | Shift+Click 選取特定節點，僅以那些節點作為 Context | 精確選取上下文 |

---

## AI Persona（v2 新功能）

點擊畫布左上角 **🤖** 按鈕，可為當前畫布設定 AI 的角色與系統指令：

- **角色名稱**：例如「蘇格拉底」、「程式審查員」、「創意寫作夥伴」
- **系統指令（System Prompt）**：用自然語言描述 AI 的行為準則、語氣與限制

設定後，該 Persona 會套用至此畫布所有後續的 AI 對話。Persona 與畫布一起儲存。

---

## 快速鍵一覽

| 快速鍵 | 功能 |
|--------|------|
| **Enter** | 發送訊息 |
| **Shift+Enter** | 輸入框換行 |
| **⌘/** | 聚焦底部輸入框 |
| **⌘K**（選取文字後） | 引用為脈絡膠囊 |
| **Shift+Click 節點** | 多選節點（DAG 匯合 / 自定義 Context） |
| **Alt+Click 節點** | 整個節點加入引用 |
| **H**（選取文字後） | 螢光筆（藍色） |
| **N**（選取文字後） | 建立側邊筆記 |
| **Escape** | 關閉 Modal |

---

## 節點操作

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

---

## Changelog

### v2（2026-04）
- **DAG 多父節點匯合**：Shift+Click 多選節點後發送，新節點同時繼承所有父節點的對話脈絡
- **Floating Edges**：箭頭動態吸附至節點邊框，視覺更清晰
- **Context 範圍選擇器**：🔗 血親 / 🌐 全局 / 👆 自定義，精確控制 AI 閱讀的歷史範圍
- **AI Persona**：為每個畫布設定專屬角色與系統指令

### v1（2026-02）
- 初始版本：樹狀 AI 對話、分支引用、閱讀面板、螢光筆、側邊筆記
