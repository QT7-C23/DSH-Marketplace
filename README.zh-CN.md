# DSH Marketplace

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

在 **DeepSeek Harness 内发现、使用和管理插件、Skill、MCP、Slash、Prompt 与主题**。DSH Marketplace 是独立维护的社区项目，界面支持中文、英文和日文，无需市场账号。

![DSH Marketplace](docs/images/marketplace.png)

*开发界面截图；资源文档保留作者原文。*

## 项目状态

**`v0.2.0-alpha.1`：早期预发布版本。** 实测基线为 Windows / Node.js 24 / DSH 0.1.5-rc.2。本地验收覆盖官方安装包、真实宿主界面与资源流程；标准组件管理另经五次独立启动验证，包括准备后卸载市场。安装包见 [Releases](https://github.com/QT7-C23/DSH-Marketplace/releases)，线上验证状态以 [Actions](https://github.com/QT7-C23/DSH-Marketplace/actions) 为准。未发布到 npm。

当前实测基线为 **Windows、Node.js 24、DSH 0.1.5-rc.2**。各资源的实测结果单独记录，其他宿主版本不推定兼容。

## 可以完成什么

| 类型 | 使用流程与边界 |
|---|---|
| 插件 | 检查 npm 精确版本、声明与兼容性，再通过 DSH 官方 CLI 安装、更新或卸载。原生入口通过 profile 配置启停；受保护包和反向依赖限制操作。 |
| Skill | 检查并安装固定 Git 提交的原始文件，通过 DSH 原生 Skill 服务加载和调用。支持启用、停用、更新、保留文件的移除与恢复；外部修改或非本市场管理的文件会阻止替换。 |
| MCP | 查看完整固定版本服务定义，选择受支持的连接并填写声明参数。支持 HTTPS Streamable HTTP、固定 npm 版本的 stdio 连接配置、启停和移除。“工具已注册”不等于服务持续健康。 |
| Slash | 执行当前会话所属插件提供的命令；真实 `/plan` 和 `/plan off` 调用已验证保留输入草稿与引用。命令各自的作用和使用条件仍然有效。 |
| Prompt | 预览原始正文并追加到当前 DSH 草稿，保留已有文本、引用和附件；追加不会发送会话。 |
| 主题 | 发现 npm 主题插件，通过包管理流程应用或移除。三个真实主题得到不同实测结果，尚无通用主题文件导入器。 |

标准组件依赖可选的 **dsh-std 适配器**，由一个市场管理的发现 Loader 统一加载。首次接管可能重载全部标准组件，执行前会明确提示。公开 SDK 无法证明旧批次清理成功，因此同一进程保持 **unknown／restart-required**，即使替换适配器显示 active 也会阻止后续标准启停，必须完整停止并重新启动 DSH。后续正常启动的稳定会话中，启停仅保存下次启动的目标状态；重启后还需刷新浏览器。没有模块缓存热替换或自动恢复。详见 [扩展管理](docs/EXTENSION_MANAGEMENT.md)。

主题实测：**Galactic Opera 0.2.1** 可以应用，但有 **1.04:1** 的文字对比度警告；**Machine 0.1.3** 启动受阻；**Bloom 0.12.0** 默认 Mist 可用，通过键盘打开菜单后可切换 Cinnabar，但鼠标打开菜单失败，且存在重复本机 404 轮询。这些是有限范围的结果，不代表全面兼容。[兼容与主题详情](docs/COMPATIBILITY_AND_THEMES.md)

## 发现与更新

六个来源合并、去重后形成统一目录：

| 来源 | 2026-09-14 的观测 |
|---|---|
| DSH 官方模块与命令 | 固定宿主基线的 4 个模块、3 条命令 |
| Anthropic Skills | 扫描 19 个目录，收录 12 个 |
| OpenAI Skills | 扫描 39 个目录，收录 30 个 |
| npm 社区扩展 | 扫描 4,887 个候选，收录 4,844 个，其中 5 个主题 |
| MCP 官方注册目录 | 扫描 31,784 个唯一服务，收录 30,116 个 |
| 本项目审核后的 GitHub 索引 | 支持六类资源；仅审核并合并到 `main` 的条目具备同步资格 |

一次完整运行时扫描观测到 **35,017 条合并资源**。这些数字是当日收录规则下的快照，不承诺固定目录规模或全部可用；来源间有重叠，发现也不等于安装和使用验证。四个官方模块可能已经包含在宿主或预设中，不能算作四个独立社区 bundle。

当前源码起始快照包含 **4,907 条来源记录**，尚未跨来源去重。发行快照策略将 MCP 限制为**最多 100 条**，不是当前快照已含 100 条的声明；最终内容以包报告为准。运行时 MCP 会分页读取完整受支持目录。

自动发现每 **6 小时**检查一次，失败后 **30 分钟**重试。设置支持按来源暂停、恢复、手动同步和查看扫描／排除报告；官方 DSH 来源保持固定版本。分页读取失败或不完整时，拒绝该来源的整次扫描，保留上次完整缓存；宿主停用时取消在途读取。社区审核变更合并后，经成功同步进入客户端；首次公开远端同步待发布后验收。

## 快速开始

源码开发需要 Node.js 24+、npm、安装时 PATH 中可用的 pnpm、网络，以及 Windows Microsoft Edge：

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
node integration/build.mjs
node integration/host.mjs web --dump-config
node integration/set-plugin.mjs on
node integration/host.mjs web --port 4180 --no-open
```

打开 `artifacts/dsh-integration/runtime/url.txt` 中的私有认证地址，依次选择“继续”“稍后配置”，从侧栏进入“扩展市场”，在“设置”切换语言。浏览无需模型密钥，按 `Ctrl+C` 停止宿主。

使用 Prompt 或 Slash 时，添加 `artifacts/dsh-integration/runtime/workspace` 并创建会话。启动器隔离开发配置与数据，不等于操作系统沙箱。[宿主设置](integration/README.md)

安装依赖后，可构建独立 TGZ：

```powershell
npm run package
```

候选文件名计划为 `artifacts/releases/dsh-market-integration-0.2.0-alpha.1.tgz`；以 `package-result.json` 中的实际路径与校验值为准。通过官方 CLI 安装，命令见 [安装包指南](docs/PACKAGE_INSTALLATION.md)。后续公开产物请查看 [GitHub Releases](https://github.com/QT7-C23/DSH-Marketplace/releases)。

## 数据与统计口径

| 指标 | 实际含义 |
|---|---|
| GitHub Star | 整个来源仓库的 Star，附数据新鲜度 |
| npm 下载量 | 整个包在 npm 返回的 `last-month` 日期范围内的下载量，附起止日期及最新／过期／不可用状态；不是市场安装量或单版本用户数 |
| 本机下载量 | 本机 SQLite 服务成功准备文件的次数，相同请求编号去重；不代表文件已保存或安装完成 |
| 收藏与评分 | 当前浏览器／站点的个人数据，不是全网总数或社区均分 |

收藏、署名草稿、评分与界面语言保存在浏览器；清理站点数据会删除它们，改变端口会切换存储范围。服务端缓存与操作证据位于 `DSH_HOME/community/`。界面展示最近 20 条经过筛选的 profile 操作元数据；恢复仍需检查本机日志、备份和配置。旧账户及私有表保留但不公开。

作者文档保留来源信息，README 优先当前界面语言，其次英文。**翻译需主动选择已配置的 DSH 模型并明确开始，会消耗模型 Token，取消或失败也可能计费。** 原文始终可用，单次最多 24,000 字符，不自动拆分或重试。

可选的 [GitHub 读取令牌](docs/GITHUB_CONNECTION.md) 用于改善 API 额度，由 Windows 在本机加密保存。投稿使用 GitHub 自身身份；浏览和本机收藏无需市场登录。

## 贡献与作者退出

按 [贡献指南](CONTRIBUTING.md) 和 [六类目录指南](catalog/README.md) 投稿。界面通用导出文件**仅为提案**；维护者在 `catalog/resource-entries.json` 补齐审核后的类型绑定，Prompt 仍放在 `catalog/prompts/`。运行 `node catalog/build.mjs` 和 `npm run verify` 后审核合并，不手动修改生成索引。Issue 可先缺少可执行字段以供讨论，但缺少必要绑定的内容不能进入公开目录。

作者、维护者或权利人无需提出侵权指控，即可填写 [移除申请](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml)，资源详情也提供入口。审核后的 `sources/removals.json` 规则按别名和稳定身份跨来源执行；最后成功的策略在失败与重启后仍保留。已有私人副本和安装不会被远程删除，设置页可查看已知处理记录。

## 开发

`npm run verify` 是静态规则、目录、行为、类型、构建和宿主验收的统一入口；`npm run verify:package` 检查官方 TGZ 安装与卸载。[Windows CI](.github/workflows/verify.yml) 和 [pre-commit hook](.githooks/pre-commit) 调用同一门禁，启用 hook 的命令为 `git config core.hooksPath .githooks`。hook 需在各本地仓库单独启用；线上验证状态以最新工作流运行为准。

[架构](docs/ARCHITECTURE.md) · [仓库规范](AGENTS.md) · [来源](sources/README.md) · [资源管理](docs/EXTENSION_MANAGEMENT.md)

产品运行在 DSH 内。其他宿主版本、更广泛第三方组合和自动恢复不在当前验证覆盖内；本地模型下载与 Cookbook 继续暂缓。

## 许可、署名与免责声明

项目原创代码与文档采用 **[MIT 协议](LICENSE)**，copyright © 2026 QT7-C23 and contributors；再分发时保留版权与许可声明。第三方资源和依赖保留各自许可，根目录 MIT 不会重新授权这些内容，见 [第三方版权清单](THIRD_PARTY_NOTICES.md)。

名称、标识和商标属于各自权利人。本项目独立维护，不表示与 DeepSeek 或资源作者存在官方隶属、赞助、背书或商标授权。软件**按“现状”提供，不附带保证**；收录和测试不保证安全、准确、兼容或持续可用。保证与责任以适用许可为准，见 [英／中／日免责声明](DISCLAIMER.md)。

## 标准组件兼容与卸载准备

固定的 dsh-std adapter 0.1.1-rc.3 存在上游限制：一个声明依赖 CommandRuntime 的组件加载后，后续组件可能在连接协商时启动失败。命令提供组件的验收不代表这种组合也兼容，使用前仍需验证实际组件集合。

市场曾管理标准组件时，卸载前必须先停止 DSH，再运行包内维护预览。下面的 DSH_HOME 须替换为实际绝对路径。准备步骤恢复上游自动发现，之前停用的标准组件可能重新加载；若不希望它们出现，先用官方 CLI 移除这些包。核对预览后重复命令并加 `--confirm <fingerprint>`；只有同意重新加载所列停用包时才加 `--enable-disabled`。结果为 `not-managed` 时无需确认。准备成功后再执行官方卸载命令。保留其他配置，并记录备份。

```powershell
node "<DSH_HOME>\profiles\web\node_modules\dsh-market-integration\integration\maintenance.mjs" prepare-uninstall --home "<DSH_HOME>" --profile web
```
