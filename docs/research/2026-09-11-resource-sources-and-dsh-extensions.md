# 资源来源与 DSH 扩展核查

日期：2026-09-11｜用于 [产品策划案](../PRODUCT_PLAN.md) v0.4｜性质：官方资料与局部源码核查，未完成接入实测。

## 1. 需求与结论

甲方要求加入 Ollama、OpenRouter，主动寻找其他模型厂商、Skill 和 MCP 来源；并核查 Slash 在第三方维护的 DSH 中是否可行、是否符合相关协议。

结论：多来源自动发现有现成目录或发布格式可利用，但来源范围、获取方式与使用条件不相同。DSH 已有原生命令注册、Skill 提供者和 MCP 客户端；这些是可行性依据，尚不是本市场的集成验收结果。MCP 当前能力边界尤其需要明示。

## 2. 模型来源

| 来源 | 已核查的官方依据 | 接入判断与缺口 |
|---|---|---|
| Hugging Face、Civitai | 前轮已核查模型目录、搜索、版本或文件等资料，见 [既有记录](2026-09-11-codex-pivot-reference.md) | 权重与组件来源候选；格式、基础模型和实际运行仍逐类验证 |
| Ollama 本机或指定主机 | [`/api/tags`](https://docs.ollama.com/api/tags) 查询对应服务的模型列表 | 可帮助识别该运行位置已有模型；不能当作官网完整资源库 |
| Ollama Cloud 与官网目录 | [Cloud 文档](https://docs.ollama.com/cloud) 给出 `https://ollama.com/api/tags` 列举可直接通过云 API 使用的模型；[官网模型库](https://ollama.com/library)另有浏览目录 | 云端查询、模型库发现与本地运行分开。尚未确认一个可稳定同步官网完整目录的公共接口；不能用云端列表冒充全库 |
| OpenRouter | [模型列表接口](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties)返回模型标识、能力及计价等资料 | 属于在线调用目录；账户配置、额度与目标调用需另外验证，不能统一展示“下载” |
| DeepSeek 官方 API | [模型查询](https://api-docs.deepseek.com/api/list-models)提供当前模型列表及基本身份信息 | 作为厂商直连候选；不要假设简单列表包含完整能力或价格字段 |
| Google Gemini API | [Models API](https://ai.google.dev/api/models)支持模型列表、分页及模型信息 | 作为厂商直连候选；按模型支持的方法与账户条件判断，不能认为目录内所有模型都适用于聊天 |

本轮没有引用网页中的模型数量、下载量或示例价格来评价市场规模。相同模型在厂商直连、聚合服务和本地运行中的路径需保留，不能凭同名合并掉账户和服务差异。

## 3. Skill 来源与 DSH 接入

已确认可研究的来源：作者官方仓库、[Anthropic Skills](https://github.com/anthropics/skills)、[skills.sh](https://www.skills.sh/docs)及其维护方提供的 [skills 工具](https://github.com/vercel-labs/skills)。后者有关键词和作者范围搜索能力，可作为发现方式候选；本轮未执行其安装命令。

[skills.sh API 文档](https://www.skills.sh/docs/api)描述列表、搜索和详情接口，并给出 Vercel OIDC 认证与限流条件。因此列为有访问条件的候选，尚未确认本项目部署方式下的可用授权；不假设它是任意客户端均可匿名调用的公共全量接口，也不为接入一个来源先决定本项目部署在 Vercel。

[Agent Skills 规范](https://agentskills.io/specification)定义 `SKILL.md`、元数据和可选脚本、参考材料及资源文件。我们的获取对象应保留完整目录及出处，格式符合规范后仍需检查 DSH 所需工具与调用策略。Anthropic 仓库明确区分开源 Skill 和部分仅公开源码的文档 Skill，来源统一不代表每项许可相同。

DSH [Skill 子系统文档](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/docs/subsystems/skills.md)给出多来源提供者以及本地加载规则，允许以提供者接入来源。当前本地提供者不递归发现任意深度的 `SKILL.md`，并有作用域与用户/模型调用策略。市场需要转换安装布局并验证实际生效，不能直接把整个上游仓库扔进任意目录。

## 4. MCP 来源与 DSH 接入

[官方 MCP Registry](https://modelcontextprotocol.io/registry/about)面向服务元数据发现，适合作为市场的上游来源。[聚合方文档](https://modelcontextprotocol.io/registry/registry-aggregators)提供只读 REST 接口、游标分页、按更新时间同步和状态字段。它当前标为预览；同步端需要保留来源状态与缓存，不能把临时失败当作服务被删除。

市场获取的是服务发布信息。具体使用可能是安装本地包后通过 stdio 启动，也可能连接远端 Streamable HTTP 地址。还需解析配置要求、完成认证并验证工具调用。兼容注册表和服务商官方发布可继续纳入来源调查，不宣称已覆盖所有 MCP 服务。

DSH [MCP 客户端文档](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/mcp/mcp-client/README.md)已描述这两种传输，但当前仅桥接工具，Resources、Prompts 及要求 task 扩展的工具存在明确缺口。产品应按目标服务实际需要的能力判断，不能仅凭“MCP”标签标为完全兼容；账户认证方式也需按目标服务实测。

目录可发现的所有服务不应自动激活。激活服务的工具会进入模型工具集合，影响运行环境与上下文成本；首次实现先管理实际选用的服务及其生命周期。

## 5. Slash 的可行性与协议边界

### 5.1 已确认的原生能力

DSH 官方仓库默认分支为 `master`。本轮 GitHub 树查询固定到 `c291e7961a515f6d7af9304e7fd1d257929aef26`；以下结论不代表甲方已经安装该版本，也不覆盖全部历史版本。

[命令包说明](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/interaction/commands/README.md)允许插件调用 `ctx.commands.register()` 提供命令名称、说明和处理函数。还读取了[注册实现](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/interaction/commands/src/index.ts)，确认它校验定义并通过作用域层注册、返回移除函数。命令可供交互式 CLI/Web 使用；无界面与 ACP 自动化没有该交互入口。

直接命令处理与给模型发送一段提示词具有不同语义。命令参数由提供方解释，同作用域重名会冲突。市场需记录命令所属插件、作用域和生命周期；用户获取命令时实际获取其实现或可转换定义，而不是假定存在跨产品统一的 Slash 文件格式。

### 5.2 三种不同的约束

| 约束 | 本轮判断 |
|---|---|
| DSH 技术接口 | 优先使用其公开插件扩展点；命令、Skill 和 MCP 分别对照对应服务。接口存在不代表目标组合已通过测试 |
| 社区互操作协议 | 如果采用 dsh-std，遵循选定版本的组件和能力约定；[adapter-dsh 文档](https://github.com/Yan-Zero/dsh-std/blob/main/packages/adapter-dsh/README.md)已有 `CommandRuntime` 映射，但具体界面发布仍依赖位置提供者，需联调 |
| 开源许可证 | 当前 [DSH LICENSE](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/LICENSE)为 MIT；复制或分发需保留其要求的声明。各第三方资源许可另行记录，不能用宿主许可证代替 |

建议保留 Slash，先验证原生插件注册路线；采用社区标准时再验证标准到原生界面的映射。不把修改或分叉 DSH 作为先决条件，也不承诺任何来源的命令无需转换。

## 6. 后续验证与范围

1. 逐源记录官方入口、列表范围、身份、版本、获取方式、认证、更新及限制；用有限真实样本完成查询和同步，不用示例数据验收。
2. 验证 Ollama 的不同目录范围、OpenRouter 和厂商的目录与调用条件；只在对应运行或账户条件具备时测试推理。
3. 获取一套含引用文件的真实 Skill 并验证 DSH 调用；测试作用域、缺依赖和来源更新。
4. 用 DSH 支持的两种传输分别连接测试 MCP，验证工具发现、调用、断连、移除及不支持能力的状态。
5. 以最小插件验证 Slash 注册、界面可见、参数、冲突、执行和卸载；如果选用 dsh-std，再跑标准映射案例。

以上是下一阶段实验计划。本轮仅更新方案与研究记录，未安装 DSH、Skill 或 MCP，未读取用户凭据、下载模型或执行推理，也未修改 Pivot。
