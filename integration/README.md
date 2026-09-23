# DSH 内的扩展市场

本目录提供实际 DSH 插件、React 界面、源码启动器、独立 TGZ 构建和宿主验收。插件接入六个来源，覆盖插件、Skill、MCP、Slash、Prompt、主题的发现及各自管理流程；原型页面位于仓库的 `prototype/`，不是当前产品入口。

更新：2026-09-24。版本 `v0.2.0-alpha.1`。官方安装包及真实宿主验收已有本地记录，标准组件完成五次独立启动测试，包括准备后卸载市场；完整发布结果见仓库交付记录及 GitHub Actions。

## 环境与开发启动

使用 Node.js 24+、npm、可用的 pnpm、网络和 Windows Microsoft Edge。固定宿主为 DSH `0.1.5-rc.2`；可选标准组件依赖 `@dsh-std/adapter-dsh@0.1.1-rc.3`，不是安装市场后自动安装的依赖。其他系统与宿主版本未完成同等验收。

从仓库根目录执行：

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
node integration/build.mjs
node integration/host.mjs web --dump-config
node integration/set-plugin.mjs on
node integration/host.mjs web --port 4180 --no-open
```

打开 `artifacts/dsh-integration/runtime/url.txt` 内的私有认证地址，选择“继续”“稍后配置”，从侧栏进入“扩展市场”。设置可切换中文、英文、日文；浏览无需模型配置。添加 `artifacts/dsh-integration/runtime/workspace` 并创建会话后，即可使用 Prompt 和当前会话支持的 Slash。

用 `Ctrl+C` 停止宿主。源码挂载由 `node integration/set-plugin.mjs off`／`on` 控制，之后刷新页面；脚本只修改可识别的开发 profile 配置。它与市场内的资源启停不是同一操作。开发环境隔离配置与数据，不提供操作系统沙箱。

## 独立安装

安装者可以只使用 TGZ 与受支持的 DSH，无需源码挂载。安装依赖后运行 `npm run package`；候选文件计划为 `artifacts/releases/dsh-market-integration-0.2.0-alpha.1.tgz`，以构建结果为准。按 [安装包指南](../docs/PACKAGE_INSTALLATION.md) 使用官方 CLI。同一 profile 不要同时挂载源码版和 TGZ 版。

包内后台与源码版共用业务模块。宿主版本、CLI 和用户目录从真正运行的 DSH 解析；包导出 `dsh-market-integration/standard-loader`，开发使用本地 Loader 路径。不得把开发依赖副本当作真实宿主。

## 实际工作流

- **发现资源**：搜索、类型／用途筛选、分批渲染、作者文档和不同口径的指标。六源完整扫描观测为 35,017 条合并资源；这是 2026-09-14 的快照。当前源码起始快照为 4,907 条来源记录，尚未跨来源去重；发行 MCP 上限为 100 条，并不保证当前起始快照达到上限。最终包内容待确认，运行时分页不受该上限限制。
- **Prompt 与 Slash**：Prompt 先预览再追加，保留文本、引用、附件且不发送。Slash 直接调用当前会话的公开命令接口，不借输入框拼装；`/plan`、`/plan off` 已实测保留草稿与引用。切换会话或草稿发生变化后重新确认适用动作。
- **Skill**：固定提交的完整文件可安装到原生 Skill 目录，核对原始 hash、模式、大小和许可。原生加载／调用，以及启停、更新、保留文件的移除和恢复已接入。文件状态与提供者加载状态分别判断；已有会话中的旧内容不会因移除而被抹去。
- **MCP**：查看完整定义，选择公共 HTTPS Streamable HTTP 或固定 npm stdio，填写参数并连接。已配置连接支持启停与移除。工具列表来自宿主注册信息，不表示持续健康；更换版本或配置须移除旧连接后重新明确连接，不自动迁移凭据。
- **扩展与主题**：精确 npm 版本经预览、兼容检查后由官方 CLI 安装／更新／卸载，原生入口通过 profile 配置启停。标准组件按下节的冷启动边界管理。三个主题的实际问题见 [兼容与主题](../docs/COMPATIBILITY_AND_THEMES.md)。
- **分享资源**：通用导出只生成提案；维护者补齐类型绑定，经目录构建、门禁、PR 审核和合并后同步。格式与作者退出流程见 [目录指南](../catalog/README.md)。

## 标准组件的启动边界

首次接管将原自动发现切换为一个市场管理的 Loader，可能重载全部标准组件，执行前必须呈现这一提示。公开 SDK 无法证明旧发现批次的清理完全成功，因此**首次接管后的同一进程始终按 unknown／restart-required 处理，并阻止下一次标准组件启停**；替换适配器显示 active 也不能解除限制。

完整停止并重新启动 DSH 后，正常启动的稳定 Loader 才可接受后续启停意图。后续操作仅持久化下次启动的完整启用集合，当前活动批次保持不变；重启并刷新浏览器后再判断实际效果。依赖失败、核心变化、显式释放或失败／加载中的生命周期仍可能触发重新初始化；不承诺绝对不重载、模块缓存热替换或自动清理恢复。详细机制见 [扩展管理](../docs/EXTENSION_MANAGEMENT.md)。

## 来源、存储与凭据

自动发现来源每六小时检查一次，失败三十分钟后重试，支持暂停、恢复和手动同步；固定 DSH 来源只更新基线条目。完整分页失败拒绝整次来源扫描，保留上次缓存；停用市场时取消在途读取。状态与历史保存在 `DSH_HOME/community/sources/`。社区索引以 `main` 的固定提交读取，移除策略按稳定身份跨别名生效，失败与重启不会丢失最后成功策略。

浏览器 `dsh-market-local-v1` 保存收藏副本、个人评分、署名草稿和语言；清理站点数据会删除它们，端口变化影响存储范围。SQLite 本机下载量只统计成功准备文件的去重请求；GitHub Star 属于整个仓库，npm 下载量属于整个包并附返回日期范围。未知不是零，个人指标不是公共总数。

“操作历史”提供最近 20 条经过筛选的 profile 操作元数据和阻塞编号，不公开日志、配置或秘密值；“移除记录”展示已知公开退出决定。恢复需人工检查日志、备份、现状并确认进程停止，没有自动解锁。

“设置 → GitHub 连接”可保存读取令牌：Windows 当前账户 DPAPI 加密，开发与正常联网验收使用 `artifacts/private/github-token.dpapi`，独立包默认使用宿主 `community/private/`。仅官方 GitHub API GET 带认证；不会回传或写入浏览器存储，详见 [GitHub 连接](../docs/GITHUB_CONNECTION.md)。

README 优先界面语言，再回退英文。翻译只在选择 DSH 模型并点击明确的 Token 消耗按钮后开始；可能计费，失败／取消也可能产生用量。单次最多 24,000 字符，不自动拆分或重试。宿主认证仍有效，市场不另建账户。

## 验证与证据

统一入口是 `npm run verify`，包括静态／目录规则、行为、类型、构建和隔离宿主验收。`npm run verify:package` 检查实际 TGZ 的官方安装、单一入口、页面／API、卸载及保留数据。正常完整验证可能访问 GitHub、npm、MCP Registry，不使用付费模型凭据；翻译通过测试适配器核查管线。

CI 和 pre-commit 复用同一入口，见 [贡献指南](../CONTRIBUTING.md)。在线 CI 尚未运行，hook 启用需 `git config core.hooksPath .githooks`。标准组件在 0.2.0-alpha.1 包中通过五次独立启动与浏览器验收。

证据保存在忽略的 `artifacts/dsh-integration/`、`artifacts/discovery/`；不要公开凭据、数据库、认证地址或原始私有配置。[架构](../docs/ARCHITECTURE.md) · [来源](../sources/README.md) · [许可与第三方声明](../THIRD_PARTY_NOTICES.md)

标准组件卸载边界与上游 CommandRuntime 组合限制见 [安装说明](../docs/PACKAGE_INSTALLATION.md)。
