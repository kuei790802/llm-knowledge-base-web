# LLM Knowledge Base Web

一個在瀏覽器裡使用 AI CLI 工具整理 Obsidian 知識庫的本地 Web App。

A local web app that lets you use AI CLI tools to organize your Obsidian vault — right in the browser.

---

## 目錄 / Table of Contents

- [這是什麼？/ What is this?](#這是什麼--what-is-this)
- [安裝指南（繁體中文）](#安裝指南繁體中文)
- [Installation Guide (English)](#installation-guide-english)
- [常見問題 / FAQ](#常見問題--faq)

---

## 這是什麼？ / What is this?

**中文**

這個工具讓你可以在瀏覽器視窗裡，直接對你的 Obsidian 筆記使用 AI 助理。左半邊是 AI 的互動式終端機（實際上就是你電腦裡的 Claude Code、Codex 或 Gemini CLI），右半邊同步顯示 Obsidian vault 裡的 wiki 筆記內容。

你不需要填入任何 API Key — AI 工具會使用你已經登入的帳號（Claude.ai 訂閱、ChatGPT 帳號、或 Google 帳號）。

主要功能：
- 在瀏覽器裡操作 Claude Code / Codex / Gemini CLI
- 一鍵 `Compile`：讓 AI 把你丟進 `raw/` 的資料整理成 wiki 文章
- 一鍵 `Lint`：讓 AI 檢查知識庫品質
- `Q&A`：用自然語言向 AI 查詢知識庫
- 支援手機、iPad（透過 Cloudflare Tunnel）

**English**

This tool gives you a browser window with an AI terminal on the left (your locally installed Claude Code, Codex, or Gemini CLI) and your Obsidian wiki on the right. Drop files into `raw/`, hit Compile, and the AI organizes them into structured wiki articles.

No API keys needed — the AI uses your existing subscription (Claude.ai, ChatGPT, or Google account).

---

## 安裝指南（繁體中文）

### 第一步：安裝必要工具

你的電腦需要安裝以下這些東西。每一項都附有安裝連結，點進去按照說明操作即可。

#### 1. Node.js（必要）

Node.js 是讓這個 App 能夠運作的基礎程式環境。

👉 前往 [nodejs.org](https://nodejs.org)，下載標示 **LTS** 的版本，安裝完成後不需要做任何設定。

安裝完後，開啟「終端機」（在 Mac 上按 `Command + Space`，搜尋「終端機」），輸入：
```
node -v
```
如果看到像 `v20.x.x` 這樣的數字就代表安裝成功。

#### 2. 至少安裝一個 AI CLI 工具

這三個選一個或多個安裝即可：

| 工具 | 所屬公司 | 需要的帳號 | 安裝指令 |
|------|----------|-----------|----------|
| **Claude Code**（推薦） | Anthropic | Claude.ai Pro 訂閱 | `npm install -g @anthropic-ai/claude-code` |
| **Codex** | OpenAI | OpenAI 帳號 + API Key | `npm install -g @openai/codex` |
| **Gemini CLI** | Google | Google 帳號 | `npm install -g @google/gemini-cli` |

在終端機輸入上面的指令，等待安裝完成。

**Claude Code 安裝後還需要登入：**
```
claude auth login
```
這個指令會開啟瀏覽器，用你的 Claude.ai 帳號登入即可。

#### 3. Xcode 命令列工具（Mac 限定，必要）

這是 Mac 上建立程式的基礎工具，一行指令安裝：
```
xcode-select --install
```
按照彈出的視窗點「安裝」，等待完成（約 5-10 分鐘）。

---

### 第二步：下載這個 App

開啟終端機，選一個你想放的位置（例如桌面），輸入：

```bash
git clone https://github.com/kuei790802/llm-knowledge-base-web.git
cd llm-knowledge-base-web
```

如果你不知道什麼是 `git`，也可以在這個頁面點右上角的「Code」→「Download ZIP」，解壓縮後進入那個資料夾，再繼續。

---

### 第三步：執行安裝腳本

在終端機裡，確認你已在 `llm-knowledge-base-web` 資料夾內，輸入：

```bash
bash setup.sh
```

腳本會帶你完成以下步驟（全程有提示，跟著填就對了）：

1. 確認必要工具都安裝好了
2. 安裝 App 的依賴套件
3. 詢問你的 **Obsidian Vault 路徑**（把 Obsidian 的資料夾拖進終端機視窗即可自動填入路徑）
4. 設定預設的知識庫領域（Domain）
5. 選擇預設使用哪個 AI CLI
6. 生成設定檔 `.env`

---

### 第四步：啟動！

安裝腳本結束後，輸入：

```bash
npm run dev
```

開啟瀏覽器，前往 **http://localhost:3000** 即可使用。

---

### 遠端存取（手機 / iPad 用）

如果你想在手機或同一 Wi-Fi 下的其他裝置使用，可以用 Cloudflare Tunnel：

1. 安裝 cloudflared：
   - Mac：`brew install cloudflared`
   - 或前往 [Cloudflare 官網](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) 下載

2. 改用以下指令啟動：
   ```bash
   npm run dev:tunnel
   ```
   終端機會顯示一個 `https://xxxx.trycloudflare.com` 的網址，手機直接連那個網址即可。

---

## Installation Guide (English)

### Step 1: Install required tools

#### 1. Node.js (required)

Download the **LTS** version from [nodejs.org](https://nodejs.org) and install it.

Verify in your terminal:
```bash
node -v
```
You should see something like `v20.x.x`.

#### 2. At least one AI CLI tool

| Tool | Company | Account needed | Install command |
|------|---------|----------------|-----------------|
| **Claude Code** (recommended) | Anthropic | Claude.ai Pro subscription | `npm install -g @anthropic-ai/claude-code` |
| **Codex** | OpenAI | OpenAI account + API key | `npm install -g @openai/codex` |
| **Gemini CLI** | Google | Google account | `npm install -g @google/gemini-cli` |

After installing Claude Code, log in:
```bash
claude auth login
```

#### 3. Xcode Command Line Tools (macOS only, required)

```bash
xcode-select --install
```

---

### Step 2: Download the app

```bash
git clone https://github.com/kuei790802/llm-knowledge-base-web.git
cd llm-knowledge-base-web
```

Or click **Code → Download ZIP** on this page and unzip it.

---

### Step 3: Run the setup script

```bash
bash setup.sh
```

The script will guide you through:
1. Checking prerequisites
2. Installing dependencies
3. Setting your Obsidian vault path (drag the folder into the terminal to auto-fill the path)
4. Choosing a default knowledge domain
5. Picking your preferred AI CLI
6. Writing the `.env` config file

---

### Step 4: Start the app

```bash
npm run dev
```

Open your browser at **http://localhost:3000**.

---

### Remote access (phone / tablet)

Use Cloudflare Tunnel to access from other devices on the same Wi-Fi:

1. Install cloudflared:
   - Mac: `brew install cloudflared`
   - Other: [download from Cloudflare](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

2. Start with tunnel:
   ```bash
   npm run dev:tunnel
   ```
   A public `https://xxxx.trycloudflare.com` URL will appear in the terminal. Open it on any device.

---

## 常見問題 / FAQ

**Q: 開啟 App 後左邊的終端機一直顯示「Disconnected」？**

A: 確認你有安裝至少一個 AI CLI 工具，且已登入。重新整理頁面後等待 3-5 秒。

**Q: The terminal keeps showing "Disconnected"?**

A: Make sure you have at least one AI CLI installed and authenticated. Refresh the page and wait a few seconds.

---

**Q: 執行 `bash setup.sh` 時出現 `Permission denied`？**

A: 輸入 `chmod +x setup.sh` 後再試一次。

**Q: Getting `Permission denied` when running `bash setup.sh`?**

A: Run `chmod +x setup.sh` first, then try again.

---

**Q: 我的 Obsidian Vault 在哪裡？**

A: 開啟 Obsidian → 左下角的 vault 名稱 → 右鍵「Reveal in Finder」（Mac）或「在檔案總管中顯示」（Windows），那個資料夾的路徑就是你的 Vault Path。

**Q: Where is my Obsidian vault?**

A: Open Obsidian → click the vault name at the bottom left → right-click → "Reveal in Finder" (Mac) or "Show in Explorer" (Windows). That folder path is your vault path.

---

**Q: 支援 Windows 嗎？**

A: 目前主要在 macOS 上開發與測試。Windows 理論上可以運作，但 `node-pty` 的 Windows 支援為實驗性質，可能需要額外的環境設定（如 Build Tools for Visual Studio）。

**Q: Does it work on Windows?**

A: Developed and tested primarily on macOS. Windows should work in theory, but `node-pty` Windows support is experimental and may require additional setup (Visual Studio Build Tools).

---

## 授權 / License

MIT
