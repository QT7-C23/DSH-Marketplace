# DSH 市场架构

适用于 `v0.2.0-alpha.1`。安装入口见[安装指南](PACKAGE_INSTALLATION.md)，其他文档见[文档目录](README.md)。

## 运行与模块边界

```text
DSH public slots / session services
  └─ React Market → MarketController → local port (favorites / drafts / ratings / language)
                                    → authenticated host HTTP
                                       ├─ Community → catalog / SQLite prepared-file counts
                                       ├─ SourceManager → six adapters / caches / identity / removals
                                       ├─ Documentation → original files; Translation → selected DSH model
                                       ├─ RepositoryStars / NpmDownloads → external metrics
                                       ├─ PluginAvailability → public Loader / AgentPresets inventory
                                       ├─ ExtensionManager → compatibility / native + standard ports
                                       │                    └─ ProfileInstaller → official CLI / patch / journal
                                       ├─ SkillResources → verified files + native Skill registry
                                       └─ McpManager → fixed definition + profile / tool-registry ports
```

`integration/plugin/index.mjs` 是宿主接线入口；`market/` 负责界面及客户端边界，`compatibility/` 负责包管理和生命周期，`resources/` 负责 Skill 与 MCP。`community/contracts.mjs`、类型化控制器及各专用响应验证器约束跨 HTTP 数据。UI 不读取其他模块私有状态。

宿主固定 DSH `0.1.5-rc.2`，通过公开插槽、认证连接和服务接入，不修改上游源码。市场样式限定在 `.community-ui` 范围并使用宿主主题令牌。`prototype/`、`server/` 只是保留的历史交互原型，其演示状态不作为实际宿主能力。

## 来源、分页与稳定身份

`sources/definitions.mjs` 定义六个来源：固定 DSH 官方模块／命令、Anthropic Skills、OpenAI Skills、npm 社区扩展、官方 MCP Registry、本项目审核 GitHub 索引。npm 按实际搜索分页、包身份和元数据收录；MCP 按最新有效定义完整分页；Skill 扫描固定仓库提交和文件树。GitHub 审核入口还可接纳其他仓库／根的完整 Skill bundle。

`sources/contracts.mjs` 验证来源、扫描结果和完整计数；`skill-bundles.mjs` 核对原始文件路径、固定提交、Git blob、大小、模式及许可；`community.mjs` 验证六类审核绑定。页面／游标／协议失败以及同身份冲突不能降级成成功的部分目录；单条不符合收录条件则记录排除原因。

`SourceManager` 分来源串行合并重复同步请求，将成功快照原子写入 `DSH_HOME/community/sources/catalog-cache.json`。失败保留旧条目，30 分钟重试；自动发现正常每六小时检查，暂停偏好持久化。停用时取消并等待在途读取，再关闭相关资源。固定 DSH 来源不做漂移式自动发现。

`merge.mjs` 按 npm 包名、MCP 服务名、Skill 仓库＋根、父项＋Slash 命令和 Prompt 稳定 ID 去重，保留别名；优先级保留官方与审核固定信息。修订基于内容指纹，单纯上游提交移动不替换未改动内容，用户选定副本不会自动升级。

`release-seed.mjs` 将发行用 MCP 起始快照限制为最多 100 条，并移除完整扫描报告；运行时仍完整分页。初始快照用于启动，不能标成完整实时目录。实际文件清单与校验值见构建生成的 `artifacts/releases/package-result.json`。

## 社区审核与跨来源退出

通用投稿是提案合同，不携带可执行绑定，也不提供本机发布接口。维护者将 Prompt 源文件放入 `catalog/prompts/`，其他审核条目放入 `catalog/resource-entries.json`。`catalog/build.mjs` 验证所有条目后生成 `index.json` 和六类 `registry.json`；客户端固定 `main` 提交读取并校验 Git blob。详情延迟读取完整正文／定义，列表以摘要和分批渲染承载大目录。

Plugin／Theme 需要精确、版本一致的 `packageRef`；Skill 需要完整固定 bundle；MCP 需要完整固定 `serverDefinition`；Slash 必须绑定已知父项和命令；Prompt 保留原文及署名。Issue 可先缺少字段供人工审核，不能绕过公开入库合同。[目录格式](../catalog/README.md)

