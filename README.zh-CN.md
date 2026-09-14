# DSH Marketplace

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

在 DeepSeek Harness 内发现插件、Skill、MCP、Slash、Prompt 和主题的社区开源市场。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Status: In development](https://img.shields.io/badge/status-in%20development-orange.svg)](#项目状态)

集中发现资源、阅读作者文档、保存选定版本。产品目标仍是让安装、使用和管理在 DSH 内形成完整流程。

![DSH Marketplace](docs/images/marketplace.png)

*真实开发界面截图。插件界面支持中文、英文和日文，资源内容保留原文。*

## 项目状态

**当前为本机开发版本，独立维护，不是 DeepSeek 官方产品。**

| 范围 | 当前可用 | 仍待实现 |
|---|---|---|
| 浏览 | 六类筛选、用途分类、搜索、概况和作者 README/SKILL.md | 更多来源覆盖 |
| 扩展管理 | npm 固定版本预览、版本/协议检查、官方安装/更新/卸载、原生与标准状态 | 单组件启停、自动恢复和更多组合实测 |
| 来源 | Anthropic Skill 全目录发现，6 小时自动检查、暂停/恢复、扫描报告与失败保留 | 其他来源自动发现、自定义来源 |
| 下载 | 完整 Skill ZIP、校验插件 TGZ、MCP 定义、Prompt 文本 | Skill 加载、MCP 连接和通用 Slash 执行 |
| Prompt 使用 | 预览并追加真实 DSH 草稿，保留原文本、引用和附件 | 更多宿主版本验证 |
| 投稿 | 六类资源填写作者与许可，导出 GitHub 投稿文件；无需市场账号 | 社区投稿审核后的自动同步 |
| 我的资源 | 本机收藏、草稿、个人评分；本机下载计数和仓库 Star | 公共社区统计 |

目录现含 **30 条真实资源：4 个插件、12 个 Skill、3 个 MCP、3 条 Slash、8 份 Prompt**，另保留两条标明的示例。Anthropic 扫描发现 19 个 Skill，按当前许可与文件限制收录 12 个；其他适配器仍更新指定条目。

当前四个插件条目是 DSH 官方功能模块，部分已包含在宿主或预设中，不能当作四个独立安装的社区 bundle。商城自身已有独立开发 TGZ，通过官方 CLI 安装、实际宿主运行与卸载验收，尚未发布到 npm 或 GitHub Release，见 [安装包说明](docs/PACKAGE_INSTALLATION.md)。

主题分类与投稿流程已加入，但暂无审核后的主题条目，自动发现和应用尚未接通。DSH 原生扩展与可选的 dsh-std 组件分别说明要求；首轮统一管理已读取两种运行状态并接入固定适配器检查。详见 [资源兼容与主题支持](docs/COMPATIBILITY_AND_THEMES.md) 和 [安装与恢复指南](docs/EXTENSION_MANAGEMENT.md)。

## 快速开始

需要独立安装包时，先安装开发依赖，再运行 `npm run package`，产物位于 `artifacts/releases/`；按 [安装包说明](docs/PACKAGE_INSTALLATION.md) 使用官方 CLI 安装。`npm run verify:package` 验证实际安装、页面、卸载和数据保留。以下保留源码开发启动方式。

需要 **Node.js 24+**、npm、安装时 PATH 可用的 pnpm、网络和 Windows Microsoft Edge。实测宿主为 **DSH 0.1.5-rc.2**；其他宿主版本与系统未验证。

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
node integration/build.mjs
node integration/host.mjs web --dump-config
node integration/set-plugin.mjs on
node integration/host.mjs web --port 4180 --no-open
```

打开 `artifacts/dsh-integration/runtime/url.txt` 中的本机认证地址，不要公开该文件。初始提示选择“继续”“稍后配置”，从侧栏打开“扩展市场”。插件“设置”中可切换中、英、日文；浏览无需模型密钥。按 `Ctrl+C` 停止宿主。

使用 Prompt 时，添加 `artifacts/dsh-integration/runtime/workspace` 工作区并创建会话，再选择资源、预览和追加，发送由你决定。详细说明见 [宿主指南](integration/README.md)。启动器隔离配置与数据，不等于操作系统安全沙箱。

## 数据与资源行为

- 市场已取消注册和登录。DSH 自身的访问认证仍然有效。
- 收藏、带作者信息的草稿、个人评分和界面语言保存在当前浏览器与站点；清理站点数据会删除它们，改变端口会切换存储范围。旧账户数据保留在原数据库中，不公开，也不迁成公共内容。
- 下载量是本机服务成功准备文件的次数，重试去重。**GitHub Star 属于整个来源仓库。** 收藏和评分仅供个人使用，不冒充社区人数或均分。
- 作者文档保留原文、来源和提交信息，区分缺失与网络失败；若展示仓库当前文档，会说明其可能与资源版本不同。
- README 优先展示界面对应语言，缺少时回退英文。点击“翻译文档”可选择 DSH 已配置的服务商、模型与目标语言，再点击“开始翻译（消耗 Token）”。译文单独标注，原文可切换；显示服务商报告的用量，失败或取消也可能计费。单次上限为 24000 字符，不自动拆分或重试。
- 查询访问受支持的 GitHub、npm 和 MCP Registry 地址；下载不会自动安装、启用或执行资源。
- 不要提交或公开 `artifacts/`、数据库、凭据和本机认证地址。

## 开发与后续

统一运行 `npm run verify`，检查静态规则、目录、行为、类型、构建和真实 DSH 浏览器流程。翻译验收通过宿主模型服务调用隔离的测试适配器，不使用付费凭据；真实来源测试需要联网和可用 GitHub 额度。可在“设置 → GitHub 连接”保存令牌：Windows 本机加密，仅用于 GitHub API 读取。详见 [连接与存储说明](docs/GITHUB_CONNECTION.md) 和 [界面与宿主状态验收](docs/research/2026-09-14-market-information-and-official-installation.md)。尚未配置 GitHub Actions，本机通过不代表线上 CI 已接通。

下一步收敛联网失败、准备公开发行、验证更多社区组件及宿主版本，接通各类资源实际使用、恢复和更多来源。模型、本地模型下载和 Cookbook 继续暂缓。

| 目录 | 职责 |
|---|---|
| `integration/` | DSH 宿主、React 界面、启动器和浏览器验收 |
| `community/` | 公开目录 API、SQLite 下载计数及合同 |
| `sources/` / `catalog/` | 发现、下载、作者文档、用途分类和 Prompt 投稿 |
| `languages/` | 前后端共用中、英、日文案与错误消息 |
| `prototype/` / `server/` | 保留的历史独立交互原型 |
| `tests/` / `scripts/` / `docs/` | 验证和项目文档 |

[架构](docs/ARCHITECTURE.md) · [来源](sources/README.md) · [产品方案](docs/PRODUCT_PLAN.md)

## 参与贡献

遵循 [贡献指南](CONTRIBUTING.md)、[Repository Guidelines](AGENTS.md) 和 Issue/PR 模板。相关能力变更同步三份 README 与语言文件，说明行为、验证和限制；UI 变更附截图。

六类资源都通过表单填写署名并导出 JSON 建议。Prompt 按 [投稿格式](catalog/README.md) 通过 PR 添加到 `catalog/prompts/`；其他资源将文件附到 [资源提交 Issue](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=03-resource-submission.yml)，提供原作者、来源、许可、使用要求和实测。文件导出不会自动上传或发布，审核后的内容暂未实时同步。

## 许可、署名与免责声明

项目原创代码与文档采用 **[MIT 协议](LICENSE)**。Copyright © 2026 QT7-C23 and contributors。再分发适用内容时，请保留版权和许可声明。

第三方内容及依赖保留原许可证和声明，根目录 MIT 不会重新授权这些内容。DeepSeek Harness、Anthropic Skills、Prompt 作者及主要依赖见 **[第三方版权清单](THIRD_PARTY_NOTICES.md)**。名称、标识和商标属于各自权利人；本项目不表示获得官方隶属、赞助、背书或商标授权。

**软件按“现状”提供，不附带任何保证。** 资源收录、完整性校验和测试通过不保证安全性、准确性、兼容性、持续可用性或特定用途适用性。使用前请核查第三方内容、权限和 AI 输出。保证排除与责任限制以适用许可证及法律为准，本文不增加对 MIT 授权的限制。完整说明见 **[英／中／日免责声明](DISCLAIMER.md)**。

**资源移除申请。** 如果您是资源作者、维护者或权利人，且不希望资源在本市场中展示，请填写 [资源移除申请表](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml)，附上资源名称、链接及您与该资源的关系说明；我们会在核实后移除相关条目。
