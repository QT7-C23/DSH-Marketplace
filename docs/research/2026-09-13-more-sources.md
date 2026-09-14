# 五类资源扩充与来源更新

日期：2026-09-13。需求：继续接入更多资源，保留下载、收藏、评分和仓库 Star。范围仍为插件、Skill、MCP、Slash、Prompt，模型与 Cookbook 暂缓。

## 当前目录

| 类别 | 正式条目 | 代表资源与获取方式 |
|---|---:|---|
| 插件 | 4 | DSH 规划模式、对话压缩、目标管理、MCP 客户端；下载 npm 原始 TGZ |
| Skill | 5 | 内部沟通、前端设计、网页测试、MCP 开发、Skill 编写；下载完整 ZIP |
| MCP | 3 | Context7、GitHub、Microsoft Learn；导出发布者服务定义 |
| Slash | 3 | `/plan`、`/compact`、`/goal`；追溯并打开所属插件 |
| Prompt | 8 | 保留前三份，新增英文润色、UX/UI、技术写作、软件测试、产品需求作品 |

正式目录共 23 条，本轮新增 20 条。周报和 Filesystem MCP 两条样本继续明确标注；旧规划插件、规划命令、内部沟通样本在真实条目出现后隐藏，原型与既有收藏副本保留。

## 来源与固定版本

- [DSH 官方仓库](https://github.com/deepseek-ai/deepseek-harness/tree/c291e7961a515f6d7af9304e7fd1d257929aef26)：四个 npm 包固定为 `0.1.5-rc.2`，与当前宿主一致。读取发布元数据并校验 tarball 地址和 SHA-512 SRI；Slash 属于对应包，不是独立安装包。
- [Anthropic Skills](https://github.com/anthropics/skills/tree/34040c9c568585f6929bedeaad110ad08f079624/skills)：固定提交 `34040c9c568585f6929bedeaad110ad08f079624`。五个目录分别有 6、2、6、10、18 个文件；保留原始许可与全部配套文件，每个文件核对 Git blob SHA-1 和大小，ZIP 附来源清单。所选目录各附 Apache-2.0 许可，随包正文另附许可副本。
- [MCP 官方 Registry](https://registry.modelcontextprotocol.io/docs)：按完整发布者名称查询最新活动版本，保留原始服务定义。首次读取 Context7 `4.1.0`、GitHub MCP `1.12.1`、Microsoft Learn `1.0.0`；后续刷新可能变化，固定记录 URL 保存在条目中。注册条目不代表已连接或已验证全部工具。
- [Prompt 原始数据](https://github.com/f/prompts.chat/blob/eaab6b14a085f3b9e4461be90367fcd9a16d3204/prompts.csv)：8 份正文保持原文和独立作者，CC0-1.0；中文简介为本项目导览，未进行模型效果比较。具体名单见 [目录说明](../../catalog/README.md)。

来源目录由维护脚本真实获取，初始检查时间保存在 `sources/catalog.json`。运行时按来源刷新固定选集；不是全站抓取，也未接入任意自定义来源。

## 用户流程与边界

来源设置显示条目数、状态和最近成功时间，分别更新三个来源。目录失败保留旧结果，内容变化记录新版；收藏副本不会自动替换。下载在文件准备且完整性校验成功后计数，同次重试去重；这不是安装成功数。账户收藏、评分和仓库 Star 复用已验证的统计边界。

实际宿主发现两个适配问题：前端把来源列表误判为异常对象；DSH 流式请求桥不能接收 GET。均先复现再修复，读取和更新改用独立路径。测试继续检查真实接口返回、页面来源区域和更新后的目录。

反复验证曾耗尽 GitHub 匿名 API 的 60 次配额，上游返回 403。目录查询与 Star 继续使用 API；Skill 文件按固定提交从 GitHub 原文服务获取并逐文件校验，避免把文件分发与查询共用 API 配额。没有加入私人凭据。来源查询限流时保留旧目录，Star 显示不可用或有时间的缓存，不填造数值。

## 验证与证据

统一命令为 `npm run verify`，覆盖 64 项测试（53 项模块/原型测试、11 项真实 DSH 浏览器验收），以及来源清单、Prompt 索引、类型、构建和原型颜色门禁。

新增验收覆盖：目录去重、同源并发、版本持久化、移除后重现、失败保留、路径与散列拒绝、npm 完整性、原始 MCP 定义、真实宿主下载、Slash 所属包跳转、来源更新失败与重试、统计计数。完整验证已通过，隔离证据目录为 `artifacts/dsh-integration/verify-bIGc0Z/`；53 项模块/原型测试及 11 项真实宿主测试全部通过。

首次实际获取留存于忽略目录 `artifacts/source-downloads/`：规划插件 TGZ 为 23,870 字节，SHA-256 `f82b2cde97a9e577b82e096dd401b4025793e4e1840add3fc591b10efcd0a29d`；内部沟通 ZIP 为 10,738 字节，SHA-256 `305bc4b957b3b7707fcb30ad25c49b655333e4e1e46cdff8e301c91076db62b3`。截图留在 `artifacts/dsh-integration/`。

文件分发路径调整后另行实际获取全部 4 个插件包与 5 个 Skill ZIP，全部通过完整性校验；逐包大小、SHA-256 和 ZIP 文件名单记录于 `artifacts/source-downloads/current/verification.json`。完整目录文件数均符合来源清单，ZIP 另增加一份 `SOURCE.json`。本机 4181 预览沿用原 profile，更新前用 SQLite 备份 API 留存快照，数据核对记录为 `artifacts/dsh-integration/debug-community/more-sources-upgrade-check.json`。

## 后续工作

插件安装与已有包识别、Skill 加载、MCP 配置和实际调用、Slash 执行仍未接入。GitHub 投稿接收仓库未指定；未对外发布。当前目录与统计运行于本机，缓存目录不提供离线安装包。下一阶段应完成获取后的实际使用与管理流程，并验证失败恢复。
