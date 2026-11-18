#!/bin/sh
set -eu
# Resolve both the user's command symlink and the release selector.
hoglet_path=$0
while [ -L "$hoglet_path" ]; do
  hoglet_dir=$(CDPATH= cd -P -- "$(dirname -- "$hoglet_path")" && pwd)
  hoglet_link=$(readlink "$hoglet_path")
  case "$hoglet_link" in
    /*) hoglet_path=$hoglet_link ;;
    *) hoglet_path=$hoglet_dir/$hoglet_link ;;
  esac
done
hoglet_root=$(CDPATH= cd -P -- "$(dirname -- "$hoglet_path")/.." && pwd)
unset NODE_OPTIONS NODE_PATH
PATH="$hoglet_root/runtime/bin:$PATH"
export PATH
exec "$hoglet_root/runtime/bin/node" "$hoglet_root/app/dist/src/cli.js" "$@"
