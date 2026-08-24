#!/usr/bin/env bash
set -euo pipefail

# DEV/TEST ONLY.
# Watches a local DevRandomnessAdapter and fulfills every pending request.
# This preserves Delveworn's production-like two-transaction randomness flow
# while removing any dependency on an external VRF provider during development.

RPC_URL="${DEV_RPC_URL:-http://127.0.0.1:8545}"
ADAPTER="${DEV_RANDOMNESS_ADAPTER:?Set DEV_RANDOMNESS_ADAPTER to the deployed DevRandomnessAdapter address}"
POLL_SECONDS="${DEV_POLL_INTERVAL_SECONDS:-0.25}"

SEND_ARGS=(--rpc-url "$RPC_URL")

if [[ -n "${DEV_PRIVATE_KEY:-}" ]]; then
  SEND_ARGS+=(--private-key "$DEV_PRIVATE_KEY")
elif [[ -n "${DEV_OWNER_ADDRESS:-}" ]]; then
  SEND_ARGS+=(--unlocked --from "$DEV_OWNER_ADDRESS")
else
  cat >&2 <<'EOF'
Set one of:
  DEV_PRIVATE_KEY     private key for the DevRandomnessAdapter owner (local dev only), or
  DEV_OWNER_ADDRESS   unlocked Anvil account that owns the adapter.
EOF
  exit 1
fi

echo "Delveworn dev randomness auto-fulfiller"
echo "RPC:     $RPC_URL"
echo "Adapter: $ADAPTER"
echo "Poll:    ${POLL_SECONDS}s"
echo

while true; do
  next_request_id="$({ cast call "$ADAPTER" "nextRequestId()(uint256)" --rpc-url "$RPC_URL"; } 2>/dev/null | awk '{print $1}')"

  if [[ "$next_request_id" =~ ^[0-9]+$ ]] && (( next_request_id > 1 )); then
    for ((request_id = 1; request_id < next_request_id; request_id++)); do
      pending="$({ cast call "$ADAPTER" "pendingRequests(uint256)(bool)" "$request_id" --rpc-url "$RPC_URL"; } 2>/dev/null | tr -d '\r\n')"

      if [[ "$pending" == "true" ]]; then
        echo "[$(date '+%H:%M:%S')] fulfilling request $request_id"

        cast send \
          "$ADAPTER" \
          "fulfill(uint256)" \
          "$request_id" \
          "${SEND_ARGS[@]}" \
          >/dev/null
      fi
    done
  fi

  sleep "$POLL_SECONDS"
done
