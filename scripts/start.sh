#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ] || [ ! -x .tools/dotnet/dotnet ]; then
  echo '请先运行 ./scripts/setup.sh' >&2
  exit 1
fi
set -a
source .env
set +a
export DOTNET_ROOT="$PWD/.tools/dotnet"
export CMS_DATA_PATH="$PWD/.data"
export ASPNETCORE_URLS="${ASPNETCORE_URLS:-http://127.0.0.1:5088}"
cd src/Intranet.Api
exec "$DOTNET_ROOT/dotnet" bin/Debug/net10.0/Intranet.Api.dll
