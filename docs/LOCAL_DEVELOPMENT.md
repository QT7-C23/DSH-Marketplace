# 本机开发

项目是运行在 DSH 内的独立扩展市场，支持插件、Skill、MCP、Slash、Prompt 与主题。当前功能与限制见[中文 README](../README.zh-CN.md)，安装发布包见[安装指南](PACKAGE_INSTALLATION.md)。

## 环境与启动

使用 Node.js 24+、npm、pnpm。真实宿主验收固定 DSH 0.1.5-rc.2，并在 Windows 上使用 Microsoft Edge。安装依赖和真实来源验收需要网络。

从仓库根目录执行：

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
npm run verify
```

开发宿主的启动步骤见 [integration/README.md](../integration/README.md)。市场无需独立账号；资源投稿与撤下申请通过 GitHub 审核。

| 命令 | 用途 |
|---|---|
| `npm run verify` | 唯一完整门禁：静态与目录检查、行为测试、类型、构建、安装、兼容、重启和真实界面验收 |
| `npm run package` | 构建 `artifacts/releases/` 下的独立安装包 |
| `npm run verify:package` | 验证官方安装、实际界面、卸载及保留的数据 |
| `npm start`、`npm test`、`npm run test:browser` | 运行或检查保留的历史独立原型 |
| `npm run tokens` | 修改原型设计变量后重新生成 CSS |

CI 与 `.githooks/pre-commit` 执行同一个 `npm run verify`。可用 `git config core.hooksPath .githooks` 启用本地提交门禁。每次验收使用独立宿主目录；成功以实际测试结果为准。

## 代码与运行数据

- `integration/`：固定宿主、React 市场、资源管理适配、打包与真实宿主验收。
- `sources/`：自动发现、来源缓存、身份合并、撤下规则及完整性校验。
- `community/`：HTTP 合同、本机计数与外部统计；`catalog/`：审核目录与 Prompt 原文。
- `languages/`：中文、英文、日文文案；`prototype/`、`server/`：历史原型与仍被复用的基础模块。
- `artifacts/`：忽略的测试环境、截图、数据库、加密凭据与安装包。发布包通过 GitHub Releases 分发，不作为源码提交。

实际用户数据位于 `DSH_HOME/community/` 等宿主数据目录。收藏、个人评分与投稿草稿使用浏览器本地存储，清理站点数据会丢失这些内容。目录刷新不会自动覆盖已保存的版本，自动发现不会自动安装或执行资源。

公开文档保留使用说明与稳定开发规范；策划草稿、调研、排错及阶段记录仅在本地保留，不纳入 Git。测试输出含运行环境信息，不应直接公开上传。

开发约束见 [AGENTS.md](../AGENTS.md)，提交要求见 [CONTRIBUTING.md](../CONTRIBUTING.md)，资源行为见[扩展管理](EXTENSION_MANAGEMENT.md)，模块关系见[架构说明](ARCHITECTURE.md)。
