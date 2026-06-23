#!/usr/bin/env bash
# Create a filing from fixtures/local-mihir-filing.json (real PAN — GST will send OTP).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="${API_URL:-http://localhost:3001}"
EMAIL="${SMOKE_EMAIL:-admin@registerkaro.local}"
PASSWORD="${SMOKE_PASSWORD:-admin123}"
FIXTURE="${REAL_FILING_FIXTURE:-$ROOT/fixtures/local-mihir-filing.json}"
CLIENT_REF="${CLIENT_REF:-MIHIR-$(date +%s)}"
AUTO_START="${AUTO_START:-false}"

if [ ! -f "$FIXTURE" ]; then
  echo "ERROR: Fixture not found: $FIXTURE"
  exit 1
fi

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"healthcheck","password":"healthcheck"}' || echo "000")
if [ "$HTTP_CODE" = "000" ]; then
  echo "ERROR: API not reachable at $API_URL — run: pnpm start"
  exit 1
fi

TOKEN=$(curl -sf "$API_URL/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

auth() { echo "Authorization: Bearer $TOKEN"; }

PAN=$(python3 -c "import json; d=json.load(open('$FIXTURE')); print(d['partA']['pan'])")
LEGAL=$(python3 -c "import json; d=json.load(open('$FIXTURE')); print(d['partA']['legalName'])")
MOBILE=$(python3 -c "import json; d=json.load(open('$FIXTURE')); print(d['partA']['pasMobile'])")
PAS_EMAIL=$(python3 -c "import json; d=json.load(open('$FIXTURE')); print(d['partA']['pasEmail'])")

echo "==> Creating real filing $CLIENT_REF"
echo "    PAN: $PAN"
echo "    Legal name: $LEGAL"
echo "    Contact: $PAS_EMAIL / $MOBILE"
echo "    Verify legal name matches your PAN card exactly before starting automation."

APP_ID=$(curl -sf "$API_URL/api/applications" \
  -H "$(auth)" -H 'Content-Type: application/json' \
  -d "{\"clientRef\":\"$CLIENT_REF\",\"constitution\":\"proprietorship\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

FORM_JSON=$(python3 <<PY
import json
from pathlib import Path
from datetime import date

data = json.loads(Path("$FIXTURE").read_text())
data.pop("_comment", None)
auth = data.get("authorizedSignatory")
if isinstance(auth, dict) and auth.get("sameAsPromoter") and len(auth) == 1:
    data.pop("authorizedSignatory", None)
today = date.today().isoformat()
data["business"]["commencementDate"] = today
data["business"]["liabilityDate"] = today
print(json.dumps(data))
PY
)

curl -sf "$API_URL/api/applications/$APP_ID/form" \
  -H "$(auth)" -H 'Content-Type: application/json' \
  -X PATCH -d "{\"formData\":$FORM_JSON}" > /dev/null

echo ""
echo "Created application: $APP_ID"
echo "Open: http://localhost:3000/applications/$APP_ID"
echo ""
echo "Before starting automation:"
echo "  1. Confirm legal name on Step 1 matches PAN exactly"
echo "  2. Update father's name and DOB on Step 3 if needed"
echo "  3. Upload documents on Review step"
echo "  4. Keep Chrome automation window open (HEADLESS=false)"

if [ "$AUTO_START" = "true" ]; then
  curl -sf "$API_URL/api/applications/$APP_ID/step" \
    -H "$(auth)" -H 'Content-Type: application/json' \
    -X PATCH -d '{"step":"REVIEW_SUBMIT"}' > /dev/null
  curl -sf "$API_URL/api/applications/$APP_ID/start" \
    -H "$(auth)" -H 'Content-Type: application/json' \
    -d '{"fromStep":"part_a"}' > /dev/null
  echo "Automation started (Part A)."
fi
