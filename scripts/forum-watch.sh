#!/usr/bin/env bash
# forum-watch.sh — poll ZCG Discourse topic for new posts (grant desk gateway)
#
# Usage:
#   ./scripts/forum-watch.sh                 # one-shot status
#   ./scripts/forum-watch.sh --watch 120     # poll every 120s; print NEW blocks
#   ./scripts/forum-watch.sh --json          # machine-readable one shot
#
# Env:
#   ZCG_TOPIC_ID   default 54211
#   ZCG_STATE_DIR  default .cache/forum-watch

set -euo pipefail

TOPIC_ID="${ZCG_TOPIC_ID:-54211}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
STATE_DIR="${ZCG_STATE_DIR:-$ROOT/.cache/forum-watch}"
TOPIC_URL="https://forum.zcashcommunity.com/t/${TOPIC_ID}.json"
TOPIC_HTML="https://forum.zcashcommunity.com/t/grant-application-zk-cosmwasm-a-programmable-selective-disclosure-webassembly-smart-contract-virtual-machine/${TOPIC_ID}"
UA="permissionless.money-forum-watch/1.0 (+grant-desk)"

WATCH=false
INTERVAL=120
JSON_ONLY=false

args=("$@")
i=0
while [[ $i -lt ${#args[@]} ]]; do
  arg="${args[$i]}"
  case "$arg" in
    --watch)
      WATCH=true
      next="${args[$((i+1))]:-}"
      if [[ "$next" =~ ^[0-9]+$ ]]; then
        INTERVAL="$next"
        i=$((i+1))
      fi
      ;;
    --json) JSON_ONLY=true ;;
    -h|--help)
      sed -n '2,14p' "$0"
      exit 0
      ;;
  esac
  i=$((i+1))
done

mkdir -p "$STATE_DIR"
STATE_FILE="${STATE_DIR}/topic-${TOPIC_ID}.json"
TMP_JSON="$(mktemp)"
trap 'rm -f "$TMP_JSON"' EXIT

fetch_topic() {
  curl -sS -A "$UA" -H "Accept: application/json" --max-time 30 -o "$TMP_JSON" "$TOPIC_URL"
  # basic sanity
  if ! python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$TMP_JSON" 2>/dev/null; then
    echo "ERROR: failed to fetch/parse $TOPIC_URL" >&2
    head -c 200 "$TMP_JSON" >&2 || true
    return 1
  fi
}

# Writes summary JSON to stdout. Exit 2 if new activity vs previous watermark.
process() {
  python3 - "$TMP_JSON" "$STATE_FILE" <<'PY'
import json, sys, re, html
from pathlib import Path

topic_path = Path(sys.argv[1])
state_path = Path(sys.argv[2])
d = json.loads(topic_path.read_text())
prev = {}
if state_path.exists():
    try:
        prev = json.loads(state_path.read_text())
    except Exception:
        prev = {}

posts = d.get("post_stream", {}).get("posts") or []
highest = d.get("highest_post_number") or (posts[-1]["post_number"] if posts else 0)
last_at = d.get("last_posted_at") or ""
title = d.get("title") or ""
slug = d.get("slug") or ""
tid = d.get("id")
posts_count = d.get("posts_count")
prev_high = int(prev.get("highest_post_number") or 0)
# "new" only when we had a prior watermark and it advanced
is_new = bool(prev_high) and highest > prev_high

def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()

out = {
    "topic_id": tid,
    "title": title,
    "slug": slug,
    "posts_count": posts_count,
    "highest_post_number": highest,
    "last_posted_at": last_at,
    "prev_highest": prev_high,
    "is_new": is_new,
    "url": f"https://forum.zcashcommunity.com/t/{slug}/{tid}" if slug else f"https://forum.zcashcommunity.com/t/{tid}",
    "recent": [
        {
            "post_number": p.get("post_number"),
            "username": p.get("username"),
            "created_at": p.get("created_at"),
            "excerpt": strip_html(p.get("cooked") or "")[:240],
        }
        for p in (posts[-3:] if posts else [])
    ],
}
print(json.dumps(out, indent=2))
state_path.write_text(json.dumps({
    "highest_post_number": highest,
    "last_posted_at": last_at,
    "posts_count": posts_count,
    "title": title,
}, indent=2))
sys.exit(2 if is_new else 0)
PY
}

human_print_file() {
  # $1 = path to summary json (heredoc cannot share stdin with a pipe)
  python3 - "$1" <<'PY'
import json, sys
o = json.loads(open(sys.argv[1]).read())
flag = "NEW" if o.get("is_new") else "ok"
print("[%s] #%s posts=%s last=%s" % (
    flag, o.get("highest_post_number"), o.get("posts_count"), o.get("last_posted_at")))
print(o.get("title") or "")
print(o.get("url") or "")
for p in o.get("recent") or []:
    print("  · #%s @%s %s" % (p.get("post_number"), p.get("username"), p.get("created_at")))
    print("    %s" % ((p.get("excerpt") or "")[:160]))
PY
}

once() {
  fetch_topic
  local sumfile
  sumfile="$(mktemp)"
  set +e
  process >"$sumfile"
  rc=$?
  set -e
  if $JSON_ONLY; then
    cat "$sumfile"
  else
    human_print_file "$sumfile"
  fi
  rm -f "$sumfile"
  return 0
}

if $WATCH; then
  echo "Watching topic ${TOPIC_ID} every ${INTERVAL}s → state ${STATE_FILE}"
  echo "Thread: ${TOPIC_HTML}"
  while true; do
    if ! fetch_topic; then
      echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) fetch error; retry in ${INTERVAL}s"
      sleep "$INTERVAL"
      continue
    fi
    sumfile="$(mktemp)"
    set +e
    process >"$sumfile"
    rc=$?
    set -e
    if [[ $rc -eq 2 ]]; then
      echo "===== NEW FORUM ACTIVITY ====="
      human_print_file "$sumfile"
      echo "=============================="
    else
      highest="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("highest_post_number"))' "$sumfile")"
      echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) heartbeat highest=#${highest}"
    fi
    rm -f "$sumfile"
    sleep "$INTERVAL"
  done
else
  once
fi
