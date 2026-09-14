# 独立安装包构建与验收

## 本轮交付

- `npm run package` 产出完整开发 TGZ，同时声明 `dsh.bundle` 与 Web client；安装者不需要源码目录。
- 包含后端实际导入文件、前端、目录、三语安装说明与许可证。收集实际打包的前端依赖许可，并验证相对导入、运行依赖与宿主 peer 声明；不包含凭据、数据库或测试文件。
- `host-runtime.mjs` 从正在运行的官方 CLI 读取宿主版本、命令入口和用户目录，避免从插件依赖副本推断宿主。翻译依赖的 `@deepseek-ai/dsh-llm` 已显式声明固定 peer 版本。
- 安装版凭据保存在 DSH 用户目录；开发启动器继续使用仓库的忽略路径。修复从其他目录启动打包时输入根目录不稳定的问题。
- 最多三份本地化 README 并发读取，保持文件校验与选择顺序，失败前等待所有并发读取结束。它不能解决上游限流或断网。
- 取消翻译测试改为独立验证两个真实目录内 Prompt，确认宿主调用确实取消、原文保留、结果不会串到另一资源；不再依赖其他测试预热的在线 README 或预先创建的日志。真实 README 联网验收仍保留。

安装流程见 [安装包说明](../PACKAGE_INSTALLATION.md)。未进行 npm 发布、GitHub Release、提交或推送。

## 最终产物

`artifacts/releases/dsh-market-integration-0.1.0.tgz`，464761 字节。

SHA-256：`dfd219eebbd2697ebf1ba062558a1b103cdaee7fb9ef96acedd5d36dc5403aa0`。

完整文件清单在 `artifacts/releases/package-result.json`。构建暂存目录、备份、过程日志均在忽略的 `artifacts/` 内；现有工作区未重置或清理。

## 验收结果

最终统一命令日志为 `artifacts/installable-package/verify-release.log`：

| 验收范围 | 结果 |
|---|---|
| 静态规则、目录、语法、类型和前端构建 | 通过 |
| 行为、认证、文档、管理与打包测试 | 123 项全部通过 |
| 官方 CLI 安装、真实页面、卸载重启与数据保留 | 通过；`artifacts/dsh-integration/package-lzvOPW/package-verification.json` |
| 原生与标准组件混合运行及卸载保留 | 通过；`artifacts/dsh-integration/compatibility-9Dxdls/` |
| 真实 DSH 浏览器流程 | 20 项通过、3 项失败 |

包验收在新建的 `web` profile 中直接安装最终 TGZ，没有手动插入源码路径。核查单一入口、30 条资源、三语设置、Prompt 导出、真实宿主版本和市场 active 状态，再由官方 CLI 卸载。重启后入口和 API 消失，数据库及保留数据仍在。

最终仍失败的三项：资源归档下载返回 502／上游超时；Skill 自动检查收到 GitHub 403；规划模式作者文档请求失败。独立追踪该文档目录时，GitHub API 直接返回 403。本轮末尾开发凭据文件仍未配置，原文域名也出现过连接超时，因此不能声称所有问题都能仅靠令牌解决。

较早一次完整运行曾全部通过，记录在 `artifacts/installable-package/verify.log`，但后续复测再次失败；该较早结果不能替代最终状态。最终统一验收仍未全绿。取消翻译与失败诊断的独立宿主回归已通过，记录在 `artifacts/installable-package/browser-regressions.log`。

下一步先在本机设置保存已创建的 GitHub 令牌，再核查认证额度与原文域名连接，重新验收这三条真实联网流程。公开发布、更多资源的实际加载与连接、恢复和跨版本验证仍需继续完成。
