# Codex 与 Pivot 产品参考核查

日期：2026-09-11｜性质：只读资料与局部源码核查，非运行验收。

本记录为 [产品策划案](../PRODUCT_PLAN.md) v0.3 提供参考依据。甲方指定 Codex 为喜欢的插件商店体验，并要求参考 Pivot 的多类资源市场，以及连接外部服务自动发现资源的设想。本记录区分产品价值、代码存在和可交付能力。

## 1. Codex：体验与内容组织参考

已读取 [OpenAI 官方插件资料](https://learn.chatgpt.com/docs/plugins)。页面给出的目录示例与说明包含按用途发现、搜索、来源分组、已安装入口，以及查看详情、安装、连接外部能力和安装后使用的流程；插件可以包含 Skill、MCP 等组成部分。

据此提出的 DSH 设计建议：先让用户理解资源能解决什么任务，再进入详情和操作；安装后提供明确的使用入口；将资源来源、状态和组成展示清楚。一个插件包带来的技能可以在资源库中被找到，并保留来源关系。

资料中的目录示例不能证明甲方当前桌面版本的全部布局。尚未完成当前界面的视觉与交互观察，不把具体卡片尺寸、弹层方式、按钮位置或动效视为已确认要求。Codex 的插件格式和执行方式也不等于 DSH 的接入协议。

## 2. Pivot：本地代码确认与缺口

本地位置：`D:\Project\Tiny Agent Code`。仓库基线提交为 `f5edee8bf66baf3b756d366ce75f715d2421ca5f`，工作树存在大量未提交修改，因此以下结论针对本次读取的工作树，不代表全部内容属于该提交。未修改该仓库、未启动应用、未运行测试。

| 核查对象 | 实际看到的内容 | 可参考价值与边界 |
|---|---|---|
| 市场分类与个人资源 | Plugins、Skills、Prompts、Themes、Model Hub；Installed、Favorites | 多类资源发现与个人资源管理的组织方式。[源码](<D:/Project/Tiny Agent Code/src/renderer/components/plugin-ecosystem-page.tsx:10>) |
| 搜索与详情 | 搜索、来源筛选、概览、更新日志、评价、支持等结构 | 可研究信息层级和详情页组成；缺少评价数据时有空态，不能据此宣称已有评价社区。[源码](<D:/Project/Tiny Agent Code/src/renderer/components/plugin-ecosystem-page.tsx:52>) |
| 实际资源种类合同 | `plugin`、`skill`、`prompt`、`theme` 四类 | 能参考类型区分与发布身份；其中不含模型权重或独立 Slash 命令类型。[源码](<D:/Project/Tiny Agent Code/src/shared/marketplace-contracts.ts:32>) |
| Model Hub | 代码明确显示尚未接入，并将模型连接指向模型与提供商 | 保留产品设想，不能把页面当作本地模型下载、硬件检查和安装实现。[源码](<D:/Project/Tiny Agent Code/src/renderer/components/plugin-ecosystem-page.tsx:108>) |
| Slash Commands | 有设置页，自定义命令创建按钮禁用，提示等待注册表接入 | 可研究命令管理入口；不是已经完成的命令市场。[源码](<D:/Project/Tiny Agent Code/src/renderer/components/settings-capability-status-pages.tsx:8>) |
| Skill、Prompt、Theme 资源内容 | Skill 有指令与触发声明，Prompt 有正文，Theme 使用语义颜色字段 | 可参考资源内容合同；兼容 DSH 仍需专门转换和使用测试。[源码](<D:/Project/Tiny Agent Code/src/shared/marketplace-resource-contracts.ts:8>) |
| 资源激活与使用 | 消费适配器具有注册、版本选择、Prompt/Skill 输入增补和主题选择逻辑 | 属于代码候选；不能把它当成已经适配 DSH 的运行层。[源码](<D:/Project/Tiny Agent Code/src/main/services/marketplace-resource-consumer-adapter.ts:19>) |
| 免费生态规则 | Pivot 文档明确其免费开放生态与禁止付费门槛的规则 | 属于治理参考；本轮不自动迁移为 DSH 的商业政策。[文档](<D:/Project/Tiny Agent Code/docs/free-ecosystem-policy.md:1>) |

## 3. 两个 GitHub 仓库的分工

[Pivot 本体](https://github.com/QT7-C23/Pivot)与[Pivot-Marketplace](https://github.com/QT7-C23/Pivot-Marketplace)均已访问。商店仓库的当前 README 描述其目录与分发资料职责，并说明已有四类首方包来源，但生产目录尚未完成正式发布。[发布状态来源](https://github.com/QT7-C23/Pivot-Marketplace/blob/main/README.md)

可研究的组织方式是将客户端运行与目录发布分开管理。是否采用独立仓库、如何签发发布内容，需要结合 DSH 的维护方式决定。历史项目的代码行数、测试数量和目录存在与否，都不能单独证明迁移成本或产品成熟度。

## 4. 采纳建议与后续验证

| 层面 | 本轮建议 | 后续需要的证据 |
|---|---|---|
| 产品形态 | 采用多类资源市场与统一个人资源库方向 | 各类型的真实任务与首发支持条件 |
| 用户体验 | 参考 Codex 的发现到使用流程、Pivot 的资源分类与详情结构 | 当前页面观察、任务原型与用户操作反馈 |
| 资源合同 | 参考统一身份、版本、来源和按类型校验，补齐模型与命令语义 | 与 DSH 实际加载和注册机制的对照 |
| 执行与激活 | 把 Pivot 实现列为待评估资产 | 依赖、许可证、测试、宿主适配和性能检查 |
| 目录与分发 | 参考独立目录发布与完整性记录 | 可维护的来源、发布及更新流程 |
| 未完成能力 | Model Hub 与 Slash 以需求和设计参考继续规划 | 下载/导入/运行/连接以及命令注册/调用的真实闭环 |

设计工作参考已读取的 [PROJECT_DESIGN_BASE.md](<C:/Users/Heptachron_Abyss/Documents/Obsidian/FigmaUIDesign/PROJECT_DESIGN_BASE.md>)，优先保证任务、信息层级、真实状态和可访问性。本轮只完善产品信息架构，未生成高保真页面或修改 Pivot 设计与代码。

## 5. 补充澄清：外部资源自动发现

甲方说明：过去希望商店连接各个服务，自动获取可能的资源，例如 Model Hub 从 Hugging Face、Civitai 获取 LLM、视频、语音、LoRA 等模型，但当时未实现。该陈述作为需求与项目经历记录，不能从结果反推技术路线不可行，也不能擅自归因于开发方式或需求变化。

本次在 Pivot 的 `src/`、`docs/` 中搜索 Hugging Face、Civitai、Model Hub 等词，找到页面占位及缺口记录，未找到以这些名称标识的来源连接实现。[缺口记录](<D:/Project/Tiny Agent Code/docs/design/pivot-ui-v2-implementation-gap-2026-08-21.md:27>)同样标注 Model Hub 未交付。结合现有资源合同，可确认当前读取的工作树没有形成所期待的 Model Hub 流程；尚未审查全部历史分支与提交，不能据此断言过去没有尝试，或认定当时失败的具体原因。

| 来源 | 官方资料核查 | 对设计的约束 |
|---|---|---|
| Hugging Face | 官方客户端提供列表、搜索、任务筛选和模型信息；模型卡支持基础模型及适配器关系说明 | 以来源提供的字段归类，缺失信息保持未知；模型库信息不是本机运行证明。[客户端](https://huggingface.co/docs/huggingface_hub/package_reference/hf_api)、[模型卡](https://huggingface.co/docs/hub/model-cards) |
| Civitai | 现行官方文档描述 Site API 的模型、版本与文件信息，以及类型、基础模型筛选和游标分页 | 按该来源定义处理分页与获取条件；查询目录和提交生成任务分别接入。[模型文档](https://github.com/civitai/civitai-developer-docs/blob/main/site/reference/models.md)、[Site API 定位](https://github.com/civitai/civitai-developer-docs/blob/main/site/index.md) |

Hugging Face 的 [API 入口](https://huggingface.co/docs/hub/api)提示速率限制。Civitai [旧 Wiki](https://github.com/civitai/civitai/wiki/REST-API-Reference)已指向新开发者站点；本轮该站点参考页读取失败，改读其官方文档仓库，没有沿用过期 Wiki 字段作为现行依据。以上均属文档核查，未向模型列表接口请求样本、下载权重或运行推理。

策划案据此增加 R13、第 4.5 节和 E7：连接来源后自动发现与刷新真实条目；按任务、组件角色、格式和运行方式分别归类；将列表可见、文件可获取和任务可运行分别验收。自动汇总与精选推荐可以并存，不能以人工上架目录替代自动发现目标。两家来源的实际类别覆盖、访问稳定性和字段完整程度仍需实验，不承诺任一来源单独覆盖全部类型。
