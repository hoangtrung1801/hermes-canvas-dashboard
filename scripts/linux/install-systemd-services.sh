#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-all}"
if [[ $# -gt 0 ]]; then
  shift
fi

ENABLE=0
START=0

usage() {
  cat <<'EOF'
Usage: scripts/linux/install-systemd-services.sh [dev|prod|all] [--enable] [--start]

Modes:
  dev   Install hermes-canvas-server-dev.service and hermes-canvas-app-dev.service
  prod  Install hermes-canvas-server.service and hermes-canvas-app.service
  all   Install both dev and production service units

Options:
  --enable  Enable installed services at boot
  --start   Restart installed services after installation
  --help    Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --enable)
      ENABLE=1
      ;;
    --start)
      START=1
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
  echo "systemctl is required to install Linux services." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
INSTALL_ROOT="${HERMES_CANVAS_ROOT:-${REPO_ROOT}}"
SYSTEMD_SOURCE_DIR="${REPO_ROOT}/systemd"
UNIT_DIR="/etc/systemd/system"
ENV_DIR="/etc/hermes-canvas"
ENV_FILE="${ENV_DIR}/hermes-canvas.env"

shell_quote() {
  printf "%q" "$1"
}

lookup_command() {
  local command_name="$1"
  local quoted_command
  quoted_command="$(shell_quote "${command_name}")"

  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]] && command -v sudo >/dev/null 2>&1; then
    sudo -H -u "${SUDO_USER}" bash -lc "command -v ${quoted_command}" 2>/dev/null && return 0
  fi

  command -v "${command_name}" 2>/dev/null
}

escape_sed_replacement() {
  printf "%s" "$1" | sed 's/[&|\\]/\\&/g'
}

PACKAGE_MANAGER="${HERMES_CANVAS_PACKAGE_MANAGER:-}"
if [[ -z "${PACKAGE_MANAGER}" ]]; then
  if [[ -f "${INSTALL_ROOT}/pnpm-lock.yaml" ]] && lookup_command pnpm >/dev/null; then
    PACKAGE_MANAGER="pnpm"
  else
    PACKAGE_MANAGER="npm"
  fi
fi

if ! PACKAGE_MANAGER_BIN="$(lookup_command "${PACKAGE_MANAGER}")"; then
  echo "Could not find package manager: ${PACKAGE_MANAGER}" >&2
  echo "Install it for the target user, or set HERMES_CANVAS_PACKAGE_MANAGER to npm, pnpm, or an absolute path." >&2
  exit 1
fi

if ! NODE_BIN="$(lookup_command node)"; then
  echo "Could not find node for the target user." >&2
  echo "Install Node.js, or run this installer with a PATH that includes node." >&2
  exit 1
fi

NODE_BIN_DIR="$(dirname "${NODE_BIN}")"
INSTALL_ROOT_ESCAPED="$(escape_sed_replacement "${INSTALL_ROOT}")"
PACKAGE_MANAGER_BIN_ESCAPED="$(escape_sed_replacement "${PACKAGE_MANAGER_BIN}")"
NODE_BIN_DIR_ESCAPED="$(escape_sed_replacement "${NODE_BIN_DIR}")"

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

for unit in "${UNITS[@]}"; do
  if [[ ! -f "${SYSTEMD_SOURCE_DIR}/${unit}" ]]; then
    echo "Missing service template: ${SYSTEMD_SOURCE_DIR}/${unit}" >&2
    exit 1
  fi
done

install -d -m 0755 "${ENV_DIR}"

if [[ ! -f "${ENV_FILE}" ]]; then
  sed "s|__HERMES_CANVAS_ROOT__|${INSTALL_ROOT_ESCAPED}|g" \
    "${SYSTEMD_SOURCE_DIR}/hermes-canvas.env.example" > "${ENV_FILE}"
  chmod 0644 "${ENV_FILE}"
  echo "Created ${ENV_FILE}"
else
  echo "Keeping existing ${ENV_FILE}"
fi

for unit in "${UNITS[@]}"; do
  sed \
    -e "s|__HERMES_CANVAS_ROOT__|${INSTALL_ROOT_ESCAPED}|g" \
    -e "s|__HERMES_CANVAS_PACKAGE_MANAGER__|${PACKAGE_MANAGER_BIN_ESCAPED}|g" \
    -e "s|__HERMES_CANVAS_NODE_BIN_DIR__|${NODE_BIN_DIR_ESCAPED}|g" \
    "${SYSTEMD_SOURCE_DIR}/${unit}" > "${UNIT_DIR}/${unit}"
  chmod 0644 "${UNIT_DIR}/${unit}"
  echo "Installed ${UNIT_DIR}/${unit}"
done

systemctl daemon-reload

if [[ "${ENABLE}" -eq 1 ]]; then
  systemctl enable "${UNITS[@]}"
fi

if [[ "${START}" -eq 1 ]]; then
  systemctl restart "${UNITS[@]}"
fi

echo "Installed Hermes Canvas systemd services for mode: ${MODE}"
echo "Using package manager: ${PACKAGE_MANAGER_BIN}"
echo "Using node: ${NODE_BIN}"
