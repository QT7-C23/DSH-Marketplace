# 商城安装包与官方安装

当前可生成独立的开发安装包 `dsh-market-integration-0.1.0.tgz`，沿用现有内部包名。已在 Windows、Node.js 24、DSH `0.1.5-rc.2` 的全新 `web` profile 验证官方安装、实际页面与后端、卸载和重启。尚未发布到 npm 或 GitHub Release。

## 构建

从源码仓库安装锁定依赖后运行：

```powershell
npm ci
npm ci --prefix integration --ignore-scripts
npm run package
```

产物在 `artifacts/releases/dsh-market-integration-0.1.0.tgz`。同目录 `package-result.json` 记录实际文件清单、大小和 SHA-256；重新构建会更新该产物。每次使用新的暂存目录，不清理用户文件。安装者只需要 TGZ 和受支持的 DSH，无需克隆本仓库；运行依赖仍由 pnpm 联网取得。

## 安装与移除

先停止目标 DSH，替换为实际文件的绝对路径：

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-market-integration-0.1.0.tgz" --ignore-scripts --registry=https://registry.npmjs.org
dsh web
```

启动后从侧栏进入“扩展市场”。同一 profile 不要再通过 `integration/set-plugin.mjs` 重复挂载源码版。此包的 bundle 配置目标为 `web`，其他 profile 尚未验收。

卸载时停止宿主，执行 `dsh plugin --profile web remove dsh-market-integration` 后重启。市场自身不提供卸载自己的按钮。此操作移除程序与入口，保留 DSH 用户目录下的 `community/` 数据，也不删除浏览器收藏或撤销 GitHub 令牌。

## 包内容与运行边界

包包含 backend 的实际本地导入依赖、已构建的前端、资源目录、三语安装说明、MIT 与第三方声明、前端实际打包依赖的许可证，以及 Windows 加密辅助脚本。`BUNDLED_DEPENDENCIES.json` 记录前端依赖名称、版本与许可文件；开发 lockfile 快照放在 `licenses/build-inputs/`。

不包含本机凭据、数据库、测试、原型页面、构建工具或 node_modules。安装商城不自动安装可选的 dsh-std 运行适配器。原生与标准资源仍遵守各自的加载要求。

宿主版本、CLI 和用户目录由 `host-runtime.mjs` 从实际运行的官方 CLI 解析，不从插件自身的依赖副本推断。凭据默认保存在宿主用户目录 `community/private/github-token.dpapi`，不写入安装目录；开发启动器与普通联网验收继续显式使用仓库的忽略文件路径，详见 [GitHub 连接](GITHUB_CONNECTION.md)。

## 验收

`npm run verify:package` 构建后，在新建的隔离 profile 中使用官方 CLI 安装实际 TGZ，不添加源码挂载配置；验证单一入口、三语页面、30 条资源、Prompt 导出、实际宿主版本和市场的 active 状态。随后通过官方 CLI 卸载、重启，检查入口及 API 消失、数据库和用户数据保留。此测试不使用真实 GitHub 或模型凭据。

`npm run verify` 包含上述验收及原有测试。包检查同时验证导入闭合、运行依赖与宿主 peer 声明、文件排除、许可链接和从其他目录启动构建。未声明的运行依赖会直接阻止打包，避免被开发环境中已有的包掩盖。证据保存在 `artifacts/dsh-integration/package-*/`。安装包验收通过不代表外部网络下载、跨版本或整个产品均已验收。
