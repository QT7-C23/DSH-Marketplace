# 官方 CLI 与插件接入

更新：2026-09-24。版本 `v0.2.0-alpha.1`。官方安装包及真实宿主验收已有本地记录，标准组件完成五次独立启动测试，包括准备后卸载市场；完整发布结果见仓库交付记录及 GitHub Actions。

## 包声明不等于运行成功

| 声明或操作 | 职责 |
|---|---|
| `dsh.bundle: { "patch": "./cordis.patch.yml" }` | 向指定 profile 提供模块与配置组合 |
| `dsh.client: { "platform": "web" }` | 声明前端加载信息，通常配合 `exports["./client"]` |
| `dsh plugin --profile web add <package>` | 通过 pnpm 安装依赖并协调可用 bundle |
| `dsh-plugin.json` | 标准组件声明，由已加载的 dsh-std 适配器发现和挂载 |

后端插件可以没有前端。仅有 client 声明不证明具有可自动组合的完整入口；CLI 成功也不证明加载和调用成功。四个官方模块可能已经包含在宿主或预设中，不能重复安装来制造“可用”证据。

标准组件采用 dsh-std 是自愿的；适配器自己提供原生 bundle，组件不必再提供原生 bundle。同一发布物同时声明两条会被自动发现的入口时，当前市场拒绝安装，不通过简单选择标签冒险重复激活。

## 市场实际接线

`integration/package.mjs` 以后台导入图与公共资产清单构建独立包，包含 client、bundle、标准 Loader 导出和真实运行依赖声明。`integration/plugin/host-runtime.mjs` 从正在运行的官方 CLI 解析宿主环境。源码挂载仅是另一开发入口，不是安装者的前提。

资源的 npm `packageRef` 必须精确，且与显示版本一致。市场预览检查 npm SRI、实际 manifest、入口、宿主／Node 范围、反向依赖及标准需求；用户明确执行后，`ProfileInstaller` 才使用可信程序路径和参数数组调用：

```text
dsh plugin --profile <profile> add <name>@<version> --ignore-scripts --save-exact --registry=https://registry.npmjs.org
dsh plugin --profile <profile> remove <name> --ignore-scripts --registry=https://registry.npmjs.org
```

目标 profile 来自插件可信配置，不能由浏览器任意指定路径或命令。profile 变更共享指纹、独占锁、备份与操作日志；执行后重新核对依赖、bundle 和文件，必要时进入需要恢复状态。

原生启停只补丁修改明确归属的 profile 入口，保留其他字段及表达式。安装／更新／卸载完成按提示重启并刷新浏览器，实际状态再通过公开库存核查。DSH 基础包、共享适配器和市场自身受保护，直接反向依赖或不确定归属会阻止操作。

## 标准组件与进程边界

标准组件的受控发现使用 `@dsh-std/adapter-dsh@0.1.1-rc.3`、一个市场 Loader 和完整启用集合。SDK 负责模块导入及组件挂载，不采用私有句柄或直接操作模块缓存。

首次接管会关闭旧核心自动发现并插入市场 Loader，可能重载全部标准组件。公开 SDK 无法证明旧批次清理成功，因此同一进程始终按 unknown／restart-required 处理，不允许下一次标准启停；替换适配器 active 不构成解除条件。必须完整停止并启动 DSH。

正常启动的稳定 Loader 下，后续切换只保存下次初始化的目标集合，当前批次不因普通配置更新立即替换。依赖失败等生命周期事件仍可能重载，不能保证绝对不重载。标准组件在 0.2.0-alpha.1 包中通过五次独立启动与浏览器验收。见 [管理流程](EXTENSION_MANAGEMENT.md)。

## 其他资源不伪装为 npm 插件

Skill 按固定 Git 提交安装完整原始文件，再经原生 Skill 服务加载／调用；支持启停、保留文件的移除、更新及明确恢复。MCP 使用完整固定定义创建原生连接，支持公共 HTTPS Streamable HTTP 和固定 npm stdio；启停／移除与工具注册状态单独记录，换版／重新配置需先移除再明确连接。

Slash 使用所属插件在当前会话提供的命令；Prompt 仅预览并追加草稿。主题插件按真实 npm 包接入，纯配色文件仍缺少通用导入路径。仅下载 TGZ、Skill ZIP、MCP JSON 或提案文件不会执行上述安装或连接。

## 验证与公开状态

当前基线是 DSH `0.1.5-rc.2`、Windows／Node.js 24。历史适配器安装及原生／标准混合运行有记录，新标准控制的 A/B 四进程验收已通过旧构建，候选版本复跑与最终门禁仍待完成；部分主题可用但有明确失败，见 [兼容与主题](COMPATIBILITY_AND_THEMES.md)。

统一命令 `npm run verify` 包含 `npm run verify:package` 对应的实际包检查；CI 和 hook 采用相同入口，但配置存在不代表线上成功。恢复只依据真实日志、备份和当前环境，范围见 [扩展管理](EXTENSION_MANAGEMENT.md)。

本页依据仓库锁定依赖及接线描述，不把浮动上游文档或另一目录的收录规则当作当前宿主保证。原创及第三方权利见 [第三方声明](../THIRD_PARTY_NOTICES.md) 与 [免责声明](../DISCLAIMER.md)。

标准组件卸载边界与上游 CommandRuntime 组合限制见 [安装说明](PACKAGE_INSTALLATION.md)。
