#!/usr/bin/env bash
# Deploy MockRiskOracle + BoundWallet + MockERC20 to local Anvil and write ui/.env.local
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

RPC="${RPC:-http://127.0.0.1:8545}"
OWNER_PK="${OWNER_PK:-0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80}"

if ! command -v forge >/dev/null 2>&1; then
  echo "forge not found. Install Foundry: https://book.getfoundry.sh/getting-started/installation" >&2
  exit 1
fi

if ! cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "Anvil is not reachable at $RPC. Start it with: anvil" >&2
  exit 1
fi

OUT="$(forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC" --broadcast --private-key "$OWNER_PK" -vv)"
echo "$OUT"

ORACLE="$(printf '%s\n' "$OUT" | awk '/ORACLE/{print $NF}' | tail -n1)"
WALLET="$(printf '%s\n' "$OUT" | awk '/WALLET/{print $NF}' | tail -n1)"
TOKEN="$(printf '%s\n' "$OUT" | awk '/TOKEN/{print $NF}' | tail -n1)"

if [[ -z "$ORACLE" || -z "$WALLET" || -z "$TOKEN" ]]; then
  echo "Failed to parse deployed addresses from forge script output." >&2
  exit 1
fi

mkdir -p "$ROOT/ui"
cat > "$ROOT/ui/.env.local" <<EOF
VITE_RPC_URL=/rpc
VITE_WALLET_ADDRESS=$WALLET
VITE_ORACLE_ADDRESS=$ORACLE
VITE_TOKEN_ADDRESS=$TOKEN
EOF

echo
echo "Wrote ui/.env.local"
echo "  WALLET $WALLET"
echo "  ORACLE $ORACLE"
echo "  TOKEN  $TOKEN"
echo
echo "Restart the UI dev server if it is already running so Vite picks up env."
