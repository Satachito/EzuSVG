#!/usr/bin/env bash
#	Switch GitHub Pages from repo-root (README) to the Web/ workflow artifact.
set -euo pipefail

REPO="${1:-Satachito/EzuSVG}"

echo "== current Pages config =="
gh api "repos/${REPO}/pages" 2>&1 || echo "(no pages yet)"

echo ""
echo "== set source to GitHub Actions (workflow) =="
gh api -X PUT "repos/${REPO}/pages" -f build_type=workflow

echo ""
echo "== run Deploy Web to GitHub Pages =="
gh workflow run "Deploy Web to GitHub Pages" --repo "$REPO"

echo ""
echo "Wait ~1–2 min, then open:"
LOGIN="${REPO%%/*}"
echo "  https://${LOGIN,,}.github.io/EzuSVG/"
echo ""
echo "If the root URL still shows README, confirm in repo Settings → Pages:"
echo "  Build and deployment → Source: GitHub Actions"
