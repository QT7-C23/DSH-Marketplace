# DSH 市场架构

## 运行路径

```text
DSH slots → Market / Prompt → MarketController
                              ├─ LocalPort → 浏览器收藏、草稿、个人评分、语言
                              └─ HTTP → Community → 公开目录、SQLite 下载统计
                                       ├─ SourceManager → 来源适配器、版本缓存、包校验
                                       ├─ Documentation → 固定来源的作者文档
                                       ├─ Translation → DSH llm → 用户选定的模型
                                       └─ PluginAvailability → 宿主 Loader / AgentPresets
```

宿主固定为 DSH 0.1.5-rc.2。插件通过公开插槽和宿主 HTTP 通道接入；不修改上游源码。样式限定在 `@scope (.community-ui)`，使用宿主主题和正文字号。

`integration/package.mjs` 使用后端导入图和公共资产清单构建独立开发包；前端打包输入用于收集真实依赖许可证。安装包同时导出 Web client 与 bundle。`integration/plugin/host-runtime.mjs` 以正在运行的官方 CLI 为锚解析真实宿主版本、可执行入口和用户目录，不读取插件依赖副本来判断宿主。源码挂载与安装包共用业务实现，数据保存在 DSH 用户目录。构建与验收见 [安装包说明](PACKAGE_INSTALLATION.md)。

## 统一兼容层（R35，首轮实现）

`integration/plugin/compatibility/` 实现统一管理。`packages.mjs` 检查固定发布物；`assessment.mjs` 检查宿主范围与真实标准协议；`manager.mjs` 编排预览、请求去重及状态；`installer.mjs` 负责官方 CLI、指纹、锁、备份和操作记录；`ports.mjs` 分别读取 profile、Loader 和标准适配器公开状态。

```text
市场 UI → 统一资源管理合同 → 版本/能力检查、操作编排、归属与恢复记录
                              ├─ 原生接入 → 官方 CLI / 公开宿主接口
                              └─ 标准接入 → 固定版本的 dsh-std 协商与适配器
```

来源适配器继续负责发现与获取，不负责激活。统一合同记录资源修订、目标环境、接入路径、各阶段结果和证据；原生状态与标准组件状态由各自端口读取并投影，UI 不访问其内部状态。协议/适配器版本只适用于相应路径，不能作为全部资源的必填前提；六类资源继续保留各自的使用动作。

`GET /api/community/extensions/read` 返回当前 profile 的直接安装记录及运行状态；`POST /api/community/extensions` 处理预览与执行。目标 profile 来自可信插件配置，HTTP 不能指定路径或可执行文件。原有 `PluginInventoryPort` 继续服务目录详情；标准库存独立来自适配器 `snapshot()`，不读取私有字段。前端合同与重试逻辑位于 `market/extensions.mjs`，React 只消费此边界。具体行为、恢复边界与支持范围见 [扩展管理](EXTENSION_MANAGEMENT.md)。

## 目录、更新与文档

`sources/skills.mjs` 扫描 Anthropic 仓库实际目录，先解析提交与文件树，再校验目录结构、许可及原始正文。名称清单仅用于展示翻译，不限制发现。当前扫描 19 个 Skill，收录 12 个；7 个跳过项与原因保存在发现报告中。DSH 插件/Slash 和 MCP 仍更新指定条目，其他来源的自动发现未完成。

`SourceManager` 分来源合并并发更新，成功后原子写入 `DSH_HOME/community/sources/catalog-cache.json`；失败保留上次目录，30 分钟后重试。宿主运行时每分钟检查到期任务，正常间隔 6 小时；暂停偏好持久化。停用插件先停止调度并等待正在运行的更新，再关闭数据库。浏览器每 5 秒读取本机状态；后台成功更新后刷新列表，保留编辑中的草稿。

内容和文件散列决定资源修订号。仅仓库提交变化不替换未变化的 Skill；本机收藏仍保存所选版本，需要用户明确更新。旧缓存指纹在独立适配层转换，不覆盖损坏缓存。经核实的资源移除记录放在 `sources/removals.json`，应用于运行时和随包目录，避免再次发现后恢复展示。

`Documentation` 只接受目录内资源 ID 与版本，不接受任意抓取地址。Skill 使用固定提交的 SKILL.md 和目录内 README；插件读取自身目录；Slash 关联所属插件文档；MCP 仓库当前文档明确标记版本可能不符。缺失与读取失败区分，失败可重试。README 默认选择界面语言，其次英文；每资源至多三份 README，选择上限前保留中英日首选文件。这些文件并发读取，全部请求结束后按既定顺序返回或报告失败，仍逐文件校验原文散列；不会因某一语言失败就伪装为完整文档。Markdown 不执行 HTML、脚本或自动加载远程图片，相对链接指向原文位置。文档头部元数据不作为正文排版，原始内容完整保留。

## 文档翻译

`integration/plugin/translation.mjs` 通过公开 `llm.listProviders/listModels/stream` 合同使用宿主配置；不读取凭据或会话内部状态。模型选择默认显示宿主默认模型，用户可选择其他模型或填写同一已配置服务商支持的模型 ID。展开控件只读取模型列表，点击带 Token 提示的开始按钮才 POST；请求明确指定资源、版本、文件、目标语言及模型。后端重新读取目录中的原文，不接受客户端指定抓取地址或正文。单次上限 24000 字符、90 秒，不自动拆分或重试。

