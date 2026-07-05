#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}"
if [[ $# -gt 0 ]]; then
  shift
fi

PURGE_ENV=0

usage() {
  cat <<'EOF'
Usage: scripts/linux/uninstall-systemd-services.sh [dev|prod|all] [--purge-env]

Modes:
  dev   Remove hermes-canvas-server-dev.service and hermes-canvas-app-dev.service
  prod  Remove hermes-canvas-server.service and hermes-canvas-app.service
  all   Remove both dev and production service units

Options:
  --purge-env  Also remove /etc/hermes-canvas/hermes-canvas.env
  --help       Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --purge-env)
      PURGE_ENV=1
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ "${MODE}" == "--help" || "${MODE}" == "-h" ]]; then
  usage
  exit 0
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl is required to uninstall Linux services." >&2
  exit 1
fi

UNIT_DIR="/etc/systemd/system"
ENV_FILE="/etc/hermes-canvas/hermes-canvas.env"
ENV_DIR="/etc/hermes-canvas"

case "${MODE}" in
  dev)
    UNITS=(hermes-canvas-server-dev.service hermes-canvas-app-dev.service)
    ;;
  prod)
    UNITS=(hermes-canvas-server.service hermes-canvas-app.service)
    ;;
  all)
    UNITS=(
      hermes-canvas-server.service
      hermes-canvas-app.service
      hermes-canvas-server-dev.service
      hermes-canvas-app-dev.service
    )
    ;;
  *)
    echo "Invalid mode: ${MODE}" >&2
    usage >&2
    exit 1
    ;;
esac

existing_units=()
for unit in "${UNITS[@]}"; do
  if [[ -f "${UNIT_DIR}/${unit}" ]]; then
    existing_units+=("${unit}")
  fi
done

if [[ "${#existing_units[@]}" -gt 0 ]]; then
  systemctl stop "${existing_units[@]}" || true
  systemctl disable "${existing_units[@]}" || true
else
  echo "No installed Hermes Canvas service units found for mode: ${MODE}"
fi

for unit in "${UNITS[@]}"; do
  rm -f "${UNIT_DIR}/${unit}"
  echo "Removed ${UNIT_DIR}/${unit}"
done

systemctl daemon-reload
systemctl reset-failed "${UNITS[@]}" || true

if [[ "${PURGE_ENV}" -eq 1 ]]; then
  rm -f "${ENV_FILE}"
  rmdir "${ENV_DIR}" 2>/dev/null || true
  echo "Removed ${ENV_FILE}"
else
  echo "Keeping ${ENV_FILE}"
fi

echo "Uninstalled Hermes Canvas systemd services for mode: ${MODE}"
