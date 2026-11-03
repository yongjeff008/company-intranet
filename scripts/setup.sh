#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  python3 - <<'PY'
import os, secrets
password, root, admin = [secrets.token_hex(18) for _ in range(3)]
fd = os.open('.env', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as f:
    f.write(f"CMS_DB_PASSWORD={password}\nCMS_DB_ROOT_PASSWORD={root}\nCMS_BOOTSTRAP_PASSWORD={admin}\n")
    f.write(f"ConnectionStrings__Cms='Server=127.0.0.1;Port=3308;Database=intranet;User ID=intranet;Password={password};AllowUserVariables=true'\nASPNETCORE_ENVIRONMENT=Development\n")
PY
  echo '本地配置已生成。首次管理员账号为 admin，密码见 .env 中 CMS_BOOTSTRAP_PASSWORD。'
fi
if [ ! -x .tools/dotnet/dotnet ]; then
  mkdir -p .tools
  curl --fail --location --connect-timeout 15 --max-time 60 https://dot.net/v1/dotnet-install.sh -o .tools/dotnet-install.sh
  bash .tools/dotnet-install.sh --channel 10.0 --install-dir "$PWD/.tools/dotnet" --no-path
fi
docker compose up -d --wait
export DOTNET_ROOT="$PWD/.tools/dotnet"
export DOTNET_CLI_HOME="$PWD/.tools/cli"
export NUGET_PACKAGES="$PWD/.tools/nuget"
export DOTNET_CLI_TELEMETRY_OPTOUT=1
export DOTNET_GENERATE_ASPNET_CERTIFICATE=false
.tools/dotnet/dotnet restore src/Intranet.Api --locked-mode
(cd frontend && npm ci && npm run build)
.tools/dotnet/dotnet build src/Intranet.Api --no-restore
echo '初始化完成。运行 ./scripts/start.sh，然后打开 http://localhost:5088'