翻译只发送所选文档，无会话历史、工作区文件或工具。通过 SDK 创建不可变消息并组装流；截断、缺少结束帧或工具调用不当作成功译文。未知用量保持未知；输入 Token 汇总宿主非缓存输入与缓存读写，输出独立列出，费用以服务商记录为准。原文始终保留，译文带模型和目标语言标记，使用同一 Markdown 渲染边界。

运行期最多保留最近 32 个翻译请求结果（含失败），同请求编号并发/重试不会重复调用；不同内容复用编号拒绝，最多同时进行两次翻译。该去重不跨重启，也不是共享译文库。前端在当前阅读组件中保留译文，切换文件、资源或界面语言会清理结果并取消旧请求；取消也可能已产生服务商用量。插件停用时中止并等待在途翻译。测试使用隔离宿主的本地测试适配器，不调用付费模型，不代表已评估具体模型的翻译质量。

## 投稿、数据与统计

市场没有注册、登录、账户同步或本机发布接口。五类投稿表单收集作者、编号、许可、语言、来源与内容，导出 JSON，再由用户向 GitHub 提交；文件导出不等于上传。Prompt 通过 PR 加入 `catalog/prompts/`，其他类型在资源提交 Issue 中附文件、要求和实测。署名不是身份认证，维护者核对来源和授权。

公开快照 schema 2 只有目录与下载统计。SQLite 保留 `catalog_downloads` 和下载请求摘要；旧账户表不删除、不公开、不再读取。没有把旧私有草稿迁成公开内容。下载准备成功后事务复核当前版本并计数，相同请求重试只计一次；失败不计数，旧请求不能读取已移除资源。

浏览器站点键 `dsh-market-local-v1` 保存收藏副本、投稿草稿（含署名）、个人评分和语言。兼容旧的本机收藏及草稿；存储损坏或其他标签页已改写时拒绝覆盖。个人评分不是社区均分，收藏状态不是全网收藏人数。下载量是本机服务成功准备文件次数；GitHub Star 是整个来源仓库的数据，未知不填零。

## 配置与边界

`GET /api/community/availability` 通过 `PluginInventoryPort` 读取公开 `loader.entries()` 和 `agentPresets.compositionInventory()`。只投影目录内 npm 模块及其 Slash 父插件的匹配结果、作用范围和状态，不传配置、路径、条件表达式或失败原文。预设尚未挂载时显示已配置，不能显示已加载；存在损坏预设时标记读取不完整。前端校验 schema 与状态，每 15 秒在可见页面刷新，失败清除旧判断，页面卸载取消请求。该接口不接受写操作，也不实施安装。

正式安装路线采用 DSH 官方 `dsh plugin --profile <name> add/remove`，由官方维护 profile 的依赖与 bundle 列表；市场负责来源确认、进度、版本和启用结果核查。`dsh.bundle.patch` 指向配置层，`dsh.client` 描述前端加载，两者并不互相替代。当前商城自身只有本地开发挂载和 `dsh.client` 声明，尚无独立的官方安装包；现有四项官方功能模块也不能直接当作四个可独立安装的社区 bundle。下一阶段边界见 [官方安装方案](OFFICIAL_PLUGIN_INSTALLATION.md)。

`languages/zh-CN.json`、`en-US.json`、`ja-JP.json` 是前后端共用语言文件，测试约束键与占位符一致。设置页提供界面语言和自动检查开关；界面偏好留在浏览器，来源开关保存在宿主缓存。API 通过 `x-market-language` 本地化已知错误。资源正文、作者名、许可名和上游诊断保持来源信息。

HTTP POST 必须经过宿主访问认证及同源检查。没有市场账户不代表公开暴露宿主。网络读取仅访问支持的 GitHub、npm、MCP 域名，拒绝重定向，不发送工作区内容。`sources/github-credentials.mjs` 负责 Windows DPAPI 存储，`sources/github-auth.mjs` 负责官方 GitHub API GET 认证和连接状态；原文服务、npm 与 MCP 不接收令牌。设置仅返回状态及额度，详见 [GitHub 连接](GITHUB_CONNECTION.md)。Skill ZIP 逐文件校验 Git blob 散列，插件 TGZ 校验 npm SRI；下载不自动执行资源。

Prompt 使用公开会话快照与 `slash/input-insert-text`；追加前复核会话、忙碌状态与草稿版本，保留已有文本、引用和附件，不发送模型请求。

## 验证与限制

统一入口为 `npm run verify`，覆盖真实 SQLite、前端状态、来源失败恢复、包完整性、Markdown、三语、TypeScript 与隔离 DSH 浏览器实验。历史交互原型与其测试保留作设计对照，其身份切换、安装演示不代表当前插件行为。

实际安装、Skill 加载、MCP 连接、Slash 执行、自定义来源、公共社区统计、在线投稿同步、公共部署和跨宿主兼容仍未完成。
