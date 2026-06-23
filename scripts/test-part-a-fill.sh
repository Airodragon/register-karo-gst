#!/usr/bin/env bash
# Live Part A fill test: create real filing, start automation, wait until captcha or failure.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://localhost:3001}"
EMAIL="${SMOKE_EMAIL:-admin@registerkaro.local}"
PASSWORD="${SMOKE_PASSWORD:-admin123}"
TIMEOUT_SEC="${PART_A_TEST_TIMEOUT_SEC:-180}"
DOC_DIR="$ROOT/fixtures/documents"

cd "$ROOT"

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"healthcheck","password":"healthcheck"}' || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  echo "ERROR: API not reachable at $API_URL — run: pnpm start"
  exit 1
fi

mkdir -p "$DOC_DIR"
if [ ! -f "$DOC_DIR/sample-photo.jpg" ]; then
  printf '\xFF\xD8\xFF\xE0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xFF\xD9' > "$DOC_DIR/sample-photo.jpg"
fi
if [ ! -f "$DOC_DIR/sample-address-proof.pdf" ]; then
  printf '%%PDF-1.0\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF' > "$DOC_DIR/sample-address-proof.pdf"
fi
if [ ! -f "$DOC_DIR/sample-pan.pdf" ]; then
  cp "$DOC_DIR/sample-address-proof.pdf" "$DOC_DIR/sample-pan.pdf"
fi

APP_OUTPUT=$(bash "$ROOT/scripts/create-real-filing.sh" 2>&1)
echo "$APP_OUTPUT"

APP_ID=$(echo "$APP_OUTPUT" | sed -n 's/^Created application: //p' | head -1)
if [ -z "$APP_ID" ]; then
  echo "ERROR: Could not create application"
  exit 1
fi

TOKEN=$(curl -sf "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

auth() { echo "Authorization: Bearer $TOKEN"; }

echo "==> Uploading required documents..."
for pair in "promoterPhoto:$DOC_DIR/sample-photo.jpg" "panCard:$DOC_DIR/sample-pan.pdf" "addressProof:$DOC_DIR/sample-address-proof.pdf"; do
  TYPE="${pair%%:*}"
  FILE="${pair#*:}"
  curl -sf "$API_URL/api/applications/$APP_ID/documents/$TYPE" \
    -H "$(auth)" -F "file=@$FILE" > /dev/null
done

echo "==> Starting Part A automation..."
curl -sf "$API_URL/api/applications/$APP_ID/step" \
  -H "$(auth)" -H 'Content-Type: application/json' \
  -X PATCH -d '{"step":"REVIEW_SUBMIT"}' > /dev/null
curl -sf "$API_URL/api/applications/$APP_ID/start" \
  -H "$(auth)" -H 'Content-Type: application/json' \
  -d '{"fromStep":"part_a"}' > /dev/null

echo "==> Polling Part A automation (timeout ${TIMEOUT_SEC}s)..."
DEADLINE=$(( $(date +%s) + TIMEOUT_SEC ))
LAST_STATUS=""

while [ "$(date +%s)" -lt "$DEADLINE" ]; do
  RESP=$(curl -sf "$API_URL/api/applications/$APP_ID" -H "$(auth)")
  STATUS=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])")
  PROGRESS=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); p=d.get('automationProgress') or {}; print(p.get('label',''))")
  ERROR=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('errorLog') or '')")

  if [ "$STATUS" != "$LAST_STATUS" ] || [ -n "$PROGRESS" ]; then
    echo "   status=$STATUS progress=${PROGRESS:-n/a}"
    LAST_STATUS="$STATUS"
  fi

  case "$STATUS" in
    AWAITING_CAPTCHA)
      echo ""
      echo "PASS: Part A fields filled; awaiting captcha"
      echo "Application: $APP_ID"
      echo "Open: http://localhost:3000/applications/$APP_ID"
      exit 0
      ;;
    FAILED)
      echo ""
      echo "FAIL: $ERROR"
      exit 1
      ;;
  esac

  sleep 3
done

echo "FAIL: Timed out waiting for AWAITING_CAPTCHA"
exit 1
