#!/bin/sh
# install.sh — curl-installable installer for @mainlayer/cli
# Usage: curl -fsSL https://raw.githubusercontent.com/mainlayer/mainlayer-cli/main/scripts/install.sh | sh

# ---------------------------------------------------------------------------
# Color helpers (gated on terminal detection — POSIX sh compatible)
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  BOLD='\033[1m'
  RESET='\033[0m'
else
  GREEN=''
  YELLOW=''
  BOLD=''
  RESET=''
fi

# ---------------------------------------------------------------------------
# Verify npm is available
# ---------------------------------------------------------------------------
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm not found." >&2
  echo "Please install Node.js (>=22) from https://nodejs.org and try again." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Install the package globally
# ---------------------------------------------------------------------------
echo "${BOLD}Installing @mainlayer/cli...${RESET}"
npm install -g @mainlayer/cli

if [ $? -ne 0 ]; then
  echo "Error: npm install failed." >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Detect npm global bin directory
# ---------------------------------------------------------------------------
NPM_BIN="$(npm prefix -g)/bin"

# ---------------------------------------------------------------------------
# Check if NPM_BIN is already in PATH
# ---------------------------------------------------------------------------
case ":$PATH:" in
  *":$NPM_BIN:"*)
    # already in PATH — nothing to do
    ;;
  *)
    # Detect target shell rc file
    case "$SHELL" in
      */zsh)
        RC_FILE="$HOME/.zshrc"
        SOURCE_CMD="source ~/.zshrc"
        ;;
      *)
        RC_FILE="$HOME/.bashrc"
        SOURCE_CMD="source ~/.bashrc"
        ;;
    esac

    # Append PATH export to rc file
    printf '\n# mainlayer-cli\nexport PATH="$PATH:%s"\n' "$NPM_BIN" >> "$RC_FILE"

    echo ""
    echo "${YELLOW}Note:${RESET} $NPM_BIN was added to your PATH in $RC_FILE"
    echo "Run the following to apply immediately, or open a new terminal:"
    echo ""
    echo "  $SOURCE_CMD"
    echo ""
    ;;
esac

# ---------------------------------------------------------------------------
# Success message
# ---------------------------------------------------------------------------
echo ""
echo "${GREEN}${BOLD}@mainlayer/cli installed successfully!${RESET}"
echo ""
echo "Get started:"
echo "  mainlayer wallet create"
echo "  mainlayer auth register --email you@example.com --password ..."
echo ""
echo "Docs: https://github.com/mainlayer/mainlayer-cli"
echo ""
