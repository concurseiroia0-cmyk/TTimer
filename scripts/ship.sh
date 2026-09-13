#!/usr/bin/env bash
# Ship TTimer: commit pending changes (if any), push to main, GitHub Actions
# builds and publishes to GitHub Pages automatically.
set -euo pipefail

cd "$(dirname "$0")/.."

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$BRANCH" != "main" ]; then
  echo "⚠️  Você está em '$BRANCH'. O deploy automático acontece a partir de 'main'."
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "📦 Alterações pendentes encontradas — fazendo commit..."
  git add -A
  git commit -m "Update app $(date '+%Y-%m-%d %H:%M')"
fi

echo "🚀 Enviando para o GitHub..."
git push origin main

echo ""
echo "✅ Enviado! O GitHub Actions está construindo e publicando agora:"
echo "   https://github.com/\$(git config --get remote.origin.url | sed 's/.*github.com[:\\/]//;s/.git$')/actions"
echo ""
echo "   App no ar em ~1-2 min:"
REPO="$(git config --get remote.origin.url | sed 's/.*github.com[:\/]//;s/.git$/')"
USER="${REPO%%/*}"
echo "   https://$USER.github.io/TTimer/"
