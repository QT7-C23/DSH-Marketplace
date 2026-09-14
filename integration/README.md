# DSH 内的扩展市场

本机开发插件已提供发现、类型/用途筛选、详情、作者文档、本机收藏、个人评分、GitHub 投稿文件与三语设置。Prompt 能追加真实 DSH 草稿；已加入原生 bundle 和标准组件的安装预览、官方 CLI 执行及卸载；Skill 加载、MCP 连接等仍需分别接入。

卡片展示版本、许可、来源和使用方式；详情增加按类型区分的步骤、资源信息和真实宿主/预设状态。已配置不等于已加载，也不保证当前会话可用。下列命令属于本地开发挂载，不是商城的正式官方安装流程；独立包与官方 CLI 接入见 [官方安装方案](../docs/OFFICIAL_PLUGIN_INSTALLATION.md)。

## 安装与验证

在根目录使用 Node.js 24+：

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
npm run verify
```

实测 Windows + Microsoft Edge；宿主固定 DSH 0.1.5-rc.2。统一验证包含类型、构建和真实宿主浏览器测试，生成独立 `artifacts/dsh-integration/verify-*/`，结束后停止本次宿主。网络来源与下载验收需要联网。

## 本机体验

独立安装者无需源码挂载：`npm run package` 生成 TGZ，再由官方 CLI 安装。支持范围与命令见 [商城安装包](../docs/PACKAGE_INSTALLATION.md)。`npm run verify:package` 验证实际安装、页面及卸载；以下保留源码开发方式，不要在同一 profile 同时使用两种方式。

```powershell
node integration/build.mjs
node integration/host.mjs web --dump-config
node integration/set-plugin.mjs on
node integration/host.mjs web --port 4180 --no-open
```

打开 `artifacts/dsh-integration/runtime/url.txt` 内的本机认证地址；不要提交或分享此文件。初始提示选择“继续”“稍后配置”，无需模型密钥。侧栏“扩展市场”打开插件。

- **发现**：六类资源、用途筛选、原作者和独立指标。详情有概况与作者文档，长 README 可直接阅读；缺失和读取失败明确区分。
- **文档翻译**：优先当前语言的 README，没有再用英文。翻译时选择 DSH 中已配置的服务商和模型，点击明确标注 Token 消耗的按钮；普通浏览无需密钥，实际翻译需要可用模型配置。译文与原文可切换，显示服务商报告用量，不自动翻译或重试。
- **我的资源**：收藏副本、个人评分、草稿、可用更新与已安装扩展。安装需 PATH 中存在 pnpm；填写固定版本后预览、确认，成功后重启 DSH。标准组件先安装并加载适配器；详见 [扩展管理](../docs/EXTENSION_MANAGEMENT.md)。
- **分享资源**：六类都填作者、来源、许可与原文语言，导出文件后前往 GitHub 提交。Prompt 通过 PR，其他类型可附在资源提交 Issue；导出不自动上传。
- **设置**：中文、英文、日文即时切换；Anthropic Skill 自动检查可以暂停、恢复或手动更新。其他来源仍更新指定条目。
- **GitHub 连接**：在设置中输入令牌并“保存并验证”，查看额度或移除本机令牌。Windows 当前账户加密保存到 `artifacts/private/github-token.dpapi`，不会回传令牌或写入浏览器存储；开发与验收共用该文件。仅 GitHub API 的读取请求携带认证，详见 [连接说明](../docs/GITHUB_CONNECTION.md)。

若要使用 Prompt，添加 `artifacts/dsh-integration/runtime/workspace` 工作区并创建会话，选择 Prompt 后预览、追加；不会发送任务。引用对象与附件会保留，草稿变化后必须重新预览。

`node integration/set-plugin.mjs off` 停用、`on` 启用，之后刷新页面；Ctrl+C 停止宿主。仅修改实验 profile 的配置，不覆盖无法识别的既有配置。

## 存储与能力边界

市场不再提供注册、登录、账户发布或同步。宿主自身认证仍有效。旧数据库的账户和私有表保留，但不读取、不公开；现有本机收藏和草稿继续可用。

`dsh-market-local-v1` 保存浏览器收藏、草稿署名、个人评分及界面语言。清理站点数据会删除它们；改变端口会切换存储范围。其他标签页改写时拒绝覆盖。SQLite 仅负责公开目录下载次数及请求去重，不是全网热度后台。仓库 Star 来自整个 GitHub 仓库；个人评分不作社区均分。

当前真实资源共 30 条：4 插件、12 Skill、3 MCP、3 Slash、8 Prompt，另有 2 个示例。自动发现只接通 Anthropic Skill：扫描 19 项，收录 12 项，设置可见跳过原因。运行时缓存、暂停状态与修订历史在 `DSH_HOME/community/sources/`；正常 6 小时检查、失败 30 分钟重试，停用时停止调度。

源码界限见 [架构](../docs/ARCHITECTURE.md)，发现/下载条件见 [来源](../sources/README.md)。实验 profile 不等于操作系统沙箱；跨宿主兼容、完整资源连接、自动恢复和独立发布仍待实现。统一验证新增官方安装与原生/标准混合运行实验，证据位于 `artifacts/dsh-integration/compatibility-*/`。
