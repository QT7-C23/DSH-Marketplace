# DSH 扩展市场

[English](README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja-JP.md)

在 DeepSeek Harness 内发现和管理插件、Skill、MCP、Slash、Prompt 与主题。当前为开发安装包，沿用内部包名 `dsh-market-integration`，尚未发布到 npm。

## 安装与打开

需要 Windows、Node.js 24+、PATH 中可用的 pnpm，以及 DSH **0.1.5-rc.2**。安装时仍需连接 npm 获取运行依赖。先停止目标 DSH，再使用官方 CLI：

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-market-integration-0.1.0.tgz" --ignore-scripts --registry=https://registry.npmjs.org
dsh web
```

替换为实际下载文件的路径。此包面向 `web` profile；启动后从侧栏进入“扩展市场”，在“设置”选择语言。同一环境不要再通过源码路径重复挂载本市场。

## 可用功能

六类资源浏览、作者文档、本机收藏与草稿、投稿文件导出，以及 Prompt 追加到 DSH 草稿。固定 npm 扩展经过预览后由官方 CLI 安装或卸载，完成后需要重启。标准组件还需单独安装可选的 dsh-std 适配器。Skill 加载、MCP 连接配置、通用 Slash 执行与主题应用仍在建设。

“GitHub 连接”可填写读取用令牌，由 Windows 加密保存在 `DSH_HOME/community/private/`，仅 GitHub API GET 请求携带认证。文档翻译使用你在 DSH 配置并主动选择的模型，可能消耗付费 Token。

## 卸载与数据

停止 DSH，运行 `dsh plugin --profile web remove dsh-market-integration` 后重启。服务端数据保留在 `DSH_HOME/community/`；浏览器收藏与草稿保留在站点存储。卸载不会撤销 GitHub 令牌。

## 权利与支持

原创代码采用 MIT 许可，第三方内容、依赖和品牌保留各自权利。本项目独立维护，不是 DeepSeek 官方产品，不提供担保。包内包含许可证、免责声明、第三方清单与前端实际打包依赖的许可原文。

问题、署名修正或作者希望移除收录资源时，请前往 [项目 Issues](https://github.com/QT7-C23/DSH-Marketplace/issues)。源码与开发文档见 [DSH-Marketplace](https://github.com/QT7-C23/DSH-Marketplace)。
