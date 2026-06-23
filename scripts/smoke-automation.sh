#!/usr/bin/env bash
# Smoke test: create sample filing, start automation, wait until captcha or failure.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://localhost:3001}"
EMAIL="${SMOKE_EMAIL:-admin@registerkaro.local}"
PASSWORD="${SMOKE_PASSWORD:-admin123}"
TIMEOUT_SEC="${SMOKE_TIMEOUT_SEC:-120}"

cd "$ROOT"

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"healthcheck","password":"healthcheck"}' || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  echo "ERROR: API not reachable at $API_URL — run: pnpm start"
  exit 1
fi

echo "==> Logging in..."
TOKEN=$(curl -sf "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

auth() { echo "Authorization: Bearer $TOKEN"; }

FILING_EMAIL=$(grep '^FILING_EMAIL=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- || echo 'mihir190801@gmail.com')
FILING_MOBILE=$(grep '^FILING_MOBILE=' "$ROOT/.env" 2>/dev/null | cut -d= -f2- || echo '8700993995')
CLIENT_REF="SMOKE-$(date +%s)"

echo "==> Creating application $CLIENT_REF..."
echo "    Contact: $FILING_EMAIL / $FILING_MOBILE"
echo "    NOTE: Smoke test uses sample PAN ABCDE1234F — GST will NOT send real OTP."
echo "    For a real OTP test, create a filing with your actual PAN and legal name."
APP_ID=$(curl -sf "$API_URL/api/applications" \
  -H "$(auth)" -H 'Content-Type: application/json' \
  -d "{\"clientRef\":\"$CLIENT_REF\",\"constitution\":\"proprietorship\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "==> Loading sample form data..."
FORM_JSON=$(python3 <<PY
import json
from pathlib import Path
from datetime import date

data = json.loads(Path("$ROOT/fixtures/sample-proprietorship-filing.json").read_text())
data.pop("_comment", None)
data.pop("clientRef", None)
data.pop("constitution", None)
auth = data.get("authorizedSignatory")
if isinstance(auth, dict) and auth.get("sameAsPromoter") and len(auth) == 1:
    data.pop("authorizedSignatory", None)
data["partA"]["pasEmail"] = "$FILING_EMAIL"
data["partA"]["pasMobile"] = "$FILING_MOBILE"
data["promoter"]["email"] = "$FILING_EMAIL"
data["promoter"]["mobile"] = "$FILING_MOBILE"
data["principalPlaceOfBusiness"]["email"] = "$FILING_EMAIL"
data["principalPlaceOfBusiness"]["mobile"] = "$FILING_MOBILE"
today = date.today().isoformat()
data["business"]["commencementDate"] = today
data["business"]["liabilityDate"] = today
print(json.dumps(data))
PY
)

curl -sf "$API_URL/api/applications/$APP_ID/form" \
  -H "$(auth)" -H 'Content-Type: application/json' \
  -X PATCH -d "{\"formData\":$FORM_JSON}" > /dev/null

curl -sf "$API_URL/api/applications/$APP_ID/step" \
  -H "$(auth)" -H 'Content-Type: application/json' \
  -X PATCH -d '{"step":"REVIEW_SUBMIT"}' > /dev/null

echo "==> Starting Part A automation..."
curl -sf "$API_URL/api/applications/$APP_ID/start" \
  -H "$(auth)" -H 'Content-Type: application/json' \
  -d '{"fromStep":"part_a"}' > /dev/null

echo "==> Polling status (timeout ${TIMEOUT_SEC}s)..."
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
    AWAITING_CAPTCHA|AWAITING_OTP|AWAITING_EVC_OTP|AWAITING_AADHAAR)
      HAS_CAPTCHA=$(echo "$RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); p=d.get('pendingInputData') or {}; print('yes' if p.get('captchaImageBase64') else 'no')")
      echo ""
      echo "PASS: Automation reached human input step ($STATUS)"
      echo "Application: $APP_ID"
      echo "Contact: $FILING_EMAIL / $FILING_MOBILE"
      echo "Captcha image in API: $HAS_CAPTCHA"
      echo "Open: http://localhost:3000/applications/$APP_ID"
      exit 0
      ;;
    TRN_RECEIVED|ARN_RECEIVED)
      echo ""
      echo "PASS: Automation completed to $STATUS"
      echo "Application: $APP_ID"
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

echo "FAIL: Timed out waiting for automation progress"
exit 1
