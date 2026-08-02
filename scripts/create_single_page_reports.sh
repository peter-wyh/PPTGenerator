#!/bin/bash
set -e
cd "$(dirname "$0")/.."

# 1. Login → get token
TOKEN=$(curl -s http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@mediakit.local","password":"admin123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['accessToken'])")

echo "Token: ${TOKEN:0:20}..."

# 2. Create FT H1 settlement single-page project
echo "=== Creating FT H1 复盘看板 ==="
FT_RESULT=$(curl -s http://localhost:4000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d @scripts/_create_ft_settlement.json)
echo "$FT_RESULT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f\"FT project id: {d.get('id','ERROR')}\")" 2>&1

# 3. Create DG Campaign single-page project
echo "=== Creating DG Campaign Report ==="
DG_RESULT=$(curl -s http://localhost:4000/api/v1/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d @scripts/_create_dg_campaign.json)
echo "$DG_RESULT" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f\"DG project id: {d.get('id','ERROR')}\")" 2>&1
