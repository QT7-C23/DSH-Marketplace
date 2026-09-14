# GitHub Prompt 目录

此目录收录社区作者的 Prompt。应用负责发现、预览、下载与使用；投稿仓库已确定为 [QT7-C23/DSH-Marketplace](https://github.com/QT7-C23/DSH-Marketplace)，通过文件与 Pull Request 贡献。应用可导出投稿文件并打开项目的资源提交表单；本轮本地更改尚未推送。导出文件不会自动上传或发布。

## 投稿

1. 在扩展市场的“分享资源”中填写 Prompt，保存本机草稿并预览。
2. 在表单中填写资源编号、原作者 GitHub 用户名、作品许可和原文语言，导出投稿 JSON。此操作只下载文件，没有公开发布。
3. Fork 仓库，将文件放入 `catalog/prompts/<id>.json`，发起 PR；也可通过 GitHub 网页上传。
4. 维护者核对署名与授权、用途、完整内容、重复资源和效果说明。通过校验并合并后，随目录更新收录；当前不是在线实时同步。

插件、Skill、MCP、Slash、主题也能在应用中填写署名并导出 JSON；将文件附到资源提交 Issue，同时说明兼容性。主题文件不放入 `catalog/prompts/`，主题插件与配色文件分别说明依赖和生效方式，见 [资源兼容与主题支持](../docs/COMPATIBILITY_AND_THEMES.md)。署名用于保留作者信息，不是身份核验。

最小格式见 [投稿模板](PROMPT_TEMPLATE.json)。`id` 使用小写字母、数字和短横线，文件名须与 id 一致。每份作品保留独立文件；更新已有作品须说明改动与版本。第三方作品附原始地址及许可依据，不把转载者写成原作者。

提交说明遵循 [贡献指南](../CONTRIBUTING.md)，PR 使用统一模板。仅推荐来源、尚未准备投稿文件时，可填写 [资源推荐表](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=03-resource-submission.yml)；Issue 不会自动转成目录文件或公开发布。

Prompt 按本项目的提示词审核要求处理，不套用外部插件目录的 manifest、仓库年龄或代码要求。原创 Prompt 可直接贡献到此目录，无需另建作品仓库；第三方作品仍须保留原文出处和许可。提供输入与变量示例；若展示模型结果，注明模型和测试条件，不将某次结果当作普遍效果保证。

## 校验与构建

在项目根目录运行 `node catalog/build.mjs` 生成索引，然后执行 `npm run verify`。统一门禁检查格式、文件名、许可字段、固定来源、正文 SHA-256 和生成索引是否一致。不要直接编辑生成的 `catalog/index.json`。

原始第三方正文在 `body` 内保持不变。中文标题和简介属于本项目的导览说明；翻译或改写另作明确适配，不能沿用原文校验值。人工评审仍需判断作品权限、适用性和输出质量，不能把通过格式校验视为效果认证。

## 当前精选来源

8 份作品来自 [f/prompts.chat 固定版本](https://github.com/f/prompts.chat/blob/eaab6b14a085f3b9e4461be90367fcd9a16d3204/prompts.csv)。源仓库将 Prompt 数据以 [CC0-1.0](https://github.com/f/prompts.chat/blob/eaab6b14a085f3b9e4461be90367fcd9a16d3204/LICENSE) 提供，本目录附该许可文本。

| 作品 | 原作者 |
|---|---|
| Code Reviewer | rajudandigam |
| Commit Message Generator | mehmetalicayhan |
| Socratic Method | devisasari |
| English Translator and Improver | f |
| UX/UI Developer | devisasari |
| Tech Writer | lucagonzalez |
| Software Quality Assurance Tester | iuzn |
| Product Manager | orinachum |

精选依据是任务清楚、用途不同且能保留原作者信息；尚未进行模型输出质量比较。GitHub 精选支持本机收藏、个人评分、服务端计数下载和真实会话使用；市场已取消登录。统计属于本机市场；来源仓库 Star 单列，不代表某一条 Prompt 的关注度。原周报仅作为使用示例保留。

项目自有代码采用 MIT，Prompt 按每份作品的 `license` 字段授权，不因收录而更换许可。完整权利与署名说明见 [第三方版权清单](../THIRD_PARTY_NOTICES.md) 和 [免责声明](../DISCLAIMER.md)。
