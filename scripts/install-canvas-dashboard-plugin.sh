#!/usr/bin/env bash
set -euo pipefail

plugin_name="canvas-dashboard"
force=0
symlink=0
install_deps=0
dest_root="${HERMES_PLUGIN_DIR:-${HOME}/.hermes/plugins}"

usage() {
  cat <<'USAGE'
Install the canvas-dashboard Hermes plugin from this repository.

Usage:
  scripts/install-canvas-dashboard-plugin.sh [options]

Options:
  --dest DIR       Plugin root directory. Default: $HERMES_PLUGIN_DIR or ~/.hermes/plugins
  --force          Replace an existing canvas-dashboard plugin install.
  --symlink        Symlink to this repository instead of copying files.
  --install-deps   Install the plugin Python dependency: websocket-client.
  -h, --help       Show this help.

Examples:
  scripts/install-canvas-dashboard-plugin.sh
  scripts/install-canvas-dashboard-plugin.sh --force
  scripts/install-canvas-dashboard-plugin.sh --dest ~/.hermes/plugins --symlink
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dest)
      if [[ $# -lt 2 || -z "${2:-}" ]]; then
        echo "error: --dest requires a directory" >&2
        exit 2
      fi
      dest_root="$2"
      shift 2
      ;;
    --force)
      force=1
      shift
      ;;
    --symlink)
      symlink=1
      shift
      ;;
    --install-deps)
      install_deps=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd -- "${script_dir}/.." && pwd -P)"
source_dir="${repo_root}/plugins/${plugin_name}"

if [[ ! -f "${source_dir}/plugin.yaml" ]]; then
  echo "error: plugin source not found at ${source_dir}" >&2
  exit 1
fi

dest_root="${dest_root/#\~/${HOME}}"
target_dir="${dest_root}/${plugin_name}"

if [[ -e "$target_dir" || -L "$target_dir" ]]; then
  if [[ "$force" -ne 1 ]]; then
    echo "error: ${target_dir} already exists. Re-run with --force to replace it." >&2
    exit 1
  fi
  rm -rf "$target_dir"
fi

mkdir -p "$dest_root"

if [[ "$symlink" -eq 1 ]]; then
  ln -s "$source_dir" "$target_dir"
  action="Linked"
else
  cp -R "$source_dir" "$target_dir"
  action="Installed"
fi

if [[ "$install_deps" -eq 1 ]]; then
  python3 -m pip install websocket-client
fi

cat <<EOF
${action} ${plugin_name} plugin to:
  ${target_dir}

Restart Hermes so it can discover the plugin.
EOF
