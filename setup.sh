#!/usr/bin/env bash
set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     LLM Knowledge Base — Setup Script     ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════╝${NC}"
echo ""

# ── Step 1: Check prerequisites ──────────────────────────────────────
echo -e "${YELLOW}[1/6] Checking prerequisites...${NC}"

# Node.js
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Node.js not found.${NC}"
  echo "  Download it from: https://nodejs.org (LTS version recommended)"
  exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo -e "${RED}✗ Node.js $NODE_VERSION is too old. Need v18 or later.${NC}"
  echo "  Download latest LTS from: https://nodejs.org"
  exit 1
fi
echo -e "${GREEN}  ✓ Node.js $NODE_VERSION${NC}"

# Xcode Command Line Tools (needed for node-pty compilation)
if [[ "$OSTYPE" == "darwin"* ]]; then
  if ! xcode-select -p &> /dev/null; then
    echo -e "${RED}✗ Xcode Command Line Tools not found (needed to build native modules).${NC}"
    echo "  Run: xcode-select --install"
    exit 1
  fi
  echo -e "${GREEN}  ✓ Xcode Command Line Tools${NC}"
fi

# Claude Code CLI
if ! command -v claude &> /dev/null; then
  echo -e "${RED}✗ Claude Code CLI not found.${NC}"
  echo "  Install it: npm install -g @anthropic-ai/claude-code"
  echo "  Then log in: claude auth login"
  exit 1
fi
CLAUDE_VERSION=$(claude --version 2>/dev/null || echo "unknown")
echo -e "${GREEN}  ✓ Claude Code ($CLAUDE_VERSION)${NC}"

# Claude auth status
if ! claude auth status &> /dev/null; then
  echo -e "${YELLOW}⚠ Claude Code is not logged in.${NC}"
  echo "  Please log in first:"
  echo ""
  echo "    claude auth login"
  echo ""
  echo "  This will open your browser to authenticate with your Claude.ai account."
  exit 1
fi
echo -e "${GREEN}  ✓ Claude Code authenticated${NC}"

# ── Step 2: Install dependencies ─────────────────────────────────────
echo ""
echo -e "${YELLOW}[2/6] Installing dependencies...${NC}"
npm install
echo -e "${GREEN}✓ Dependencies installed${NC}"

# ── Step 3: Vault path ───────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[3/6] Obsidian Vault location${NC}"
echo "  Enter the path to your Obsidian vault folder."
echo "  Tip: you can drag the folder into this terminal window."
echo ""
read -p "  Vault path: " VAULT_PATH_INPUT

# Strip surrounding quotes and trailing slash
VAULT_PATH="${VAULT_PATH_INPUT//\'/}"
VAULT_PATH="${VAULT_PATH//\"/}"
VAULT_PATH="${VAULT_PATH%/}"

# Expand ~ if present
VAULT_PATH="${VAULT_PATH/#\~/$HOME}"

if [ ! -d "$VAULT_PATH" ]; then
  echo -e "${RED}✗ Directory not found: $VAULT_PATH${NC}"
  exit 1
fi
echo -e "${GREEN}✓ Vault: $VAULT_PATH${NC}"

# ── Step 4: Detect or create domain ─────────────────────────────────
echo ""
echo -e "${YELLOW}[4/6] Knowledge domains${NC}"

# Find directories that have wiki/_WORKFLOW.md
DOMAINS=()
while IFS= read -r -d '' d; do
  DOMAIN_DIR=$(dirname "$(dirname "$d")")
  DOMAIN_NAME=$(basename "$DOMAIN_DIR")
  DOMAINS+=("$DOMAIN_NAME")
done < <(find "$VAULT_PATH" -maxdepth 3 -name "_WORKFLOW.md" -print0 2>/dev/null)

DEFAULT_DOMAIN=""

