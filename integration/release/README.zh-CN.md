# DSH 扩展市场

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

在 DeepSeek Harness 内发现、使用和管理插件、Skill、MCP、Slash、Prompt 与主题。界面支持中文、英文、日文，无需市场账号。

**`v0.2.0-alpha.1`：早期预发布版本。** 实测基线为 Windows / Node.js 24 / DSH 0.1.5-rc.2。本地验收覆盖官方安装包、真实宿主界面与资源流程；标准组件管理另经五次独立启动验证，包括准备后卸载市场。安装包见 [Releases](https://github.com/QT7-C23/DSH-Marketplace/releases)，线上验证状态以 [Actions](https://github.com/QT7-C23/DSH-Marketplace/actions) 为准。未发布到 npm。

## 安装与打开

需要 Windows、Node.js 24+、PATH 中可用的 pnpm、用于获取运行依赖的 npm 网络，以及 DSH **0.1.5-rc.2**。停止目标宿主后使用官方 CLI：

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-market-integration-0.2.0-alpha.1.tgz" --ignore-scripts --registry=https://registry.npmjs.org
dsh web
```

替换为实际安装包路径／版本，以上文件名是候选目标。此包面向 `web` profile。从侧栏进入“扩展市场”，在“设置”选语言；同一 profile 不要重复挂载源码版。浏览无需模型密钥，DSH 自身访问认证仍有效。

## 资源流程

- 插件／主题使用精确 npm 版本，经预览和检查后由官方 CLI 安装、更新、卸载；原生入口支持 profile 启停。受保护依赖或不确定归属会阻止操作。
- Skill 原文件固定并校验后安装到 DSH 原生 Skill 服务，支持启停、更新、保留文件的移除与恢复。
- MCP 保留完整固定定义，支持公共 HTTPS Streamable HTTP 和固定 npm stdio 的连接、启停、移除。工具已注册不保证服务健康；重新配置或换版需先移除旧连接，再明确建立新连接，不自动迁移凭据。
- Slash 调用当前会话的父插件命令；真实 `/plan`、`/plan off` 已检查保留草稿／引用。Prompt 预览后追加，不发送，也不丢失附件。
- 主题实测有独立限制：Opera 0.2.1 有 1.04:1 对比度警告；Machine 0.1.3 启动受阻；Bloom 0.12.0 的 Mist 和键盘打开后的 Cinnabar 可用，但有鼠标打开失败和本机 404 轮询问题。

可选 dsh-std 组件由一个受管理的 Loader 发现。**首次接管可能重载全部标准组件，同一进程始终保持 unknown／restart-required，即使替换适配器 active 也阻止后续标准启停；必须完整停止并重新启动 DSH。** 正常启动的稳定会话中，后续切换只保存下次启动意图；重启后刷新浏览器。没有模块缓存热替换或自动恢复。

## 来源、数据与审核

六源包括 DSH 官方、Anthropic／OpenAI Skills、npm、MCP Registry 和本项目审核 GitHub 索引。2026-09-14 完整运行时扫描观测为 **35,017 条合并资源**，不是固定数量或可用性保证。当前源码起始快照为去重前 4,907 条来源记录；发行 MCP 最多 100 条，不保证实际含 100 条，最终包内容待检查；运行时 MCP 仍完整分页。自动发现六小时检查、失败三十分钟重试，可暂停、恢复和手动同步；扫描不完整保留旧缓存，停用时取消在途读取。

通用 JSON 只导出提案，维护者补齐类型绑定、构建／验证并合并到 `main` 后客户端才能同步。作者退出规则跨稳定身份与别名执行，失败／重启保留最后成功策略；详情提供申请入口，设置展示决定，个人副本保留。

GitHub Star 属于整个仓库，npm `last-month` 数值属于整个包并附日期／新鲜度。本机下载只统计去重后的成功准备文件请求，收藏／评分是个人浏览器数据。操作历史显示最近 20 条经过筛选的 profile 元数据；恢复仍需人工检查本机日志和备份，不自动解锁。

可选 GitHub 读取令牌由 Windows 加密保存在 `DSH_HOME/community/private/`，仅官方 GitHub API GET 携带。README 优先当前语言、其次英文；翻译须明确选择 DSH 模型，可能计费，失败／取消也可能消耗 Token，不自动翻译。

## 卸载与权利

停止 DSH，按下方说明完成适用的标准组件卸载准备后，执行 `dsh plugin --profile web remove dsh-market-integration` 并重启。保留 `DSH_HOME/community/` 和浏览器数据，不撤销 GitHub 令牌。已安装资源有各自的管理生命周期。

原创代码／文档采用 [MIT](https://github.com/QT7-C23/DSH-Marketplace/blob/main/LICENSE)，第三方内容与依赖保留自身许可，名称、标识和商标属于各自权利人。本项目独立维护，不表示 DeepSeek 官方隶属、赞助、背书或商标授权。软件**按现状提供，不附保证**。包内包含 `LICENSE`、`DISCLAIMER.md`、`THIRD_PARTY_NOTICES.md` 与打包依赖声明，见 [免责声明](https://github.com/QT7-C23/DSH-Marketplace/blob/main/DISCLAIMER.md)、[第三方清单](https://github.com/QT7-C23/DSH-Marketplace/blob/main/THIRD_PARTY_NOTICES.md)。

[使用与管理](https://github.com/QT7-C23/DSH-Marketplace/blob/main/docs/EXTENSION_MANAGEMENT.md) · [贡献](https://github.com/QT7-C23/DSH-Marketplace/blob/main/CONTRIBUTING.md) · [作者退出](https://github.com/QT7-C23/DSH-Marketplace/issues/new?template=04-resource-removal.yml)

## 标准组件兼容与卸载准备

固定的 dsh-std adapter 0.1.1-rc.3 存在上游限制：一个声明依赖 CommandRuntime 的组件加载后，后续组件可能在连接协商时启动失败。命令提供组件的验收不代表这种组合也兼容，使用前仍需验证实际组件集合。

市场曾管理标准组件时，卸载前必须先停止 DSH，再运行包内维护预览。下面的 DSH_HOME 须替换为实际绝对路径。准备步骤恢复上游自动发现，之前停用的标准组件可能重新加载；若不希望它们出现，先用官方 CLI 移除这些包。核对预览后重复命令并加 `--confirm <fingerprint>`；只有同意重新加载所列停用包时才加 `--enable-disabled`。结果为 `not-managed` 时无需确认。准备成功后再执行官方卸载命令。保留其他配置，并记录备份。

```powershell
node "<DSH_HOME>\profiles\web\node_modules\dsh-market-integration\integration\maintenance.mjs" prepare-uninstall --home "<DSH_HOME>" --profile web
```