`sources/removals.json` 经索引同步，只有审核社区来源能更新远端退出策略。策略在当前条目尚存时绑定稳定身份，也接受明确身份；在源快照和最终别名合并后全局执行，父插件退出也隐藏所属命令。缓存原子保存最后成功策略，网络失败和重启不会恢复已退出别名。目录、详情和后续获取拒绝已退出项，用户的安装与私人副本保留。UI 提供申请链接及设置中的已知策略列表。

## 插件声明与安装边界

| 声明或操作 | 职责 |
|---|---|
| `dsh.bundle: { "patch": "./cordis.patch.yml" }` | 向指定 profile 提供模块与配置组合 |
| `dsh.client: { "platform": "web" }` | 声明前端加载信息，通常配合 `exports["./client"]` |
| `dsh plugin --profile web add <package>` | 通过 pnpm 安装依赖并协调可用 bundle |
| `dsh-plugin.json` | 标准组件声明，由已加载的 dsh-std 适配器发现和挂载 |

后端插件可以没有前端；client 声明不代表完整 bundle，CLI 成功不代表加载和调用成功。四个官方模块可能已包含在宿主或预设中，不应重复安装。采用 dsh-std 是自愿的，其适配器提供原生 bundle，组件无需重复提供；同时声明两条自动发现入口的发布物会被市场拒绝，避免重复激活。

