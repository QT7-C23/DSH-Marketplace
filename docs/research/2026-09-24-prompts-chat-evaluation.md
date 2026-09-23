# prompts.chat 来源接入评估

日期：2026-09-24。状态：已核查，尚未新增自动来源或 MCP 连接。当前预发布验收继续独立进行。

## 已核实的情况

- 当前 `catalog/prompts/` 的 8 个精选 Prompt 已来源于 `f/prompts.chat`，固定在提交 `eaab6b14a085f3b9e4461be90367fcd9a16d3204`。客户端同步的是本项目审核目录，不能称作对 prompts.chat 的持续自动发现。
- 本轮检查的上游提交为 `f78a1c5136fa080155d928e0d7e2b4a41ddef03e`。[许可声明](https://github.com/f/prompts.chat/blob/f78a1c5136fa080155d928e0d7e2b4a41ddef03e/LICENSE)区分网站代码及站方内容的 MIT 和 Prompt 数据的 CC0。接入后继续显示来源、作者及许可，不把第三方内容改标为本项目原创。
- 固定 `prompts.csv` 为 5,769,655 字节，Git blob 为 `3b985c0084fb28e1b9acace419ed34696ac63a92`；已下载并核对哈希。字段是 `act,prompt,for_devs,type,contributor`，缺少稳定条目 ID、分类、更新时间和投票数。文件超过现有来源读取器的 4 MiB 限制。
- 实测匿名 `GET https://prompts.chat/api/prompts?type=TEXT&perPage=1&page=1` 返回 200。响应含分页、正文、作者、分类、标签、更新时间和投票数；当次报告 TEXT 总量 1,751。只探测了一页，尚未完整扫描，数量不是持续承诺。
- [公开 API 实现](https://github.com/f/prompts.chat/blob/f78a1c5136fa080155d928e0d7e2b4a41ddef03e/src/app/api/prompts/route.ts)每页最多 100 条，排除私有、已撤下、已删除及部分流程中间节点。它不是全部数据库的导出接口，也没有提供跨页快照标识。
- [官方 MCP 实现](https://github.com/f/prompts.chat/blob/f78a1c5136fa080155d928e0d7e2b4a41ddef03e/src/pages/api/mcp.ts)使用 Streamable HTTP，并提供 `search_prompts`、`get_prompt`。本轮仅核查实现，尚未在 DSH 中配置或调用。其 Claude 插件不能据此宣称兼容 DSH。

## 建议的接入范围

1. 将公开 API 作为独立的 Prompt 自动来源，第一阶段只收录 TEXT。图片、视频、音频生成要求和 Skill 安装是不同能力，后续分别验证。
2. 按上游 ID 保存身份和更新时间，显示原作者、来源链接、分类、原文及外部投票日期。外部投票不混入本市场的个人评分，仓库 Star 不冒充单条 Prompt 的 Star。
3. 保持当前使用流程：预览原文，按需填写变量，由用户确认追加到 DSH 草稿，不自动发送。中文界面不擅自改写原文；翻译继续由用户选择模型并确认 Token 消耗。
4. 分页完整性、重复 ID、目录变化、失败保留旧缓存、暂停取消和撤下规则必须接入现有来源契约。只有完整扫描成功才替换目录；现有 8 个精选条目需通过来源映射或原文哈希避免重复和收藏丢失。
5. CSV 可用于可复现的审核快照；不能直接用缺少 ID 的 CSV 静默替代 API 目录。若采用大文件解析，必须单独限定大小、行数、字段长度和原文完整性，不统一放宽其他来源的读取限制。

## 接入验收

先验证完整匿名分页和更新／撤下行为，再测试中文分类、详情署名、模板变量、草稿及附件保留。另选真实 MCP 查询单独验收。当前包仍只有原有六个来源，不把上述调查计为已实现功能。
