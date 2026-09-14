# DSH 可贡献方向比较

日期：2026-09-13｜性质：官方资料、社区线索与局部源码核查，非产品实施决定。

## 1. 结论与当前贡献条件

如果甲方希望另选方向，存在可形成独立产品或具体生态贡献的候选。优先考虑有具体失败场景、可复用现有基础且不依赖官方合并才能交付的工作。以下排序为乙方判断，不代表市场验证或甲方选择；[现有市场方案](../PRODUCT_PLAN.md)继续保留。

本轮 GitHub API 查询官方仓库，默认分支 `master` 为 `c291e7961a515f6d7af9304e7fd1d257929aef26`，提交日期 2026-09-10；Issues 未启用，Discussions 已启用。不能从 Issues 搜索为空推断没有用户问题。

官方 [CONTRIBUTING.md](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/CONTRIBUTING.md)明确目前不接受外部 PR，欢迎问题报告、社区插件、指南与社区帮助。因此当前可交付出口包括可安装的社区项目、可运行的复现与测试材料、使用资料，以及获得授权后发布的 Discussions 反馈。上游采用与否不能提前承诺。

## 2. 四条候选方向

| 方向 | 用户得到什么 | 第一份可评审交付物 | 主要边界 |
|---|---|---|---|
| A：MCP 连接与诊断助手 | 看懂连接、认证、工具可用状态，解决连接后不能用的问题 | 一个目标服务从配置、连接、工具调用到令牌失效或断连后的完整处理流程 | OAuth 与重连有真实复杂度，必须先评估现有社区实现；不从零重写完整 MCP 栈 |
| B：兼容回归与故障复现工具 | 升级或接入扩展前，有可复查的功能证据；作者能定位破坏点 | 一个真实问题的最小复现、正常对照、可重复测试及固定版本报告 | 不替代官方已有测试与运行自检，不用无限版本矩阵或人工故障推算生态破坏率 |
| C：完整场景能力包 | 安装一套明确用途的能力后，真正完成任务 | 一个带资源、配置引导、示例输入与结果检查的 DSH 场景包 | 先确定有实际需求的场景；保留必要外部账户和依赖，不承诺所有人无配置即可使用 |
| D：可执行示例与扩展作者工具 | 教程命令能跑，常见插件或 Skill 错误在使用前暴露 | 一个版本固定的示例及自动验证流程，输出配置、加载、功能检查的分层结果 | 静态校验通过不等于安全或运行成功；已有作者工具与文档先复用 |

## 3. 需求线索、已有工作与空缺

### A：MCP 连接与诊断

社区 [#3997](https://github.com/deepseek-ai/deepseek-harness/discussions/3997)讨论 OAuth 刷新，另有 [#3063](https://github.com/deepseek-ai/deepseek-harness/discussions/3063)提出认证状态、断开授权和长任务生命周期需求。本轮读取官方 [transport.ts](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/mcp/mcp-client/src/transport.ts)，其中构造 HTTP 传输时传入静态 headers，未传入 SDK 的 `authProvider`。这确认了该处接口缺口，不证明已复现全部社区问题。

已有 [pi2dsh 的 MCP 接入说明](https://github.com/weijiafu14/pi2dsh/blob/main/docs/mcp-compatibility.md)及其作者在讨论中的替代路线。本轮未运行验证，不能将这一方向包装为没人做。建议先复测已有实现，再选择仍缺少的状态展示、授权生命周期、错误解释或服务接入案例；如果既有产品已完整解决，就贡献测试与适配，不再重做相同功能。

适合希望做可见产品、又希望保留未来市场接入价值的路线。首个目标应是一个完整服务案例，避免一开始承诺所有服务、所有认证方式。

### B：兼容回归与最小复现

社区 [#5905](https://github.com/deepseek-ai/deepseek-harness/discussions/5905)报告 MCP 工具列表分页不终止，并记录对特定 npm 版本的复核。本轮阅读报告及评论，未独立复现或确认当前发行版仍有相同缺陷。可将其列为候选用例，先确认状态，再提供边界明确的测试和修复验证。

官方已经有 [runtime-diagnostics](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/runtime-diagnostics/README.md)及包级运行契约自检。建议贡献真实场景与可重复证据，利用已有接口和测试体系；不另造一套覆盖所有内部机制的总诊断框架。

这条路线与原市场方案的兼容验证资产可共用，也能独立服务插件作者。若官方暂不接 PR，仍可交付复现包与外部验证工具，但不能称修复已经进入上游。

### C：完整场景能力包

社区 [#2190](https://github.com/deepseek-ai/deepseek-harness/discussions/2190)提出常用 Skill 与新用户上手诉求，这是需求线索而非用户规模证据。已有 [dsh-skill-hub](https://github.com/deepseek-ai/deepseek-harness/discussions/3161)作者声明支持图形化 Skill 管理和市场，另有 [可验证 Skill 目录与安装工作](https://github.com/deepseek-ai/deepseek-harness/discussions/1360)。因此不能把单纯再做一个 Skill 列表当作明显空白。

可比较的候选场景包括资料检索与来源整理、仓库诊断、语音转录；具体选择需访谈或实际使用反馈。本轮不将其确定为首发。交付重点是把所需 Skill、MCP 或执行插件配好，并让用户取得可验证的结果；作者已有同类包时优先评估贡献或补齐缺口。

### D：可运行示例与作者工具

社区 [#5336](https://github.com/deepseek-ai/deepseek-harness/discussions/5336)指出官方 MCP 示例的环境变量键与指定 GitHub MCP 包不匹配，发帖者已有修正分支。不能把其现成修正重新包装成我们的独立发现。它说明示例与实际依赖版本一起验证具有价值；建议补充可重复验证或其他有证据的缺口。

社区 [#4586](https://github.com/deepseek-ai/deepseek-harness/discussions/4586)已提出作者 Skill 与预检工具，尚不能把提案用语当作官方认可或完整交付。可贡献特定插件示例、兼容说明和失败对照，并区分“配置可解析”“插件可加载”“功能已通过”三个层次。

社区 [#4756](https://github.com/deepseek-ai/deepseek-harness/discussions/4756)也有远程 Web 使用情境的故障与指南线索，但已有多条回复和相关手册，应先核实解决状态和复用机会；本轮不宣称该问题仍未修复。

## 4. 乙方建议与不优先的方向

如果目标仍是交付一个自己负责的产品，优先评估 A，再比较 C：前者可围绕连接可用性形成明确界面与流程，后者围绕一项任务直接体现价值。两者都先用一个服务或场景证明效果，不设未经测算的工期。

如果目标是尽快产生可核验的生态贡献，优先 B 或 D：第一份交付物可以是复现、用例或可运行示例，是否有用更容易由结果判断；后续是否发展成产品另行决定。

当前不优先重做模型设置页、纯 Skill 商店或完整新客户端：官方 [模型设置包](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-settings-models/README.md)已有账户、模型配置和端点模型获取，社区亦有 Skill 管理产品。新做仍可能有价值，但需先找出明确差异，不能以“官方没做”作为依据。

## 5. 下一步与证据限制

选择方向前，乙方需补齐候选的当前版本实测、已有方案对比、单一交付场景和验收清单，再给出投入区间。社区讨论代表发帖者及参与者陈述，代码局部核查只证明读到的实现；二者均不替代运行结果或完整市场研究。

本轮没有联系维护者、发布讨论、提交代码、创建新任务或开始构建备选产品。路线比较是甲方追加要求的评估材料，不构成转向决定。
