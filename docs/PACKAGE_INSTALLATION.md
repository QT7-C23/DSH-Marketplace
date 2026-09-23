# 安装、更新与卸载

适用于 `v0.2.0-alpha.1`。需要 Windows、Node.js 24、DSH `0.1.5-rc.2`、PATH 中可用的 pnpm 和 npm 网络。其他环境尚未完成同等验收。

## 下载与安装

从 [GitHub Releases](https://github.com/QT7-C23/DSH-Marketplace/releases/tag/v0.2.0-alpha.1) 下载 `dsh-market-integration-0.2.0-alpha.1.tgz` 和 `SHA256SUMS.txt`。用以下命令计算文件校验值，与清单比较：

```powershell
Get-FileHash -Algorithm SHA256 "C:\Downloads\dsh-market-integration-0.2.0-alpha.1.tgz"
```

校验一致后，先停止目标 DSH，再使用官方 CLI 安装：

```powershell
dsh plugin --profile web add "C:\Downloads\dsh-market-integration-0.2.0-alpha.1.tgz" --ignore-scripts --registry=https://registry.npmjs.org
dsh web
```

路径应替换为实际下载位置。打开宿主提供的认证地址，从侧栏进入“扩展市场”，在设置中选择中、英、日语言。浏览无需模型密钥；翻译及需要模型的资源使用你明确配置的服务。

安装者无需克隆源码，运行依赖由 pnpm 联网获取。包面向 `web` profile；同一 profile 不要同时挂载源码版和 TGZ 版。市场安装不会自动安装目录资源或可选 dsh-std 适配器。资源操作见[资源管理](EXTENSION_MANAGEMENT.md)。

## 更新

停止 DSH，对新的 TGZ 重复官方 `add` 命令，核对版本后重新启动。目录中发现某个资源的新版本，不表示市场自身已经升级。

## 卸载

先停止 DSH。**市场曾管理标准组件时，必须先完成下方“标准组件卸载准备”**，再执行：

```powershell
dsh plugin --profile web remove dsh-market-integration
dsh web
```

官方移除处理包和 bundle 入口，不会撤销 GitHub 令牌、清空 `DSH_HOME/community/` 或远程删除浏览器收藏。改变站点端口可能看见不同的本机数据。已安装资源需按各自流程管理；卸载市场不代替这些操作。

操作失败或中断时，按[日志与人工恢复](EXTENSION_MANAGEMENT.md#操作历史中断与人工恢复)检查配置、依赖、备份和锁，不要直接删除锁来宣称恢复成功。

## 标准组件卸载准备

固定的 dsh-std adapter `0.1.1-rc.3` 存在 CommandRuntime 组合问题，具体限制见[兼容说明](COMPATIBILITY_AND_THEMES.md)。标准组件变更需要完整重启，不能按普通热切换处理。

市场曾管理标准组件时，停止 DSH 后运行包内维护预览，将 `<DSH_HOME>` 替换为实际绝对路径：

```powershell
node "<DSH_HOME>\profiles\web\node_modules\dsh-market-integration\integration\maintenance.mjs" prepare-uninstall --home "<DSH_HOME>" --profile web
```

准备步骤恢复上游自动发现，之前停用的标准组件可能重新加载。若不希望这些组件出现，先用官方 CLI 移除相应包。核对预览后重复命令并加 `--confirm <fingerprint>`；只有同意重新加载所列停用包时才加 `--enable-disabled`。结果为 `not-managed` 时无需确认。

准备成功后再执行官方卸载命令。该流程保留其他配置并记录备份；恢复时仍需核查实际环境。

## 从源码构建

开发环境安装与验证统一见[开发指南](../integration/README.md)。安装依赖后执行 `npm run package`，产物在 `artifacts/releases/`，实际文件名、文件清单和 SHA-256 记录于 `package-result.json`。

包包含后台运行模块、构建前端、起始目录、三语安装说明、原始及第三方许可、Windows 加密辅助脚本。`BUNDLED_DEPENDENCIES.json` 记录前端依赖许可，`licenses/build-inputs/` 保存构建锁文件。不包含本机凭据、数据库、测试或 node_modules，初始目录也不表示完整实时目录。

默认 GitHub 密文位于宿主 `community/private/github-token.dpapi`，详见[GitHub 连接](GITHUB_CONNECTION.md)。认证地址、备份和原始日志属于本机私有资料。

[文档目录](README.md) · [MIT](../LICENSE) · [第三方声明](../THIRD_PARTY_NOTICES.md) · [免责声明](../DISCLAIMER.md)
