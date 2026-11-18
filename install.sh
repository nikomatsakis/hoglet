#!/bin/sh
set -eu
umask 077

usage() {
  printf '%s\n' 'Usage: ./install.sh [--prefix /absolute/path] [--skip-browser]' \
    'Installs an independent Hoglet and private Node under ~/.local by default.' \
    'No system Node or npm is required. Existing credentials are reused.'
}
hoglet_prefix=${HOME:?}/.local
hoglet_browser=install
while [ "$#" -gt 0 ]; do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --prefix)
      [ "$#" -ge 2 ] && [ "${2#/}" != "$2" ] || {
        printf '%s\n' '--prefix requires an absolute directory.' >&2; exit 1;
      }
      hoglet_prefix=$2; shift 2 ;;
    --skip-browser) hoglet_browser=skip; shift ;;
    *) usage >&2; exit 1 ;;
  esac
done

hoglet_source=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
hoglet_version=24.15.0
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)
    hoglet_target=darwin-arm64
    hoglet_sha=372331b969779ab5d15b949884fc6eaf88d5afe87bde8ba881d6400b9100ffc4 ;;
  Darwin-x86_64)
    hoglet_target=darwin-x64
    hoglet_sha=ffd5ee293467927f3ee731a553eb88fd1f48cf74eebc2d74a6babe4af228673b ;;
  Linux-aarch64)
    hoglet_target=linux-arm64
    hoglet_sha=73afc234d558c24919875f51c2d1ea002a2ada4ea6f83601a383869fefa64eed ;;
  Linux-x86_64)
    hoglet_target=linux-x64
    hoglet_sha=44836872d9aec49f1e6b52a9a922872db9a2b02d235a616a5681b6a85fec8d89 ;;
  *) printf '%s\n' 'Standalone installation supports macOS/Linux on ARM64 or x64.' >&2; exit 1 ;;
esac
hoglet_temp=$(mktemp -d "${TMPDIR:-/tmp}/hoglet-install.XXXXXX")
trap 'rm -rf "$hoglet_temp"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
hoglet_archive="$hoglet_temp/node.tar.gz"
if [ -n "${HOGLET_NODE_ARCHIVE:-}" ]; then
  cp -- "$HOGLET_NODE_ARCHIVE" "$hoglet_archive"
else
  printf '%s\n' "Downloading Hoglet's private Node $hoglet_version ($hoglet_target)…" >&2
  curl --fail --location --silent --show-error --proto '=https' --tlsv1.2 \
    --connect-timeout 20 --max-time 300 \
    "https://nodejs.org/dist/v$hoglet_version/node-v$hoglet_version-$hoglet_target.tar.gz" \
    --output "$hoglet_archive"
fi
if command -v shasum >/dev/null 2>&1; then
  hoglet_actual=$(shasum -a 256 "$hoglet_archive")
else
  hoglet_actual=$(sha256sum "$hoglet_archive")
fi
[ "${hoglet_actual%% *}" = "$hoglet_sha" ] || {
  printf '%s\n' 'Node archive checksum mismatch; installation stopped.' >&2; exit 1;
}
tar -xzf "$hoglet_archive" -C "$hoglet_temp"
hoglet_runtime="$hoglet_temp/node-v$hoglet_version-$hoglet_target"
# Host-wide preload hooks must not run inside the private runtime.
unset NODE_OPTIONS NODE_PATH
"$hoglet_runtime/bin/node" "$hoglet_source/scripts/install.mjs" \
  "$hoglet_prefix" "$hoglet_runtime" "$hoglet_browser" "$hoglet_sha"
