#!/usr/bin/env bash
set -euo pipefail

# ── Colors & helpers ─────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "${GREEN}  ✓ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
err()  { echo -e "${RED}  ✗ $1${NC}"; }
info() { echo -e "    $1"; }
# Bilingual: print zh then en indented
msg() { echo -e "  ${CYAN}$1${NC}"; echo -e "  $2"; }

# ── Trap for clean exit on Ctrl+C ────────────────────────────────────
trap 'echo ""; warn "安裝中斷 / Setup interrupted."; exit 1' INT

# ── Banner ───────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔═════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   LLM Knowledge Base — Setup Script  v0.3  ║${NC}"
echo -e "${CYAN}╚═════════════════════════════════════════════╝${NC}"
echo ""

# ── Idempotency: detect existing .env ────────────────────────────────
if [ -f ".env" ]; then
  echo -e "${YELLOW}已找到現有設定檔 / Existing .env found.${NC}"
  read -r -p "  重新設定？/ Re-run setup? [y/N]: " RERUN
  RERUN="${RERUN:-N}"
  if [[ ! "$RERUN" =~ ^[Yy]$ ]]; then
    echo ""
    ok "保留現有設定 / Keeping existing config."
    echo ""
    read -r -p "  要現在啟動 server 嗎？/ Start server now? [Y/n]: " START_NOW
    START_NOW="${START_NOW:-Y}"
    if [[ "$START_NOW" =~ ^[Yy]$ ]]; then
      echo -e "${CYAN}  啟動中... / Starting...${NC}"
      [[ "$OSTYPE" == "darwin"* ]] && (sleep 3 && open http://localhost:3000) &
      npm run dev
    fi
    exit 0
  fi
  cp .env .env.backup 2>/dev/null || true
  ok "現有設定已備份至 .env.backup / Backed up existing config to .env.backup"
fi

# ── Network check ────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[0/6] 網路連線檢查 / Checking network...${NC}"
if ! curl -s --head --max-time 5 https://brew.sh > /dev/null 2>&1; then
  err "需要網路連線 / Internet connection required."
  err "請確認網路後重新執行 / Please check your connection and try again."
  exit 1
fi
ok "網路正常 / Network OK"

# ── Step 1: System prerequisites ─────────────────────────────────────
echo ""
echo -e "${BOLD}[1/6] 系統環境 / System prerequisites${NC}"

# ── 1a. Xcode Command Line Tools ──────────────────────────────────────
if xcode-select -p &>/dev/null; then
  ok "Xcode Command Line Tools"
else
  msg "Xcode Command Line Tools 未安裝" "Xcode Command Line Tools not found"
  info "即將安裝（會出現系統對話框，請點「安裝」）"
  info "A macOS dialog will appear — click \"Install\" to continue."
  echo ""
  xcode-select --install 2>/dev/null || true
  echo "  等待安裝完成 / Waiting for installation to complete..."
  while ! xcode-select -p &>/dev/null; do
    sleep 5
    printf "."
  done
  echo ""
  ok "Xcode Command Line Tools 安裝完成 / installed"
fi

# ── 1b. Homebrew ──────────────────────────────────────────────────────
# Detect Homebrew prefix (Apple Silicon vs Intel)
if [[ "$(uname -m)" == "arm64" ]]; then
  BREW_PREFIX="/opt/homebrew"
else
  BREW_PREFIX="/usr/local"
fi

# Source Homebrew into PATH if present but not in PATH
if [[ -x "$BREW_PREFIX/bin/brew" ]] && ! command -v brew &>/dev/null; then
  eval "$("$BREW_PREFIX/bin/brew" shellenv)"
fi

if command -v brew &>/dev/null; then
  ok "Homebrew $(brew --version | head -1 | awk '{print $2}')"
else
  msg "正在安裝 Homebrew..." "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Add to PATH for this session (Apple Silicon)
  if [[ -x "$BREW_PREFIX/bin/brew" ]]; then
    eval "$("$BREW_PREFIX/bin/brew" shellenv)"
  fi

  # Persist to shell profile
  SHELL_PROFILE="$HOME/.zprofile"
  if ! grep -q 'brew shellenv' "$SHELL_PROFILE" 2>/dev/null; then
    echo "" >> "$SHELL_PROFILE"
    echo "# Homebrew" >> "$SHELL_PROFILE"
    echo "eval \"\$($BREW_PREFIX/bin/brew shellenv)\"" >> "$SHELL_PROFILE"
  fi

  if command -v brew &>/dev/null; then
    ok "Homebrew 安裝完成 / installed"
  else
    err "Homebrew 安裝失敗 / Homebrew install failed."
    err "請手動安裝：https://brew.sh"
    exit 1
  fi
fi

# ── 1c. Node.js ───────────────────────────────────────────────────────
NODE_OK=false
if command -v node &>/dev/null; then
  NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
  if [ "$NODE_MAJOR" -ge 18 ]; then
    NODE_OK=true
    ok "Node.js $(node -v)"
  else
    warn "Node.js $(node -v) 版本太舊 / too old (need v18+). Upgrading..."
  fi
fi

if [ "$NODE_OK" = false ]; then
  msg "正在安裝 Node.js..." "Installing Node.js via Homebrew..."
  if command -v brew &>/dev/null; then
    brew install node
    ok "Node.js $(node -v) 安裝完成 / installed"
  else
    err "無法安裝 Node.js / Cannot install Node.js automatically."
    err "請前往 https://nodejs.org 下載安裝 LTS 版本，然後重新執行此腳本。"
    err "Download Node.js LTS from https://nodejs.org then re-run this script."
    exit 1
  fi
fi

# ── Step 2: Obsidian ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[2/6] 筆記工具 / Note-taking app${NC}"
msg "這套系統使用本地 Markdown 資料夾儲存知識庫。" \
    "This system stores your knowledge base as plain Markdown files."
msg "Obsidian 是最佳搭配工具（可選）。" \
    "Obsidian is the recommended companion app (optional)."
echo ""

OBSIDIAN_INSTALLED=false
if [ -d "/Applications/Obsidian.app" ] || brew list --cask obsidian &>/dev/null 2>&1; then
  OBSIDIAN_INSTALLED=true
  ok "Obsidian 已安裝 / already installed"
else
  read -r -p "  要安裝 Obsidian 嗎？/ Install Obsidian? [Y/n]: " INSTALL_OBS
  INSTALL_OBS="${INSTALL_OBS:-Y}"
  if [[ "$INSTALL_OBS" =~ ^[Yy]$ ]]; then
    msg "正在安裝 Obsidian..." "Installing Obsidian..."
    brew install --cask obsidian && ok "Obsidian 安裝完成 / installed" || warn "安裝失敗，請手動從 https://obsidian.md 下載 / Install failed, download from https://obsidian.md"
  else
    info "跳過 / Skipped. 你可以用 VS Code 或任何 Markdown 編輯器開啟知識庫資料夾。"
    info "You can open the knowledge base folder with VS Code or any Markdown editor."
  fi
fi

# ── Step 3: LLM CLI install + auth ───────────────────────────────────
echo ""
echo -e "${BOLD}[3/6] AI 工具安裝與登入 / AI CLI setup${NC}"

AVAILABLE_CLIS=()

install_cli_if_missing() {
  local name="$1" cmd="$2" pkg="$3"
  if command -v "$cmd" &>/dev/null; then
    ok "$name 已安裝 / already installed"
    AVAILABLE_CLIS+=("$cmd")
    return
  fi
  msg "正在安裝 $name..." "Installing $name..."
  if npm install -g "$pkg" 2>&1; then
    ok "$name 安裝完成 / installed"
    AVAILABLE_CLIS+=("$cmd")
  elif npm install -g "$pkg" 2>&1 | grep -q 'EACCES'; then
    warn "權限不足，嘗試 sudo / Permission denied, retrying with sudo..."
    sudo npm install -g "$pkg" && ok "$name 安裝完成 (sudo) / installed" && AVAILABLE_CLIS+=("$cmd") || err "$name 安裝失敗 / install failed"
  else
    err "$name 安裝失敗 / install failed"
  fi
}

# Detect already-installed CLIs first
for entry in "Claude Code:claude" "Gemini CLI:gemini" "Codex:codex"; do
  name="${entry%%:*}"; cmd="${entry##*:}"
  command -v "$cmd" &>/dev/null && AVAILABLE_CLIS+=("$cmd")
done
# Deduplicate
AVAILABLE_CLIS=($(printf '%s\n' "${AVAILABLE_CLIS[@]}" | sort -u))

if [ ${#AVAILABLE_CLIS[@]} -eq 0 ]; then
  echo ""
  msg "選擇要安裝的 AI 助理（至少選一個）" \
      "Choose AI assistant(s) to install (at least one required)"
  echo ""
  echo "    [1] Claude Code  — 推薦 / Recommended (Anthropic, 需要 Claude Pro/Max 訂閱)"
  echo "    [2] Gemini CLI   — 免費 / Free (Google, 用 Google 帳號登入)"
  echo "    [3] Codex        — (OpenAI, 需要 API Key 或 ChatGPT Plus)"
  echo "    [4] 全部安裝 / Install all"
  echo ""
  read -r -p "  選擇 / Choose [1]: " CLI_CHOICE
  CLI_CHOICE="${CLI_CHOICE:-1}"

  case "$CLI_CHOICE" in
    1)   install_cli_if_missing "Claude Code" "claude" "@anthropic-ai/claude-code" ;;
    2)   install_cli_if_missing "Gemini CLI"  "gemini" "@google/gemini-cli" ;;
    3)   install_cli_if_missing "Codex"       "codex"  "@openai/codex" ;;
    4)
      install_cli_if_missing "Claude Code" "claude" "@anthropic-ai/claude-code"
      install_cli_if_missing "Gemini CLI"  "gemini" "@google/gemini-cli"
      install_cli_if_missing "Codex"       "codex"  "@openai/codex"
      ;;
    *)   install_cli_if_missing "Claude Code" "claude" "@anthropic-ai/claude-code" ;;
  esac
