#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== git init =="
git rev-parse --is-inside-work-tree 2>/dev/null || git init -b main

echo "== stage =="
git add -A
git status

if ! git rev-parse HEAD >/dev/null 2>&1; then
	echo "== initial commit =="
	git commit -m "$(cat <<'EOF'
Initial commit: EzuSVG browser SVG editor.

EOF
)"
fi

echo "== gh auth =="
gh auth status
LOGIN=$(gh api user -q .login)
REPO="${LOGIN}/EzuSVG"
echo "Repository: $REPO"

if gh repo view "$REPO" >/dev/null 2>&1; then
	echo "== push existing repo =="
	if git remote get-url origin >/dev/null 2>&1; then
		git push -u origin main
	else
		git remote add origin "https://github.com/${REPO}.git"
		git push -u origin main
	fi
else
	echo "== create repo =="
	gh repo create "$REPO" --public \
		--description "Browser-based SVG editor" \
		--source=. --remote=origin --push
fi

echo "== enable GitHub Pages (workflow) =="
gh api -X PUT "repos/${REPO}/pages" -f build_type=workflow || true

echo "== deploy =="
gh workflow run "Deploy Web to GitHub Pages" || true

echo ""
echo "Done."
echo "  Repo:   https://github.com/${REPO}"
echo "  Pages:  https://${LOGIN,,}.github.io/EzuSVG/"
git remote -v
git log -1 --oneline
