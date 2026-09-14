# 外部来源接入

市场在 DSH 内查询目录、读取文档并下载资源。自动发现以受支持的来源适配器为边界，不接受任意抓取地址。

| 来源 | 当前覆盖 | 更新方式 |
|---|---|---|
| DSH 官方 npm | 4 个插件，关联 /plan、/compact、/goal；固定 0.1.5-rc.2 | 更新指定包与命令 |
| Anthropic Skills | 扫描实际顶层 Skill 目录，当前 19 项中收录 12 项 | 宿主运行期间每 6 小时自动检查，可暂停和手动刷新 |
| MCP 官方 Registry | Context7、GitHub MCP、Microsoft Learn | 更新指定发布者的最新活动定义 |
| GitHub Prompt | 8 份保留作者署名的作品 | 维护者审核并更新随包目录 |

这轮新增 7 个 Skill，不需要把它们的名称加入发现白名单。`definitions.mjs` 中的 Skill 名称仅用于展示翻译。自动发现其他来源、GitHub 搜索新仓库和用户自定义来源仍待实现；完整产品范围包括插件、Skill、MCP、Slash、Prompt、主题。主题分类和投稿已加入，但没有已审核主题条目或主题发现适配器，不会把通用 Skill 的 theme-factory 自动归为 DSH 主题。版本和主题边界见 [资源兼容与主题支持](../docs/COMPATIBILITY_AND_THEMES.md)。

## 更新与失败处理

设置页显示扫描、收录和跳过数量、原因、最近成功时间及自动检查状态。失败保留旧目录，30 分钟后重试；暂停只阻止后续检查，当前请求允许完成。首次使用随包目录，运行时缓存保存在 `DSH_HOME/community/sources/catalog-cache.json`；损坏缓存不覆盖。

内容与文件变化才增加 Skill 修订号，仓库无关提交不制造更新。收藏保持原版，需要明确选择替换。核实移除请求后，在 `removals.json` 记录 ID、理由和 Issue；后续发现与随包更新均排除该资源。

维护者运行 `node sources/update.mjs` 更新随包目录，再执行 `npm run verify`；不要直接修改生成目录。`node sources/check.mjs` 可离线验证发现报告、正文散列和 Slash 父插件关系。

## 收录与下载条件

社区审核以本项目 [贡献指南](../CONTRIBUTING.md) 为准，外部目录提供候选来源与参考经验，其收录决定不等于本项目审核结果。下面的限制是当前适配器的技术支持范围，不作为所有资源的统一质量标准；不符合当前适配器的资源可先通过 Issue 提议，不会绕过现有校验直接进入目录。

当前 Skill 适配器检查 SKILL.md 元数据、完整目录及已核验的 Apache-2.0 许可文本。许可散列白名单只标识许可文本，不限定资源名称。19 项中的跳过原因：canvas-design 超过目录大小限制；claude-api 正文超过当前 50,000 字符限制；doc-coauthoring 缺少目录内许可；docx、pdf、pptx、xlsx 的许可尚不满足本轮收录条件。

最多扫描 100 个 Skill；每个目录最多 150 文件，单文件 1 MiB、合计 4 MiB，正文最多 50,000 字符。拒绝路径穿越、符号链接、子模块和不完整树。网络或完整性错误使整次更新失败，不发布半份目录。阈值是当前实现限制，不是资源质量判断。

Skill ZIP 保留原始文件及许可，逐文件校验 Git blob SHA-1 和长度，并带 SOURCE.json。插件 TGZ 校验官方 npm SHA-512 SRI。MCP 导出发布者服务定义，Slash 指向所属插件；均不自动安装、加载、连接或执行。

## 作者文档

详情的“概况”是简要导览，“作者文档”保留来源原文。Skill 展示固定提交的 SKILL.md，若有 README 也列出；插件读取自身目录 README；Slash 展示所属插件文档。MCP 若只能定位仓库当前文档，会注明可能与所选版本不同。缺少 README 不使用生成内容替代；网络失败提供重试。

README 按需读取，按资源版本缓存 6 小时，包含原文链接及提交。动态读取的文档保留原作者权利，不成为项目原创文件。展示 Markdown 时不执行 HTML、脚本或加载远程图片。

文档默认优先匹配界面语言，再回退英文；识别 README.zh.md、README.zh-CN.md、README_CN.md 等命名，三份上限不会挤掉中英日首选文件。用户可通过 DSH 已配置模型主动翻译，明确确认消耗该模型 Token 额度。译文独立显示，不写回原资源；详细调用及用量边界见 [架构](../docs/ARCHITECTURE.md)。

网络请求访问 GitHub API、原文服务、npm 和 MCP Registry，禁止重定向，单次响应最多 4 MiB。默认匿名；配置本机加密令牌后，仅 GitHub API 的 GET 请求携带认证，详见 [GitHub 连接](../docs/GITHUB_CONNECTION.md)。缓存不包含离线安装包。许可和版权见 [第三方清单](../THIRD_PARTY_NOTICES.md)；Prompt 投稿见 [目录说明](../catalog/README.md)。