else
  echo ""
  msg "已找到以下 AI 工具 / Found these AI tools:"
  for cmd in "${AVAILABLE_CLIS[@]}"; do
    case "$cmd" in
      claude) ok "Claude Code" ;;
      gemini) ok "Gemini CLI" ;;
      codex)  ok "Codex" ;;
    esac
  done
  echo ""
  read -r -p "  要安裝其他 AI 工具嗎？/ Install additional AI tools? [y/N]: " ADD_MORE
  ADD_MORE="${ADD_MORE:-N}"
  if [[ "$ADD_MORE" =~ ^[Yy]$ ]]; then
    command -v claude &>/dev/null || install_cli_if_missing "Claude Code" "claude" "@anthropic-ai/claude-code"
    command -v gemini &>/dev/null || install_cli_if_missing "Gemini CLI"  "gemini" "@google/gemini-cli"
    command -v codex  &>/dev/null || install_cli_if_missing "Codex"       "codex"  "@openai/codex"
  fi
fi

if [ ${#AVAILABLE_CLIS[@]} -eq 0 ]; then
  err "沒有可用的 AI 工具 / No AI tools available. Cannot continue."
  exit 1
fi

# ── Auth ──────────────────────────────────────────────────────────────
echo ""
msg "檢查登入狀態 / Checking authentication..."

OPENAI_API_KEY="${OPENAI_API_KEY:-}"
GEMINI_API_KEY="${GEMINI_API_KEY:-}"

for cmd in "${AVAILABLE_CLIS[@]}"; do
  case "$cmd" in
    claude)
      if claude auth status &>/dev/null; then
        ok "Claude Code 已登入 / authenticated"
      else
        warn "Claude Code 尚未登入 / not logged in"
        msg "即將開啟瀏覽器進行登入..." "Opening browser for authentication..."
        claude auth login || warn "登入未完成，稍後可執行 claude auth login / Complete later with: claude auth login"
        claude auth status &>/dev/null && ok "Claude Code 登入成功 / authenticated" || warn "Claude Code 尚未登入，請稍後手動執行 claude auth login"
      fi
      ;;
    gemini)
      ok "Gemini CLI — 會在第一次使用時要求 Google 登入 / will prompt Google sign-in on first use"
      if [ -z "$GEMINI_API_KEY" ]; then
        echo ""
        read -r -s -p "  Gemini API Key（可選，直接 Enter 跳過 / optional, press Enter to skip）: " GEMINI_API_KEY_INPUT
        echo ""
        GEMINI_API_KEY="${GEMINI_API_KEY_INPUT}"
      fi
      ;;
    codex)
      if [ -n "$OPENAI_API_KEY" ]; then
        ok "Codex — OPENAI_API_KEY 已設定 / set"
      else
        warn "Codex 需要 OpenAI API Key 或 ChatGPT Plus 帳號"
        warn "Codex requires an OpenAI API Key or ChatGPT Plus account"
        echo ""
        read -r -s -p "  OpenAI API Key（可選，直接 Enter 跳過 / optional, press Enter to skip）: " OPENAI_KEY_INPUT
        echo ""
        OPENAI_API_KEY="${OPENAI_KEY_INPUT}"
        [ -n "$OPENAI_API_KEY" ] && ok "OPENAI_API_KEY 已設定 / set" || info "稍後在 .env 裡設定 OPENAI_API_KEY / Set OPENAI_API_KEY in .env later"
      fi
      ;;
  esac
