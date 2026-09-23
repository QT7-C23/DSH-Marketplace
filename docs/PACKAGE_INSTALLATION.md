# 商城安装包与官方安装

更新：2026-09-24。版本 `v0.2.0-alpha.1`。官方安装包及真实宿主验收已有本地记录，标准组件完成五次独立启动测试，包括准备后卸载市场；完整发布结果见仓库交付记录及 GitHub Actions。

`0.2.0-alpha.1` TGZ 已在 Windows、Node.js 24、DSH `0.1.5-rc.2` 隔离环境验证官方安装、真实页面、卸载及保留数据。标准组件管理与市场卸载另外经过五次独立启动验收。

## 从源码构建

需要 Node.js 24+、npm 和网络。安装时另需 PATH 中可用的 pnpm 与受支持的 DSH。从仓库根目录执行：

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
npm run package
```

产物写入 `artifacts/releases/`，`package-result.json` 记录实际文件名、大小、文件清单和 SHA-256。源码版本已设为 `0.2.0-alpha.1`；仍须以实际构建结果为准，不要仅重命名旧包冒充候选版。构建使用新的暂存目录，不清理用户文件。

当前源码起始目录含 **4,907 条来源记录**，跨来源去重后为 4,904 条；其中 MCP 实际为 3 条，发行快照策略上限是 **100 条**。最终数量／内容以包验收为准，运行时仍完整分页读取 MCP Registry。起始条目不表示实时目录完整，也不保证均可安装或调用。

## 安装与打开

安装者只需 TGZ 和受支持的 DSH，不必克隆源码。运行依赖仍由 pnpm 联网获取，不是离线全依赖包。先停止目标 DSH，将路径换成实际构建或取得的文件：

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-market-integration-0.2.0-alpha.1.tgz" --ignore-scripts --registry=https://registry.npmjs.org
dsh web
```

该文件名是候选目标；确认本机已有对应文件和实际版本再执行。打开宿主提供的认证地址，从侧栏进入“扩展市场”，在“设置”选择中、英、日文。浏览不需模型密钥；翻译和需模型的资源行为使用你明确配置的服务。

包的配置面向 `web` profile。不要在同一 profile 再以 `integration/set-plugin.mjs` 挂载源码版；重复入口不是正常升级方式。安装市场不自动安装可选 dsh-std 适配器，也不自动安装目录中的资源。各类操作见 [扩展管理](EXTENSION_MANAGEMENT.md)。

## 更新与移除

更新时停止目标宿主，对新的实际 TGZ 重复官方 `add`，核对版本并重启。不要把目录版本发现等同于市场自身已经升级；候选版升级路径也属于最终包验收范围。

移除时先停止宿主。若市场曾管理标准组件，先完成下方“标准组件卸载准备”，再执行：

```powershell
dsh plugin --profile web remove dsh-market-integration
dsh web
```

官方移除负责包和 bundle 入口。市场自身没有卸载自己的按钮；不会远程删除用户收藏、撤销 GitHub 令牌或清空 `DSH_HOME/community/`。浏览器数据保留于原站点，改变端口可能看见不同收藏。移除市场也不代替已安装资源的各自管理；先按其流程处理需要变更的资源。

若操作失败或中断，按 [日志与人工恢复](EXTENSION_MANAGEMENT.md#操作历史中断与人工恢复) 检查真实配置、依赖和锁，不靠删除锁声称恢复成功。

## 包内容与宿主边界

包包含后台本地导入闭包、构建前端、资源目录、三语安装说明、MIT／第三方声明、前端实际打包依赖许可，以及 Windows 加密辅助脚本。`BUNDLED_DEPENDENCIES.json` 记录前端依赖与许可文件，`licenses/build-inputs/` 保存构建 lockfile 快照。

包同时声明 client、bundle，导出 `dsh-market-integration/standard-loader`。不包含本机凭据、数据库、测试、原型页面、构建工具或 node_modules。`host-runtime.mjs` 从实际运行的官方 CLI 解析宿主版本、入口和用户目录，不以插件依赖副本推定宿主。

默认 GitHub 密文保存在宿主 `community/private/github-token.dpapi`；源码开发与正常联网验收使用仓库忽略路径，见 [GitHub 连接](GITHUB_CONNECTION.md)。认证地址、备份和原始日志可能含私有信息，不应发布。

标准组件首次接管可能重载全部标准组件；同一进程即使替换适配器 active 也保持 unknown／restart-required，阻止后续标准启停。完整停止并新启动后，稳定 Loader 的切换只保存下次启动目标；浏览器再刷新。此行为没有热替换模块缓存或自动恢复承诺。

## 验收状态与命令

`npm run verify:package` 构建实际 TGZ，在全新隔离 profile 通过官方 CLI 安装；不添加源码挂载。验证目标包括单一入口、三语页面、真实宿主版本、起始目录和定义、Prompt 导出、市场状态，以及卸载后入口／API 消失、数据库和用户数据保留。包检查还覆盖导入闭合、运行依赖、host peer、标准 Loader 导出、排除文件和许可。

`npm run verify` 包含包验收及其他门禁；证据保存于 `artifacts/dsh-integration/package-*/`。截至 2026-09-24，标准组件在 0.2.0-alpha.1 包中通过五次独立启动与浏览器验收，包括卸载准备后重新启动。每次提交仍须通过完整本地门禁；线上 CI 状态以仓库 Actions 为准。本页不将局部回归或构建成功当作全量验收。

原创与第三方许可范围见 [LICENSE](../LICENSE)、[第三方声明](../THIRD_PARTY_NOTICES.md) 和 [免责声明](../DISCLAIMER.md)。

## 标准组件卸载准备

市场曾管理标准组件时，卸载前必须先停止 DSH，再运行包内维护预览。下面的 DSH_HOME 须替换为实际绝对路径。准备步骤恢复上游自动发现，之前停用的标准组件可能重新加载；若不希望它们出现，先用官方 CLI 移除这些包。核对预览后重复命令并加 `--confirm <fingerprint>`；只有同意重新加载所列停用包时才加 `--enable-disabled`。结果为 `not-managed` 时无需确认。准备成功后再执行官方卸载命令。保留其他配置，并记录备份。

```powershell
node "<DSH_HOME>\profiles\web\node_modules\dsh-market-integration\integration\maintenance.mjs" prepare-uninstall --home "<DSH_HOME>" --profile web
```

固定的 dsh-std adapter 0.1.1-rc.3 存在上游限制：一个声明依赖 CommandRuntime 的组件加载后，后续组件可能在连接协商时启动失败。命令提供组件的验收不代表这种组合也兼容，使用前仍需验证实际组件集合。
