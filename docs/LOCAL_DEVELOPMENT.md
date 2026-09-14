# 本机开发与功能说明

在 DSH 内发现、分享和管理插件、Skill、MCP、Slash、Prompt。入口为带独立图标的“扩展市场”，保留推荐横幅。当前收录 23 条真实来源资源：4 个插件、5 个 Skill、3 个 MCP、3 条关联 Slash、8 份 GitHub 用户 Prompt；另外保留 2 条明确标注的使用示例或来源样本。Prompt 可返回当前 DSH 会话，预览并追加草稿。原有本机账户、版本、反馈和保存副本继续可用。

这是可运行的本机开发版本，尚未部署公共社区。已接入三类来源的目录更新、完整 Skill ZIP、插件发布包下载及 MCP 服务定义导出；实际安装、加载、连接和 Slash 执行仍待接入。

## 启动与验证

需要 Node.js 24+、npm。Windows 浏览器测试使用已安装的 Microsoft Edge；其他系统先运行 `npx playwright install chromium`，宿主实验目前仅验证 Windows。首次安装以及真实来源的下载、更新验收需要网络；上游失败会明确报错。

在本目录运行：

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
npm run verify
```

进入真实 DSH 的完整启动步骤见 [宿主体验说明](../integration/README.md)。`npm start` 则打开保留的 [独立产品原型](http://127.0.0.1:4173)，用于对照早期交互设计；它的身份切换和安装结果仍是演示。

| 命令 | 用途 |
|---|---|
| `npm run verify` | 静态门禁、原型、社区数据库与账户、会话适配器、类型检查、插件构建及真实 DSH 浏览器验收 |
| `npm test` | 独立原型的状态逻辑与 HTTP 边界测试 |
| `npm run test:browser` | 独立原型的浏览器交互、持久化、键盘和响应式测试 |
| `node --test community/community.test.mjs` | 真实 SQLite 的账户、作者权限、版本与 HTTP 边界测试 |
| `node sources/update.mjs` | 维护者更新随包提供的三类来源目录；成功后运行统一验证 |
| `npm run tokens` | 修改 `prototype/tokens.json` 后重新生成 CSS |

原型直接使用浏览器 ES modules；宿主插件由 esbuild 构建。完整验证自动创建独立宿主数据目录并在结束后关闭本次宿主，截图与数据留在忽略目录 `artifacts/`。`DSH` 仍在父级 Git 仓库中；父仓库 CI 和 Git hooks 尚未接线，后续须调用同一 `npm run verify`。

## 建议体验顺序

以下流程在真实 DSH 中体验：

1. 添加实验工作区并创建会话，从侧栏打开“扩展市场”，查看代码审查等用户作品，选择“在当前会话使用”，预览并追加；随后可补充任务材料。已有文字、文件引用和附件保留，不自动发送。周报仅作填参使用示例。
2. 下载公开资料、本机收藏与草稿无需市场账户。新 Prompt 在“分享资源”中预览，补充 GitHub 作者与许可，导出投稿文件，再通过 GitHub PR 收录。投稿仓库已确定为 QT7-C23/DSH-Marketplace；首批文件尚未上传，应用内投稿入口尚未配置。格式与流程见 [GitHub 目录说明](../catalog/README.md)。
3. “我的资源”区分本机收藏与账户收藏。旧账户数据保留；选择“同步这一版到账户”才上传收藏并计入公开人数。评分和反馈需要身份。
4. 作者在“我的资源 → 我的发布”发布新版；读者在“可用更新”分别更新本机或账户版本。作者撤回后，发现页隐藏资源，已保存的副本保留。
5. 在“来源设置”分别更新 DSH、Anthropic Skills、MCP 目录，查看条目数和最近成功时间。下载完整 Skill、插件包或 MCP 定义；Slash 详情可转到所属插件。失败保留旧目录，目录更新不会覆盖收藏版本。

## 哪些操作真实生效

| 范围 | 当前行为 |
|---|---|
| 社区账户与内容 | 服务端 SQLite 持久化；作者权限由登录会话确定；私有草稿按账户隔离 |
| 发布与维护 | 五类文本资料投稿、版本、反馈、保存与移除副本、作者撤回；不是安装包托管 |
| Prompt 使用 | 社区资源选择 → 当前 DSH 会话 → 填参 → 预览 → 追加草稿；发送由用户决定 |
| 中断与冲突 | 响应丢失后重试不重复投稿；作者或版本发生变化时拒绝过期操作；失败保留表单 |
| 市场统计 | 本机服务的账户收藏人数、下载次数、评分均值与人数；23 条目录资源均接入。所有卡片保留指标行，未知显示状态；来源仓库 Star 单独读取并缓存 |
| 下载资源 | Prompt Markdown、完整 Skill ZIP、经 npm 完整性校验的插件 TGZ、发布者原始 MCP 定义；也可单独导出说明。按成功准备文件的有效请求累计，重试去重；不是安装量 |
| 其他四类 | 支持发现、资料维护和获取；安装、Skill 加载、MCP 连接、Slash 执行未接入 |
| GitHub Prompt | 8 份贡献者作品，保留固定来源、原文、许可和校验值；支持收藏、评分、计数下载及草稿使用，新投稿文件走 GitHub；内容由维护者更新 |
| 外部目录 | DSH 官方包、Anthropic Skills、MCP 官方 Registry 三个适配器；按来源更新固定选集、去重、记录版本，失败保留上次结果。尚不支持任意来源或全站收录 |

文本导入支持 100 KiB 以内的 UTF-8 `.txt`、`.md`、`.json`，JSON 可提供 `title`、`summary`、`body`、`url`、`version`；提交还受字段长度和 110,000 字节请求上限约束。社区账户只控制社区资料，不为同一 DSH 的工作区建立多用户权限隔离。当前没有公开托管、账户找回、审核后台或生产运维保障。

真实社区数据库位于实验 `DSH_HOME/community/community.sqlite`。宿主本机收藏和新投稿草稿使用浏览器 `localStorage` 键 `dsh-market-local-v1`，按站点地址（含端口）保存，清理站点数据会丢失；退出社区账户不会删除本机内容。账户草稿与账户收藏仍在数据库中，登录后单独读取。独立原型使用另一个键 `dsh-community-prototype-v1`，数据互不迁移。宿主运行资料包含登录信息，整个 `artifacts/` 不应提交或分享。

运行时来源目录及版本历史位于 `DSH_HOME/community/sources/catalog-cache.json`，初次启动使用随包目录。目录缓存不包含已下载的 ZIP/TGZ；获取发布包仍需要可用的上游网络。来源和许可说明见 [来源接入](../sources/README.md)。

## 文件与评审入口

- `prototype/`：页面、组件、状态转换、样本与设计变量。
- `server/`：本机静态服务和固定来源适配器。
- `community/`：账户、共享资源合同、SQLite 服务、HTTP 请求边界及测试。
- `tests/`、`scripts/`：行为测试与统一验证；`artifacts/`、`node_modules/` 不纳入 Git。
- `integration/`：版本固定的 DSH 包、React 市场、启动脚本与实际宿主测试。
- `catalog/`：GitHub Prompt 文件、许可与署名、投稿格式和索引校验。
- `sources/`：外部目录适配、版本缓存、完整包下载、许可及边界测试。
- [产品策划案](PRODUCT_PLAN.md)、[首版流程](FIRST_RELEASE_FLOWS.md)、[架构与数据边界](ARCHITECTURE.md)、[本轮验收](research/2026-09-13-github-prompts-and-market-identity.md)。

统一验证包含 64 项测试，其中 11 项驱动真实 DSH；另有目录校验、类型检查、插件构建和独立原型的 26 组颜色对比度检查。最新范围见 [更多来源接入](research/2026-09-13-more-sources.md)，此前统计见 [下载、收藏和 Star](research/2026-09-13-market-metrics.md)。宿主市场采用 DSH 主题变量与精选横幅，检查深浅主题、正文随宿主字号调整、390px 重排、对话框焦点及样式隔离。宿主忙碌状态、跨版本、刷新时完整附件恢复与完整无障碍认证仍未验证。
