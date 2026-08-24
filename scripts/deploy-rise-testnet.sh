#!/usr/bin/env bash
set -euo pipefail

RPC_URL="${RISE_RPC_URL:-https://testnet.riselabs.xyz}"
CURRENT_DUNGEON="${RISE_EXISTING_DUNGEON_ADDRESS:-}"

if [[ -z "$CURRENT_DUNGEON" && -f ../frontend/.env.local ]]; then
  CURRENT_DUNGEON="$(sed -n 's/^NEXT_PUBLIC_DUNGEON_ADDRESS=//p' ../frontend/.env.local | tail -n 1 | tr -d "'\"[:space:]")"
fi

if [[ -z "$CURRENT_DUNGEON" ]]; then
  cat >&2 <<'EOF'
Could not determine the existing RISE dungeon address.
Set RISE_EXISTING_DUNGEON_ADDRESS or keep NEXT_PUBLIC_DUNGEON_ADDRESS in ../frontend/.env.local.
EOF
  exit 1
fi

CURRENT_DUNGEON="$(cast to-check-sum-address "$CURRENT_DUNGEON")"

echo "Existing RISE dungeon: $CURRENT_DUNGEON"
echo "Reading its coordinator from $RPC_URL ..."

RISE_VRF_COORDINATOR="$(cast call "$CURRENT_DUNGEON" 'coordinator()(address)' --rpc-url "$RPC_URL")"
RISE_VRF_COORDINATOR="$(cast to-check-sum-address "$RISE_VRF_COORDINATOR")"
export RISE_VRF_COORDINATOR

echo "RISE VRF coordinator: $RISE_VRF_COORDINATOR"
echo "Deploying fresh LegacyVRFAdapter + Delveworn V2 ..."

forge script script/DeployRiseTestnet.s.sol:DeployRiseTestnet \
  --rpc-url "$RPC_URL" \
  --broadcast \
  "$@"

cat <<'EOF'

Deployment broadcast completed.
Use the Delveworn address printed above as NEXT_PUBLIC_DUNGEON_ADDRESS in the frontend/Vercel deployment, then redeploy the frontend.
EOF
