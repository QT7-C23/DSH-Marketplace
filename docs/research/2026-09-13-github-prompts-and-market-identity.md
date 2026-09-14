# 扩展市场入口与 GitHub Prompt

日期：2026-09-13。甲方要求入口加 Logo、调整“社区资源”名称，Prompt 以其他用户的优秀作品为主，并留在 GitHub 上传；随后明确目前已看不到组件冲突。

## 本次实现

- 侧栏与页头统一为“扩展市场”，使用四格扩展 SVG 图标，支持宿主深浅主题。
- 精选横幅推荐 GitHub 用户的代码审查 Prompt；目录增加代码审查、提交信息生成、苏格拉底式提问三份真实作品。周报标记为使用示例，会话默认入口优先浏览精选。
- 保留原作者、英文原文、固定提交、许可与正文 SHA-256；本项目只编写中文导览和筛选理由。导出含作者、许可和来源，实际会话追加保留已有内容。
- 新 Prompt 导出逐作品 JSON，通过 GitHub 上传与 PR 收录；不触发市场注册，也不调用本机即时发布 API。已有本机账户记录及 API 保留兼容。
- `catalog/build.mjs` 校验来源、文件名与正文并生成索引，统一验证拒绝过期索引。目标仓库在 `catalog/settings.json` 中暂留空；未将内容上传到任何 GitHub 仓库。

## 来源与筛选

读取 [f/prompts.chat](https://github.com/f/prompts.chat) 后，将 CSV 固定到 [eaab6b14a085f3b9e4461be90367fcd9a16d3204](https://github.com/f/prompts.chat/blob/eaab6b14a085f3b9e4461be90367fcd9a16d3204/prompts.csv)。该版本的 [许可声明](https://github.com/f/prompts.chat/blob/eaab6b14a085f3b9e4461be90367fcd9a16d3204/LICENSE) 明确 Prompt 数据采用 CC0-1.0，许可全文随目录保留。

| 原条目 | CSV 中的贡献者 | 筛选理由 |
|---|---|---|
| Code Reviewer | rajudandigam | 要求解释反馈、建议与替代方案 |
| Commit Message Generator | mehmetalicayhan | 任务和输出格式明确 |
| Socratic Method | devisasari | 一次追问一个观点，使用方式清楚 |

这属于编辑筛选，不代表已测量模型输出质量、使用人数或市场受欢迎程度。提示词作为资源文本处理，未执行其内容。

## 验收与边界

统一命令为 `npm run verify`，包含 38 项原型/数据/适配器/目录测试和 9 项真实 DSH 浏览器测试。覆盖入口图标、精选原文与署名、文件导出、实际会话追加、旧账户数据与版本维护、深浅主题、窄屏、字号和样式不改变宿主控件。

本轮最终执行通过全部 47 项测试、目录一致性、静态检查、类型检查与构建。隔离宿主证据位于 `artifacts/dsh-integration/verify-NnUMgR/`；已查看 `artifacts/dsh-integration/host-market.png`，确认新版入口、精选横幅及作者资源卡片的实际布局。

组件冲突未复现，且甲方确认目前已消失；本轮没有声称定位并修复未知冲突。GitHub 投稿仓库仍待指定，网页上传、真实 PR、审核收录和在线目录同步尚未验收。精选作品暂不接入账户评分/收藏及服务端下载统计，不展示虚构热度。其他四类安装、加载、连接和执行仍待接入。
