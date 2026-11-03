#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo '前台运行的服务请使用 Ctrl+C 停止；launchd 预览服务使用 launchctl bootout gui/$(id -u)/ai.jeff.company-intranet。'
echo '停止本项目数据库（保留数据卷）：'
docker compose stop
