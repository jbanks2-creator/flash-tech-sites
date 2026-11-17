#!/usr/bin/env bash
# Assert that dist/ is a coherent per-version drop.
#
#   bash scripts/check-dist.sh
#
# dist/ is what gets zipped and sold, so every html in it (including anything under
# dist/archive/) must travel with documentation and a checksum that belong to *that*
# build:
#
#   * each TaskApp-<version>.html has a sibling README.txt that names <version> and no
#     other version, and points at TaskApp-<version>.html.sha256;
#   * each has a sibling .sha256 that verifies with sha256sum -c;
#   * the html's own APP_VERSION equals the version in its filename (so a file cannot be
#     renamed into the wrong README);
#   * a README cannot promise a feature the build beside it does not have (the checks
#     below cover the two paragraphs rc.3 added: reproducible exports, two-tab notice);
#   * nothing is orphaned: no README.txt or .sha256 without its html, and an archive
#     directory is named after the version it holds (and holds it: an archive directory
#     with no TaskApp-<version>.html in it fails, so the summary's archive count cannot
#     count an empty directory);
#   * every html is found, at any depth — the scan is `find dist -name '*.html'`, so an
#     html nested somewhere unexpected fails instead of being skipped, and the summary
#     counts archive directories from find rather than a glob that can vanish.
#
# Exits 0 only if every check on every file passed. No network, no git, no build needed.
set -euo pipefail
cd "$(dirname "$0")/.."

fail() { printf 'check-dist: FAIL — %s\n' "$*" >&2; exit 1; }
ok()   { printf '  ok   %s\n' "$*"; }

[[ -d dist ]] || fail "dist/ does not exist — run: bash scripts/build.sh"

shopt -s nullglob
# Enumerate with find, not a glob: a glob that matches nothing disappears under
# nullglob, which is how a later `ls -d dist/archive/*/` came to list `.` and report
# one archive when there were none. find always reports what is on disk.
mapfile -t htmls < <(find dist -type f -name '*.html' | sort)
[[ ${#htmls[@]} -gt 0 ]] || fail "dist/ holds no TaskApp html"

checked=0
for html in "${htmls[@]}"; do
  dir="$(dirname "$html")"
  base="$(basename "$html")"
  [[ "$base" =~ ^TaskApp-(.+)\.html$ ]] || fail "$html is not named TaskApp-<version>.html"
  version="${BASH_REMATCH[1]}"

  # 0a. an html may sit only at the top of dist/ or directly inside dist/archive/<version>/
  #    (find sees every html at any depth; this fails the ones the old
  #    dist/*.html + dist/archive/*/*.html globs silently missed)
  rel="${html#dist/}"
  if [[ "$rel" == */* && ! "$rel" =~ ^archive/[^/]+/[^/]+$ ]]; then
    fail "$html sits somewhere unexpected — an html belongs at dist/<name>.html or dist/archive/<version>/<name>.html"
  fi

  # 0b. an archive directory is named after the version it holds
  if [[ "$dir" == dist/archive/* ]]; then
    [[ "$(basename "$dir")" == "$version" ]] \
      || fail "$html sits in archive/$(basename "$dir")/ — the directory must be named ${version}"
  fi

  # 1. the file's own version agrees with its name
  appver="$(grep -oE 'const APP_VERSION = "[^"]+"' "$html" | head -1 | sed -E 's/.*"([^"]+)"/\1/')"
  [[ -n "$appver" ]] || fail "$base has no APP_VERSION"
  [[ "$appver" == "$version" ]] || fail "$base says APP_VERSION ${appver} but its filename says ${version}"

  # 2. a README beside it, naming this version and its checksum file
  readme="$dir/README.txt"
  [[ -f "$readme" ]] || fail "$dir has no README.txt beside $base"
  grep -qF "TaskApp ${version}" "$readme" || fail "$readme never says \"TaskApp ${version}\""
  grep -qF "this copy is ${version}" "$readme" || fail "$readme does not tell the buyer the copy is ${version}"
  grep -qF "TaskApp-${version}.html.sha256" "$readme" || fail "$readme does not point at TaskApp-${version}.html.sha256"

  # 3. the README mentions no other version — the failure this script exists for.
  #    A version token often trails a filename ("TaskApp-1.0.0-rc.3.html.sha256") or a
  #    sentence ("…this copy is 1.0.0-rc.3."), so strip trailing punctuation and file
  #    extensions until the token stops changing.
  tokens="$(grep -oE '(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z][0-9A-Za-z.-]*)?' "$readme" \
            | sed -E -e ':loop' -e 's/[.,:;)]+$//' -e 's/[]]+$//' \
                     -e 's/\.(html|sha256|zip|txt|json|md)$//' -e 't loop' | sort -u)"
  for tok in $tokens; do
    [[ "$tok" == "$version" ]] \
      || fail "$readme sits beside ${version} but also names ${tok}"
  done

  # 4. a checksum beside it, and it verifies
  sums="$html.sha256"
  [[ -f "$sums" ]] || fail "$base has no .sha256"
  ( cd "$dir" && sha256sum -c "$base.sha256" >/dev/null 2>&1 ) || fail "$base.sha256 does not verify"
  sum="$(cut -d' ' -f1 "$sums")"

  # 5. no README promises a feature this build lacks
  if grep -qE 'Two tabs on the same browser|changed underneath|another tab' "$readme"; then
    grep -qF 'another tab' "$html" || fail "$readme describes the two-tab notice, but $base has no such code"
  fi
  if grep -qE 'The export is reproducible|reproducible: tag ids' "$readme"; then
    grep -qF 'stableTagId' "$html" || fail "$readme promises reproducible exports, but $base derives tag ids randomly"
  fi

  ok "${base} ($(wc -c < "$html") B, sha256 ${sum:0:8}…) + README.txt ${version}"
  checked=$((checked + 1))
done

# 6. nothing orphaned
for stray in dist/README.txt dist/*.html.sha256 dist/archive/*/README.txt dist/archive/*/*.html.sha256; do
  [[ -e "$stray" ]] || continue
  dir="$(dirname "$stray")"
  sib=("$dir"/*.html)
  [[ ${#sib[@]} -eq 1 ]] || fail "$stray is not beside exactly one html"
done

# 7. an archive directory that exists must actually hold the version it is named after —
#    otherwise "archived = N" counts a directory with nothing in it.
if [[ -d dist/archive ]]; then
  while IFS= read -r adir; do
    av="$(basename "$adir")"
    [[ -f "$adir/TaskApp-${av}.html" ]] \
      || fail "$adir holds no TaskApp-${av}.html — an archive directory must contain the build it is named after"
  done < <(find dist/archive -mindepth 1 -maxdepth 1 -type d | sort)
fi

# 8. say what would be zipped and sold
if [[ -f dist/README.txt ]]; then
  release_version="$(grep -oE '^TaskApp [^ ]+' dist/README.txt | head -1 | awk '{print $2}')"
  [[ -n "$release_version" ]] || fail "dist/README.txt does not start with a version"
  [[ -f "dist/TaskApp-${release_version}.html" && -f "dist/TaskApp-${release_version}.html.sha256" ]] \
    || fail "dist/README.txt is for ${release_version} but those files are not at the top of dist/"
  archives=0
  if [[ -d dist/archive ]]; then
    archives="$(find dist/archive -mindepth 1 -maxdepth 1 -type d | wc -l | tr -d ' ')"
  fi
  printf '\ncheck-dist: %s coherent version drop(s); release = %s; archived = %s\n' \
    "$checked" "$release_version" "$archives"
else
  fail "dist/ has no top-level README.txt — the current release has no documentation"
fi
