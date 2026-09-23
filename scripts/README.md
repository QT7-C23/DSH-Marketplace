# Development setup / 本机开发

产品介绍见根目录三语 README；安装和资源使用见[安装包说明](release/README.zh-CN.md)。本目录维护开发、验证和打包工具。

## 环境与开发启动

使用 Node.js 24+、npm、PATH 中可用的 pnpm、网络和 Windows Microsoft Edge。验收固定 DSH `0.1.5-rc.2`；其他环境尚未完成同等验证。从仓库根目录执行：

```powershell
npm ci --ignore-scripts
node scripts/host/build.mjs
node scripts/host/host.mjs web --dump-config
node scripts/host/set-plugin.mjs on
node scripts/host/host.mjs web --port 4180 --no-open
```

打开 `artifacts/dsh-integration/runtime/url.txt` 内的私有认证地址，选择“继续”“稍后配置”，从侧栏进入“扩展市场”。添加 `artifacts/dsh-integration/runtime/workspace` 并创建会话后，可使用 Prompt 与当前会话支持的 Slash。

用 `Ctrl+C` 停止宿主。源码挂载由 `node scripts/host/set-plugin.mjs off`／`on` 控制，之后刷新页面。开发配置与数据隔离，但不是操作系统沙箱。同一 profile 不要同时挂载源码版与 TGZ 版。

## 验证与打包

| 命令 | 用途 |
|---|---|
| `npm run verify` | 统一门禁：目录、公开链接、静态规则、行为、类型、构建和真实宿主验收 |
| `npm run package` | 构建 `artifacts/releases/` 下的独立 TGZ |
| `npm run verify:package` | 验证官方安装、页面、卸载及保留数据 |
| `npm start`、`npm test`、`npm run test:browser` | 历史独立原型与聚焦测试 |
| `npm run tokens` | 修改原型设计变量后重新生成 CSS |

[Windows CI](../.github/workflows/verify.yml) 与 [pre-commit](../.github/hooks/pre-commit) 共用 `npm run verify`。用 `git config core.hooksPath .github/hooks` 启用本地 hook。真实验收使用独立宿主和网络；翻译使用测试适配器，不消耗付费模型。最终结果以对应提交的 [Actions](https://github.com/QT7-C23/DSH-Marketplace/actions) 为准。

## 模块与本地数据

| 目录 | 职责 |
|---|---|
| `src/plugin/` | 宿主接线、React 市场、插件兼容与原生资源管理 |
| `src/community/`、`src/sources/` | HTTP 合同、本机计数、外部统计、发现与完整性校验 |
| `src/languages/` | 共享三语文案 |
| `src/prototype/`、`src/server/` | 历史独立原型和产品仍在使用的基础函数 |
| `catalog/` | 审核资源、Prompt 原文、撤下策略和起始目录 |
| `tests/` | 按模块分组的测试、测试样例和辅助工具 |
| `scripts/` | 构建、开发宿主、验收和安装包说明模板 |
| `assets/`、`licenses/` | 公开图片、第三方许可原件 |

前端依赖控制器与 HTTP 合同；资源管理通过宿主端口和共享安装器操作，不能绕过归属检查修改其他模块状态。缓存与操作记录在宿主 `DSH_HOME/community/`，实验资料在忽略的 `artifacts/`。策划和调研文档仅保留本地。

## 插件接入

`dsh.bundle.patch` 提供 profile 组合配置；`dsh.client` 声明 Web 前端，通常配合 `exports["./client"]`。后端插件可以没有前端，CLI 安装成功不代表加载或调用成功。

`dsh-plugin.json` 是可选 dsh-std 组件的声明，由适配器发现和挂载。市场拒绝会造成双重自动发现的入口；标准组件变更遵守完整重启边界。实际使用和卸载准备见[安装包说明](release/README.zh-CN.md)。

## GitHub 连接

在“设置 → GitHub 连接”保存并验证可选读取令牌。只需公开资源读取权限，不需要仓库写入或管理权限。失败的替换保留旧凭据；移除仅删除本机副本，需要时另行在 GitHub 撤销。

Windows 当前账户 DPAPI 加密保存凭据。开发与验收使用 `artifacts/private/github-token.dpapi`，安装包默认使用 `DSH_HOME/community/private/github-token.dpapi`。环境变量 `DSH_MARKET_GITHUB_TOKEN_FILE` 只接受密文文件绝对路径。仅 `api.github.com` 的 GET 请求携带令牌，npm、原文服务器及 MCP Registry 不接收它。首次初始化可能等待约一分钟。

README 翻译由用户选择 DSH 模型并明确启动，最多 24,000 字符、90 秒，不自动拆分或重试。失败或取消也可能产生费用；原文始终保留。

[贡献指南](../CONTRIBUTING.md) · [仓库规范](../AGENTS.md) · [资源来源](../src/sources/README.md) · [第三方声明](../THIRD_PARTY_NOTICES.md)