done

# ── Step 4: npm install ───────────────────────────────────────────────
echo ""
echo -e "${BOLD}[4/6] 安裝專案套件 / Installing project dependencies${NC}"
npm install
# Ensure node-pty spawn-helper is executable (postinstall may have set it, verify)
chmod +x node_modules/node-pty/prebuilds/darwin-*/spawn-helper 2>/dev/null || true
ok "套件安裝完成 / Dependencies installed"

# ── Step 5: Configuration ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}[5/6] 互動設定 / Configuration${NC}"

# ── 5a. Vault path ────────────────────────────────────────────────────
echo ""
msg "請輸入你的知識庫資料夾路徑（可以是任何資料夾，不限 Obsidian）" \
    "Enter the path to your knowledge base folder (any folder works)"
info "提示：把資料夾拖進這個視窗可以自動填入路徑"
info "Tip: drag the folder into this terminal window to auto-fill the path"
echo ""

VAULT_PATH=""
for attempt in 1 2 3; do
  read -r -p "  知識庫路徑 / Folder path: " VAULT_PATH_INPUT

  # Strip surrounding quotes (from drag-and-drop), trailing slash, expand ~
  VAULT_PATH="${VAULT_PATH_INPUT//\'/}"
  VAULT_PATH="${VAULT_PATH//\"/}"
  VAULT_PATH="${VAULT_PATH%/}"
  VAULT_PATH="${VAULT_PATH/#\~/$HOME}"
  # Trim whitespace
  VAULT_PATH="$(echo "$VAULT_PATH" | xargs)"

  if [ -d "$VAULT_PATH" ]; then
    ok "知識庫路徑 / Vault: $VAULT_PATH"
    break
  else
    if [ $attempt -lt 3 ]; then
      err "找不到這個資料夾 / Directory not found: $VAULT_PATH"
      info "請再試一次 / Please try again"
    else
      err "無法找到資料夾，放棄 / Cannot find directory after 3 attempts. Aborting."
      exit 1
    fi
  fi
