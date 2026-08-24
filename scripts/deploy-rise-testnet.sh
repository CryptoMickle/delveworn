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

CURRENT_COORDINATOR="$(cast call "$CURRENT_DUNGEON" 'coordinator()(address)' --rpc-url "$RPC_URL")"
CURRENT_COORDINATOR="$(cast to-check-sum-address "$CURRENT_COORDINATOR")"

# A chain-agnostic Delveworn deployment may already point at a
# LegacyVRFAdapter. If so, reuse the actual provider-facing coordinator
# rather than stacking a second compatibility adapter on top of the first.
UPSTREAM_COORDINATOR="$(cast call "$CURRENT_COORDINATOR" 'upstreamCoordinator()(address)' --rpc-url "$RPC_URL" 2>/dev/null || true)"

if [[ -n "$UPSTREAM_COORDINATOR" ]]; then
  RISE_VRF_COORDINATOR="$(cast to-check-sum-address "$UPSTREAM_COORDINATOR")"
  echo "Existing coordinator is an adapter: $CURRENT_COORDINATOR"
  echo "Underlying RISE VRF coordinator: $RISE_VRF_COORDINATOR"
else
  RISE_VRF_COORDINATOR="$CURRENT_COORDINATOR"
  echo "RISE VRF coordinator: $RISE_VRF_COORDINATOR"
fi

export RISE_VRF_COORDINATOR

echo "Deploying fresh LegacyVRFAdapter + Delveworn V2 ..."

forge script script/DeployRiseTestnet.s.sol:DeployRiseTestnet \
  --rpc-url "$RPC_URL" \
  --broadcast \
  "$@"

cat <<'EOF'

Deployment broadcast completed.
Use the Delveworn address printed above as NEXT_PUBLIC_DUNGEON_ADDRESS in the frontend/Vercel deployment, then redeploy the frontend.
EOF
