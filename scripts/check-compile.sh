#!/usr/bin/env bash
# Compile-checks every .js/.jsx file in client/src and server (syntax + JSX), without installing anything extra.
# Uses esbuild from the project's own node_modules once `npm run setup` has run, or from $ESBUILD if you set it.
set -u
cd "$(dirname "$0")/.."

ESB="${ESBUILD:-}"
for candidate in client/node_modules/.bin/esbuild node_modules/.bin/esbuild /opt/npm-tools/node_modules/.bin/esbuild; do
  [ -z "$ESB" ] && [ -x "$candidate" ] && ESB="$candidate"
done
if [ -z "$ESB" ]; then echo "esbuild not found. Run 'npm run setup' first, or set ESBUILD=/path/to/esbuild." >&2; exit 2; fi

fail=0; count=0
while IFS= read -r f; do
  count=$((count + 1))
  case "$f" in *.jsx) loader=jsx ;; *) loader=js ;; esac
  if ! out=$("$ESB" "$f" "--loader:.js=$loader" --log-level=error --outfile=/dev/null 2>&1); then
    echo "FAIL $f"; echo "$out" | head -8; fail=1
  fi
done < <(find server client/src scripts -type f \( -name '*.js' -o -name '*.jsx' -o -name '*.mjs' \) -not -path '*/node_modules/*')

if [ "$fail" -eq 0 ]; then echo "✓ $count files compile."; else echo "✗ compile errors above." >&2; fi
exit "$fail"
