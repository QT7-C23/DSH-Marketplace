# Development setup / 本机开发

This directory contains the DSH plugin, React interface, package builder and real-host acceptance tests. Product usage is documented in the [marketplace guides](../docs/README.md).

## 环境与开发启动

使用 Node.js 24+、npm、PATH 中可用的 pnpm、网络和 Windows Microsoft Edge。验收固定 DSH `0.1.5-rc.2`，其他系统与宿主版本尚未完成同等验证。

从仓库根目录执行：

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
node integration/build.mjs
node integration/host.mjs web --dump-config
node integration/set-plugin.mjs on
node integration/host.mjs web --port 4180 --no-open
```

打开 `artifacts/dsh-integration/runtime/url.txt` 内的私有认证地址，选择“继续”“稍后配置”，从侧栏进入“扩展市场”。设置可切换中、英、日语言；浏览无需模型配置。添加 `artifacts/dsh-integration/runtime/workspace` 并创建会话后，可使用 Prompt 和当前会话支持的 Slash。

用 `Ctrl+C` 停止宿主。源码挂载由 `node integration/set-plugin.mjs off`／`on` 控制，之后刷新页面；脚本只修改可识别的开发 profile。开发配置与数据隔离，但不是操作系统沙箱。同一 profile 不要同时挂载源码版与 TGZ 版。

## 验证与打包

| 命令（仓库根目录） | 用途 |
|---|---|
| `npm run verify` | 统一门禁：静态与目录规则、行为、类型、构建、安装、兼容、重启和真实界面验收 |
| `npm run package` | 构建独立 TGZ，输出到 `artifacts/releases/` |
| `npm run verify:package` | 验证官方安装、实际页面、卸载和保留数据 |
| `npm start`、`npm test`、`npm run test:browser` | 运行或检查历史独立原型 |
| `npm run tokens` | 修改原型设计变量后重新生成 CSS |

[Windows CI](../.github/workflows/verify.yml) 与 [pre-commit](../.githooks/pre-commit) 执行同一个 `npm run verify`。每个本地仓库通过 `git config core.hooksPath .githooks` 启用 hook。真实宿主验收创建独立目录，需要网络；翻译通过测试适配器验证，不使用付费模型凭据。最新线上结果见 [Actions](https://github.com/QT7-C23/DSH-Marketplace/actions)。

安装包以 `artifacts/releases/package-result.json` 的文件名、清单和 SHA-256 为准。安装及卸载步骤统一维护在[安装指南](../docs/PACKAGE_INSTALLATION.md)。

## 模块与本地数据

| 目录 | 职责 |
|---|---|
| `integration/plugin/` | 宿主接线、React 市场、原生资源与兼容适配 |
| `sources/`、`community/` | 发现与完整性校验；HTTP 合同、本机计数和外部统计 |
| `catalog/`、`languages/` | 审核目录与 Prompt 原文；共享三语文案 |
| `prototype/`、`server/` | 历史独立原型及仍被复用的基础模块 |
| `artifacts/` | 忽略的宿主环境、截图、数据库、加密凭据和安装包 |

源码启动器和正常联网验收使用 `artifacts/private/github-token.dpapi`；发布包使用宿主数据目录，见 [GitHub 连接](../docs/GITHUB_CONNECTION.md)。运行证据、凭据、私有认证地址与过程笔记不纳入 Git。

实现边界见[架构](../docs/ARCHITECTURE.md)，开发约束见 [AGENTS.md](../AGENTS.md)，提交要求见 [CONTRIBUTING.md](../CONTRIBUTING.md)。