done

# ── 5b. Domains ───────────────────────────────────────────────────────
echo ""
msg "知識庫領域設定 / Knowledge domains"

DOMAINS=()
while IFS= read -r -d '' d; do
  DOMAIN_DIR=$(dirname "$(dirname "$d")")
  DOMAIN_NAME=$(basename "$DOMAIN_DIR")
  DOMAINS+=("$DOMAIN_NAME")
done < <(find "$VAULT_PATH" -maxdepth 3 -name "_WORKFLOW.md" -print0 2>/dev/null)

DEFAULT_DOMAIN=""

if [ ${#DOMAINS[@]} -eq 0 ]; then
  info "找不到現有領域，建立第一個 / No existing domains found. Creating your first one."
  echo ""
  read -r -p "  領域名稱 / Domain name (e.g. PMP, AI, Investment): " DOMAIN_NAME_INPUT
  DEFAULT_DOMAIN="${DOMAIN_NAME_INPUT:-MyKnowledge}"

  DOMAIN_BASE="$VAULT_PATH/$DEFAULT_DOMAIN"
  mkdir -p "$DOMAIN_BASE/raw" "$DOMAIN_BASE/wiki/qa"

  cat > "$DOMAIN_BASE/raw/README.md" << RAWEOF
# ${DEFAULT_DOMAIN} Raw — 原始資料

把未整理的原始資料丟進這個資料夾。
執行 \`compile ${DEFAULT_DOMAIN}\` 後，AI 會把這裡的內容整理成 wiki 文章。

Put unprocessed notes, web clips, and documents here.
Run \`compile ${DEFAULT_DOMAIN}\` to have the AI organize them into wiki articles.
RAWEOF

  TODAY=$(date +%Y-%m-%d)
  cat > "$DOMAIN_BASE/wiki/_WORKFLOW.md" << WFEOF
# Compile & Lint Workflow — ${DEFAULT_DOMAIN}

> 這份檔案定義 AI 在執行 \`compile ${DEFAULT_DOMAIN}\` 和 \`lint ${DEFAULT_DOMAIN}\` 時的行為規則。
> This file defines the AI's behavior for compile and lint commands.

## Source Material

| 角色 / Role | 路徑 / Path |
|-------------|-------------|
| 原始資料 / Raw input | \`${DEFAULT_DOMAIN}/raw/\` |
| Wiki 文章 / Wiki articles | \`${DEFAULT_DOMAIN}/wiki/\` |

## Article Quality Standard

每篇 wiki 文章必須具備 / Each wiki article must have:

1. Frontmatter (type, date, tags, status, source)
2. Summary callout: \`> [!summary]\`
3. Backlinks to related articles: \`## Related\`

## Compile Rules

- 重複內容 → 整合到現有文章 / Duplicate → merge into existing article
- 新概念 → 建立新文章 / New concept → create new article
- 低價值內容 → 跳過並說明原因 / Low-value → skip with reason

## Lint Rules

| 規則 / Rule | 動作 / Action |
|-------------|--------------|
| 缺少 frontmatter | 標記補充 / Flag for completion |
| seedling 超過 30 天 | 標記複習 / Flag for review |
WFEOF

  cat > "$DOMAIN_BASE/wiki/_index.md" << IDXEOF
---
type: kb-index
domain: ${DEFAULT_DOMAIN}
last_compiled: ${TODAY}
article_count: 0
---

# ${DEFAULT_DOMAIN} Knowledge Base Index
> Auto-maintained by AI. Do not edit manually.

## Domain Summary
New domain — run \`compile ${DEFAULT_DOMAIN}\` to populate.

## Concept Glossary
| Concept | Definition | Primary Article |
|---------|------------|-----------------|

## Article Registry
| Article | Summary | Status | Updated |
|---------|---------|--------|---------|

## Compile History
| Date | Action | Notes |
|------|--------|-------|
| ${TODAY} | Domain initialized | Empty vault |
IDXEOF

  touch "$DOMAIN_BASE/wiki/qa/.gitkeep"
  ok "建立領域 / Created domain: $DEFAULT_DOMAIN"

else
  info "找到 ${#DOMAINS[@]} 個領域 / Found ${#DOMAINS[@]} domain(s):"
  for i in "${!DOMAINS[@]}"; do
    info "  $((i+1)). ${DOMAINS[$i]}"
  done
  echo ""
  read -r -p "  預設顯示哪個？/ Default domain [${DOMAINS[0]}]: " DOMAIN_CHOICE
  DEFAULT_DOMAIN="${DOMAIN_CHOICE:-${DOMAINS[0]}}"
  ok "預設領域 / Default domain: $DEFAULT_DOMAIN"
fi

# ── 5c. CLAUDE.md (and GEMINI.md / AGENTS.md) ─────────────────────────
echo ""
CLAUDE_MD="$VAULT_PATH/CLAUDE.md"
if [ -f "$CLAUDE_MD" ]; then
  ok "CLAUDE.md 已存在 / already exists"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  if [ -f "$SCRIPT_DIR/templates/CLAUDE.md" ]; then
    cp "$SCRIPT_DIR/templates/CLAUDE.md" "$CLAUDE_MD"
    ok "已生成 CLAUDE.md 到知識庫根目錄 / Generated CLAUDE.md in vault root"
  else
    warn "找不到 templates/CLAUDE.md，跳過 / templates/CLAUDE.md not found, skipping"
  fi
fi

# Sync CLAUDE.md → GEMINI.md / AGENTS.md
for target_file in GEMINI.md AGENTS.md; do
  target="$VAULT_PATH/$target_file"
  if [ ! -f "$target" ] && [ -f "$CLAUDE_MD" ]; then
    cp "$CLAUDE_MD" "$target"
    ok "已同步 / Synced $target_file"
  fi
done

# ── 5d. Access token ──────────────────────────────────────────────────
echo ""
msg "Cloudflare Tunnel 存取密碼（選用）" \
    "Cloudflare Tunnel access token (optional)"
info "若要從手機或外部網路存取，請設定密碼保護。"
info "Set a password if you'll access from phone or outside your local network."
echo ""
read -r -s -p "  存取密碼 / Access token (press Enter to skip): " ACCESS_TOKEN
echo ""
[ -z "$ACCESS_TOKEN" ] && ok "無密碼，僅限本機 / No token — local access only" || ok "存取密碼已設定 / Access token set"

# ── 5e. Default CLI provider ──────────────────────────────────────────
echo ""
CLI_PROVIDER="${AVAILABLE_CLIS[0]}"
if [ ${#AVAILABLE_CLIS[@]} -gt 1 ]; then
  info "選擇預設 AI 工具 / Choose default AI tool:"
  for i in "${!AVAILABLE_CLIS[@]}"; do
    info "  $((i+1)). ${AVAILABLE_CLIS[$i]}"
  done
  echo ""
  read -r -p "  預設 / Default [${AVAILABLE_CLIS[0]}]: " CLI_CHOICE_DEFAULT
  if [ -n "$CLI_CHOICE_DEFAULT" ]; then
    if [[ "$CLI_CHOICE_DEFAULT" =~ ^[0-9]+$ ]] && \
       [ "$CLI_CHOICE_DEFAULT" -ge 1 ] && \
       [ "$CLI_CHOICE_DEFAULT" -le "${#AVAILABLE_CLIS[@]}" ]; then
      CLI_PROVIDER="${AVAILABLE_CLIS[$((CLI_CHOICE_DEFAULT-1))]}"
    else
      CLI_PROVIDER="$CLI_CHOICE_DEFAULT"
    fi
  fi
fi
ok "預設 AI 工具 / Default CLI: $CLI_PROVIDER"

# ── Step 6: Write .env ────────────────────────────────────────────────
echo ""
echo -e "${BOLD}[6/6] 寫入設定 / Writing configuration${NC}"

cat > .env << ENVEOF
# Generated by setup.sh on $(date)
VAULT_PATH="$VAULT_PATH"
DEFAULT_DOMAIN=$DEFAULT_DOMAIN
NEXT_PUBLIC_DEFAULT_DOMAIN=$DEFAULT_DOMAIN
ACCESS_TOKEN=$ACCESS_TOKEN
PORT=3000
CLI_PROVIDER=$CLI_PROVIDER
NEXT_PUBLIC_CLI_PROVIDER=$CLI_PROVIDER
ENVEOF

[ -n "$OPENAI_API_KEY" ] && echo "OPENAI_API_KEY=$OPENAI_API_KEY" >> .env
[ -n "$GEMINI_API_KEY" ] && echo "GEMINI_API_KEY=$GEMINI_API_KEY" >> .env

ok ".env 寫入完成 / .env created"

# ── Done ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔═════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║          安裝完成！/ Setup complete!         ║${NC}"
echo -e "${GREEN}╚═════════════════════════════════════════════╝${NC}"
echo ""
echo "  已安裝 / Installed:"
for cmd in "${AVAILABLE_CLIS[@]}"; do
  case "$cmd" in
    claude) info "  ✓ Claude Code" ;;
    gemini) info "  ✓ Gemini CLI" ;;
    codex)  info "  ✓ Codex" ;;
  esac
done
echo ""
echo "  知識庫 / Vault:  $VAULT_PATH"
echo "  預設領域 / Domain: $DEFAULT_DOMAIN"
echo "  預設 AI / CLI:  $CLI_PROVIDER"
echo ""
echo "  啟動指令 / To start:    ${CYAN}npm run dev${NC}"
echo "  遠端存取 / With tunnel: ${CYAN}npm run dev:tunnel${NC}"
echo ""

if [[ "$OSTYPE" == "darwin"* ]]; then
  read -r -p "  現在啟動嗎？/ Start the server now? [Y/n]: " START_NOW
  START_NOW="${START_NOW:-Y}"
  if [[ "$START_NOW" =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}  啟動中... http://localhost:3000${NC}"
    (sleep 3 && open http://localhost:3000) &
    npm run dev
  fi
fi