市场按精确 npm 版本检查 SRI、实际声明、宿主／Node 范围及反向依赖。通过预览并明确执行后才调用官方 CLI，目标 profile 来自可信配置；具体命令和重启流程统一见[资源管理](EXTENSION_MANAGEMENT.md#npm-插件与主题)。

## 包管理与标准组件

`compatibility/packages.mjs` 获取精确 npm 发布物；`assessment.mjs` 检查实际宿主范围与标准协议；`manager.mjs` 编排预览、版本、请求去重和状态；`installer.mjs` 是 profile 的共享写入边界，负责指纹、文件锁、备份、官方 CLI、patch 与日志。

原生控制只使用公开 Loader 条目及配置，受保护包和反向依赖拒绝破坏性操作。标准路径由 `standard-control.mjs`、`standard-view.mjs`、`standard-loader.mjs` 组成：验证 profile 内直接安装绑定，建立完整启用集合的不可变视图，由公开 `adapter.mountProfileComponents(view)` 导入与挂载。包代码不复制，禁用身份不会进入发现集合；不读取 SDK 私有句柄。

首次接管以同一配置事务关闭旧核心自动发现并插入市场 Loader，可能重载全部标准组件。公开 SDK 不能证明旧批次已完全清理，所以**同进程接管始终为 unknown／restart-required，禁止下一次标准控制；替换适配器 active 不能解除这个条件**。必须完整停止并新启动宿主。

正常启动的稳定 Loader 接受后续目标集合写入，并通过公开配置更新回调保留当前活动批次到下次初始化。依赖失败、核心变化或非活动生命周期仍可能重载。目标与实际分开投影，无模块缓存热替换、浏览器热移除或自动恢复。标准组件在 0.2.0-alpha.1 包中通过五次独立启动与浏览器验收。[管理与恢复](EXTENSION_MANAGEMENT.md)

## Skill 与 MCP

`SkillFiles` 管理 `DSH_HOME/skills/<name>` 及 `community/skill-files/` 私有回执、锁、事务、停用与恢复区。文件先完整校验再发布，更新保存旧版，移除保留字节，恢复核对归属及现存内容；外部改动或不确定状态阻止替换。原始文件／继承许可保留，路径链接和目录逃逸拒绝。回执锚和事务记录支撑明确的进程中断恢复，不承诺断电或恶意并发替换安全。

`SkillResources` 复核当前目录的 ID／修订，再调用文件端口，并用原生 Skill 注册接口核对实际来源。文件 installed 不自动升级为 loaded，已加载也不自动证明每个任务都有效。原生加载／调用与六次宿主启动的生命周期已有记录，具体 Skill 自身运行需求仍有效。

`McpManager` 只接受当前审核／Registry 定义，`mcp-config.mjs` 将声明转换为受支持的公共 HTTPS Streamable HTTP 或精确 npm stdio 配置；不由浏览器自由拼接执行程序。`mcp-profile.mjs` 经共享安装器写入归属明确的配置，使用公开 Loader 和工具 schema 判断状态。管理回执在 `community/mcp-manager/`，公开响应省略秘密值。注册不是服务健康；更改配置／版本需先移除再明确连接，不自动迁移凭据。

## HTTP、统计与本机数据

主要读取入口为 `/api/community/read`、`resource`、`sources/read`、`availability`、`extensions/read`、`skills/read`、`mcp/read`、`operations`、`withdrawals`、`stars` 和 `npm-downloads`。对应写入使用专用 POST 合同，经过宿主认证与同源检查；目标 profile 和目录来自可信接线，HTTP 不能指定任意路径。

公开快照 schema 2 包含目录和本机下载统计。SQLite 只为成功准备文件的请求计数，事务中复核资源修订，相同请求 ID 去重；不是文件落盘或安装计数。旧账户／私有表保留而不公开、不迁为公共内容。浏览器 `dsh-market-local-v1` 保存收藏副本、署名草稿、个人评分与语言；损坏或并发外部改写时拒绝覆盖。

`RepositoryStars` 读取整个 GitHub 仓库；`NpmDownloads` 从真实包身份读取 `last-month`，保留起止日期、检查时间和 fresh／stale／unavailable。按可见页最多 60 个不同包，四路并发、请求去重、超时及失败保留旧值；无包资源不猜测。真实零与未知分开，不将它们和本机计数相加。

`operationStatus` 限制最近 20 条 profile 操作，只投影编号、动作、名称、阶段、时间及阻塞情况。日志、profile 备份和 Skill 恢复区仍为本机私有证据；公开 UI 没有自动解锁或回滚能力。

## 作者文档、翻译与会话

文档只能从目录 ID／修订解析，不能指定任意抓取地址。保留固定 Skill 文档与文件 hash，Slash 关联父插件；仓库当前文档与所选资源版本不一致时标注。README 优先界面语言，再回退英文；缺失与网络失败分开。Markdown 不执行 HTML／脚本或自动加载远程图片，相对链接指向来源。

翻译通过公开 `llm.listProviders/listModels/stream` 使用用户选定模型，明确点击 Token 提示按钮才开始。服务端重新读取所选原文，不接受替换正文；最多 24,000 字符、90 秒，不自动拆分或重试。不发送会话历史、工作区或工具。截断、缺少结束帧或工具调用不作为完整译文，未知用量保留未知；失败／取消仍可能计费。

运行期最多缓存 32 个翻译请求结果、同时两次翻译；去重不跨重启，不是共享译文库。页面切换取消旧请求，插件停用时中止并等待。测试适配器验证管线，不代表具体付费模型的翻译质量。

Prompt 通过公开会话快照和 `slash/input-insert-text` 追加，复核会话／草稿并保留文本、引用、附件。Slash 使用当前会话命令列表与执行接口，不读取或覆盖 composer；实际 `/plan` 与 `/plan off` 已核查。

## 安装包、凭据与验证

`integration/package.mjs` 从后台本地导入图与公共资产清单生成独立 TGZ，包含前端、目录、三语说明和许可，导出 bundle、client 与标准 Loader。宿主元信息从真正运行的官方 CLI 解析；源码挂载与包安装共用逻辑，不依赖开发源码目录。[安装包](PACKAGE_INSTALLATION.md)

Windows DPAPI 保存可选 GitHub 读取令牌；只允许官方 API GET 携带认证，拒绝重定向。原文、npm、MCP 不接收该令牌；MCP 自己的明确连接凭据属于另一配置流程。[GitHub 连接](GITHUB_CONNECTION.md)

`npm run verify` 是静态、目录、行为、类型、构建和实际宿主的共同入口。Windows CI 与本地 pre-commit 调用相同命令；线上 CI、hook 激活和当前完整门禁均需真实结果才能声称通过。其他宿主版本、完整第三方组合与自动恢复未获得保证；本地模型下载及 Cookbook 暂缓。

标准组件卸载边界与上游 CommandRuntime 组合限制见 [安装说明](PACKAGE_INSTALLATION.md)。
