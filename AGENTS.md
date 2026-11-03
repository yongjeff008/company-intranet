# company-intranet 工作约定

- 开始项目工作前阅读 README.md、docs/技术选型与工程约定.md 及与任务相关的需求文档。
- 2026-11-02 已确认：后端 .NET / ASP.NET Core，数据库 MySQL，前端 React + TypeScript；不使用 Vue，当前未采用 Bootstrap。
- 用户已于 2026-11-02 明确指示“开干”，项目已进入实现阶段。此前等待编码的约束已解除。
- 当前工程采用 .NET 10、Dapper/MySqlConnector、React/TypeScript/Vite、Tiptap；具体锁定版本见 csproj、global.json 和 frontend/package-lock.json。没有引入 Vue、Bootstrap 或 Ant Design。
- 修改发布或权限逻辑时，运行 tests/integration.py；修改页面操作时补充相应 Playwright 验证。测试使用独立数据库，不向正式开发库写入示例业务内容。
- 数据库是本项目独立的 MySQL 容器；不得操作小智等其他项目的数据库。密钥、本地配置、上传文件和工具缓存不进 Git。
- 已实现范围与待完成项见 docs/开发进度.md；不要把需求评审稿中的所有候选模块误报为已完成。
