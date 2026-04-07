#!/bin/bash
# nova-router entry point
# Usage: ./router.sh "user message"
#        echo '{"message":"..."}' | ./router.sh

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -t 0 ] && [ -z "$1" ]; then
  echo '{"error": "No input provided"}' && exit 1
fi

if [ -n "$1" ]; then
  echo "$*" | python3 "$SCRIPT_DIR/router.py"
else
  python3 "$SCRIPT_DIR/router.py"
fi