if [ ${#DOMAINS[@]} -eq 0 ]; then
  echo "  No existing domains found. Let's create your first one."
  echo ""
  read -p "  Domain name (e.g. PMP, Cryptography): " DOMAIN_NAME_INPUT
  DEFAULT_DOMAIN="${DOMAIN_NAME_INPUT:-MyKnowledge}"

  DOMAIN_BASE="$VAULT_PATH/$DEFAULT_DOMAIN"
  mkdir -p "$DOMAIN_BASE/raw" "$DOMAIN_BASE/wiki/qa"

  cat > "$DOMAIN_BASE/raw/README.md" << EOF
# $DEFAULT_DOMAIN Raw — Source Material

Put unprocessed notes, web clips, and documents here.
Run \`compile $DEFAULT_DOMAIN\` to integrate them into wiki/.
EOF

  TODAY=$(date +%Y-%m-%d)
  cat > "$DOMAIN_BASE/wiki/_WORKFLOW.md" << EOF
# Compile & Lint Workflow — $DEFAULT_DOMAIN Domain

> This file defines Claude's behavior for \`compile $DEFAULT_DOMAIN\` and \`lint $DEFAULT_DOMAIN\`.

## Source Material
| Role | Path |
|------|------|
| Raw material | \`$DEFAULT_DOMAIN/raw/\` |

## Article Quality Standard
Each wiki article must have:
1. Frontmatter: type, date, tags, status, source
2. A summary callout: \`> [!summary]\`
3. Backlinks to related articles

## Compile Rules
- Duplicate content → merge into existing article
- New concept → create new article
- Low-value content → skip with reason

## Lint Rules
| Rule | Action |
|------|--------|
| Missing frontmatter | Flag for completion |
| seedling older than 30 days | Flag for review |
EOF

  cat > "$DOMAIN_BASE/wiki/_index.md" << EOF
---
type: kb-index
domain: $DEFAULT_DOMAIN
last_compiled: $TODAY
article_count: 0
---

# $DEFAULT_DOMAIN Knowledge Base Index
> Auto-maintained by Claude. Do not edit manually.

## Domain Summary
New domain — run \`compile $DEFAULT_DOMAIN\` to populate.

## Concept Glossary
| Concept | Definition | Primary Article |
|---------|------------|-----------------|

## Article Registry
| Article | Summary | Status | Updated |
|---------|---------|--------|---------|

## Compile History
| Date | Action | Notes |
|------|--------|-------|
| $TODAY | Domain initialized | Empty vault |
EOF

  touch "$DOMAIN_BASE/wiki/qa/.gitkeep"
  echo -e "${GREEN}✓ Created domain: $DEFAULT_DOMAIN${NC}"

else
  echo "  Found ${#DOMAINS[@]} domain(s):"
  for i in "${!DOMAINS[@]}"; do
    echo "    $((i+1)). ${DOMAINS[$i]}"
  done
  echo ""
  read -p "  Default domain to show on startup [${DOMAINS[0]}]: " DOMAIN_CHOICE
  DEFAULT_DOMAIN="${DOMAIN_CHOICE:-${DOMAINS[0]}}"
  echo -e "${GREEN}✓ Default domain: $DEFAULT_DOMAIN${NC}"
fi

# ── Step 5: Access token (optional) ─────────────────────────────────
echo ""
echo -e "${YELLOW}[5/6] Cloudflare tunnel access token (optional)${NC}"
echo "  If you'll use 'npm run dev:tunnel' for remote/mobile access,"
echo "  set a password to protect your vault. Leave blank for local-only."
echo ""
read -s -p "  Access token (leave blank to skip): " ACCESS_TOKEN
echo ""

if [ -z "$ACCESS_TOKEN" ]; then
  echo -e "${GREEN}✓ No access token (local access only)${NC}"
else
  echo -e "${GREEN}✓ Access token set${NC}"
fi

# ── Step 6: Write .env ──────────────────────────────────────────────
echo ""
echo -e "${YELLOW}[6/6] Writing configuration...${NC}"

cat > .env << EOF
# Generated by setup.sh on $(date)
VAULT_PATH=$VAULT_PATH
DEFAULT_DOMAIN=$DEFAULT_DOMAIN
NEXT_PUBLIC_DEFAULT_DOMAIN=$DEFAULT_DOMAIN
ACCESS_TOKEN=$ACCESS_TOKEN
PORT=3000
EOF

echo -e "${GREEN}✓ .env created${NC}"

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              Setup complete!              ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo "  To start:    npm run dev"
echo "  With tunnel: npm run dev:tunnel"
echo ""

# Auto-open browser on Mac
if [[ "$OSTYPE" == "darwin"* ]]; then
  read -p "Start the server now? [Y/n]: " START_NOW
  START_NOW="${START_NOW:-Y}"
  if [[ "$START_NOW" =~ ^[Yy]$ ]]; then
    echo -e "${CYAN}Starting server at http://localhost:3000 ...${NC}"
    (sleep 3 && open http://localhost:3000) &
    npm run dev
  fi
fi
