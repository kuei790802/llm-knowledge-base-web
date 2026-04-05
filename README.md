# LLM Knowledge Base Web

在瀏覽器裡用 AI CLI 整理你的 Markdown 知識庫。

A browser-based interface for managing a Markdown knowledge base with AI CLI tools.

---

## 這是什麼？ / What is this?

**中文**

這個工具讓你在瀏覽器視窗裡，直接用 AI 助理整理、查詢你的本地筆記。

- **左半邊**：AI 互動終端機（Claude Code、Gemini CLI 或 Codex）
- **右半邊**：即時顯示知識庫 wiki 文章

知識庫本身只是**一個裝 Markdown 的本地資料夾**。Obsidian 是最佳搭配工具（資料夾式 Markdown 編輯器），但 VS Code、Logseq 等也可以。

**English**

This tool gives you a browser window with an AI terminal on the left (Claude Code, Gemini CLI, or Codex) and your Markdown wiki on the right.

Your knowledge base is just **a local folder of Markdown files**. Obsidian is the best companion app (it's folder-based), but VS Code, Logseq, etc. work too.

主要功能 / Key features:
- 一鍵 **Compile** — AI 把 `raw/` 裡的原始資料整理成 wiki 文章
- 一鍵 **Lint** — AI 檢查知識庫品質
- **Q&A** — 用自然語言查詢你的知識庫
- 支援 **Claude Code、Gemini CLI、Codex** — 瀏覽器內一鍵切換
- 支援手機、iPad（透過 Cloudflare Tunnel）

> **不需要 API Key**。AI 工具使用你已有的訂閱帳號（Claude.ai、Google 帳號等）。

---

## 目錄 / Table of Contents

- [安裝指南（繁體中文）](#安裝指南繁體中文)
- [Installation Guide (English)](#installation-guide-english)
- [知識庫結構 / Vault Structure](#知識庫結構--vault-structure)
- [常見問題 / FAQ](#常見問題--faq)

---

## 安裝指南（繁體中文）

### 事前準備：僅需 git

這份腳本會自動安裝其他所有東西（Homebrew、Node.js、Obsidian、AI CLI）。
你只需要：

1. 在 macOS 上開啟**終端機**（按 `Command + Space`，輸入「終端機」）
2. 確認有網路連線

### 第一步：下載這個專案

在終端機輸入：

```bash
git clone https://github.com/kuei790802/llm-knowledge-base-web.git
cd llm-knowledge-base-web
```

> 第一次執行 `git` 時，macOS 可能會彈出視窗要求安裝「Xcode Command Line Tools」，按「安裝」即可，等待完成後重新輸入指令。

### 第二步：執行安裝腳本

```bash
bash setup.sh
```

腳本會引導你完成以下步驟（全程有提示，跟著做就對了）：

| 步驟 | 內容 | 自動處理？ |
|------|------|-----------|
| 系統環境 | Homebrew、Node.js | ✅ 自動安裝 |
| 筆記工具 | Obsidian（建議） | ✅ 詢問後安裝 |
| AI 工具 | Claude Code / Gemini / Codex | ✅ 選擇後安裝 |
| 登入認證 | 開瀏覽器完成 OAuth | 👤 需要你操作 |
| 知識庫設定 | 選擇資料夾、建立領域 | 👤 輸入路徑 |

> Obsidian Vault 路徑提示：把資料夾從 Finder 拖進終端機視窗，路徑會自動填入。

### 第三步：啟動

安裝完後，腳本會詢問是否立即啟動。或者你之後可以隨時執行：

```bash
npm run dev
```

開啟瀏覽器前往 **http://localhost:3000**。

---

### 遠端存取（手機 / iPad）

透過 Cloudflare Tunnel 從任何裝置存取：

1. 安裝 cloudflared：`brew install cloudflared`
2. 改用這個指令啟動：`npm run dev:tunnel`
3. 終端機會顯示 `https://xxxx.trycloudflare.com` 網址，手機直接開那個連結

---

## Installation Guide (English)

### Prerequisites: git only

The setup script installs everything else (Homebrew, Node.js, Obsidian, AI CLI) automatically.

You only need:
1. Open **Terminal** on macOS (Spotlight: `Command + Space`, type "Terminal")
2. Internet connection

### Step 1: Clone the repo

```bash
git clone https://github.com/kuei790802/llm-knowledge-base-web.git
cd llm-knowledge-base-web
```

> If this is your first time running `git`, macOS may prompt you to install "Xcode Command Line Tools" — click "Install" and wait for it to finish, then run the command again.

### Step 2: Run the setup script

```bash
bash setup.sh
```

The script will walk you through:

| Step | What | Automated? |
|------|------|------------|
| System | Homebrew, Node.js | ✅ Auto-installed |
| Notes app | Obsidian (recommended) | ✅ Asks then installs |
| AI tools | Claude Code / Gemini / Codex | ✅ Pick then install |
| Auth | Browser-based OAuth | 👤 You sign in |
| Config | Folder path, domain setup | 👤 You enter path |

> Tip: drag your folder from Finder into the terminal window to auto-fill the path.

### Step 3: Start

The script will ask if you want to start now. Or run any time:

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

---

### Remote access (phone / tablet)

Via Cloudflare Tunnel:

1. `brew install cloudflared`
2. `npm run dev:tunnel`
3. A `https://xxxx.trycloudflare.com` URL appears — open it on any device

---

## 知識庫結構 / Vault Structure

```
你的資料夾 / Your folder
├── CLAUDE.md      ← AI 工作規則（setup 自動生成）
├── GEMINI.md      ← 同步自 CLAUDE.md
├── AGENTS.md      ← 同步自 CLAUDE.md
│
└── {領域名稱}/    ← 每個主題一個資料夾（可以有多個）
    ├── raw/       ← 【放原始資料】未整理的筆記、剪貼、PDF
    └── wiki/
        ├── _WORKFLOW.md  ← 這個領域的編輯規則
        ├── _index.md     ← 索引（AI 自動維護）
        ├── 文章.md        ← AI 整理好的 wiki 文章
        └── qa/           ← Q&A 紀錄
```

**使用流程：**
1. 把原始資料丟進 `raw/`
2. 在瀏覽器終端機輸入 `compile {領域名稱}`
3. AI 把資料整理成 wiki 文章寫進 `wiki/`
4. 右側 Wiki 面板即時更新

---

## 常見問題 / FAQ

**Q: 終端機一直顯示「Disconnected」？**

A: 確認至少安裝了一個 AI CLI 且已登入。重新整理頁面等 3-5 秒。

**Q: The terminal keeps showing "Disconnected"?**

A: Make sure at least one AI CLI is installed and authenticated. Refresh and wait a few seconds.

---

**Q: 我需要安裝 Obsidian 嗎？**

A: 不強制。這套系統只讀寫普通 Markdown 檔案，任何資料夾都可以當知識庫。但 Obsidian 是最好的搭配工具，因為它直接以資料夾為 vault，可以即時看到 AI 整理好的文章。

**Q: Do I need Obsidian installed?**

A: Not required. This system works with any folder of Markdown files. But Obsidian is the best companion since it treats folders as vaults natively.

---

**Q: 我的 Obsidian Vault 在哪裡？**

A: 開啟 Obsidian → 左下角 vault 名稱 → 右鍵「Reveal in Finder」→ 把那個資料夾拖進終端機。

**Q: Where is my Obsidian vault?**

A: Obsidian → vault name (bottom left) → right-click → "Reveal in Finder" → drag that folder into the terminal.

---

**Q: 切換 AI 工具後沒反應？**

A: 重新整理頁面，或點選狀態列的「CLI」下拉選單重新選擇。

---

**Q: 支援 Windows 嗎？**

A: 主要在 macOS 開發。Linux 可以，Windows 的 `node-pty` 是實驗性支援。

**Q: Does it work on Windows?**

A: Developed on macOS. Linux works. Windows has experimental `node-pty` support.

---

## 授權 / License

MIT
