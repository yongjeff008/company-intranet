# 企业内网

以企业内网为首个应用场景的可配置内容管理系统（CMS）。IT 配置站点、部门、模板和模块，业务部门管理员维护内容，普通用户浏览已发布内容。

需求文档见 [需求规格说明书](docs/需求规格说明书.md)。2026-11-02 用户已明确授权开工，当前为首版实现阶段。

已确认：后端 **.NET / ASP.NET Core**，数据库 **MySQL**，前端 **React + TypeScript**。具体依赖与版本见 [技术选型与工程约定](docs/技术选型与工程约定.md)。

开箱即用模块见 [模块目录与规格](docs/开箱即用模块目录与规格.md)，包含六类核心模块、32 项模块目录、配置与维护规则，以及 CMS 官方资料参考。

## 本地启动

需要 Docker、Node.js（当前使用 26）、npm、Python 3。项目使用隔离的 .NET 10 SDK；安装在 `.tools/dotnet`，不改变其他项目的 .NET 环境。

```bash
./scripts/setup.sh
./scripts/start.sh
```

打开 http://localhost:5088 。初始账号 `admin`，首次密码由初始化脚本随机生成，见本地 `.env` 的 `CMS_BOOTSTRAP_PASSWORD`；不会写入 Git。该变量只在空数据库首次创建管理员时使用，后续改密码不靠修改该变量。

初始站点没有部门和业务内容。登录后进入 IT 配置中心，依次创建部门、配置页面模块、创建部门管理员，再从内容工作台维护与发布内容。

主题配置支持四季、四种节日、自选颜色和黑白共十套方案，在「IT 配置中心 → 站点设置」预览、选择并发布，详见 [主题与配色](docs/主题与配色.md)。

当前开发环境已按用户要求配置常见内网首页、四个部门空间及分角色账号，业务内容仍为空。详见 [基础内网配置](docs/基础内网配置.md)。普通用户访问说明保存在本机 `.data/普通用户访问.txt`。

独立 MySQL 8.4 容器端口为 `127.0.0.1:3308`，内存上限 512MB；不会使用现有小智数据库。`docker compose stop` 停止本项目数据库，数据保留在专用卷中。不要使用 `down -v`，除非明确要删除本项目数据库。

## 开发与验证

```bash
# 前端热更新（另一个终端保持 .NET 服务运行）
cd frontend
npm run dev
# 打开 http://127.0.0.1:5174，/api 自动转发至 5088
```

前端构建使用 `npm run build`，输出到 API 的 `wwwroot`；后端使用 `.tools/dotnet/dotnet build src/Intranet.Api`。构建所需的私有缓存环境变量见 `scripts/setup.sh`。安装依赖使用 `npm ci` 和 `dotnet restore --locked-mode`。

```bash
# 在一次性独立数据库中验证真实 HTTP 接口
python3 tests/integration.py

# 首次在当前机器安装 Playwright Chromium 后，增加浏览器验证
cd frontend && npx playwright install chromium && cd ..
python3 tests/integration.py --browser
```

如果复用已有的 Chromium，可设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`。测试结束会删除测试数据库及其素材，截图和最近测试日志保留在 `.data/` 中。不要把验证服务的 5099 端口当成常规预览地址。

## 工程结构

- `src/Intranet.Api/`：.NET API、权限、内容快照、模板、问卷与文件。
- `frontend/src/`：React 门户、内容工作台、IT 配置界面。
- `tests/integration.py`：真实 MySQL + HTTP 集成验证。
- `frontend/tests/`：桌面、业务发布与手机交互验证。
- `docs/开发进度.md`：当前能力、验证结果和待完成项。

当前为本机开发预览。企业身份集成、正式部署、备份恢复演练及容量验收仍需完成，详见开发进度。
