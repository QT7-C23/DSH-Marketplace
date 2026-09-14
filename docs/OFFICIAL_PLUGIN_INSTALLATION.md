# 官方插件安装方案

状态：首轮官方 CLI 安装执行与统一管理已实现。商城自身已有独立开发安装包，并通过全新 profile 的官方安装、页面运行、卸载重启与数据保留验收，见 [安装包说明](PACKAGE_INSTALLATION.md)。真实适配器与原生/标准测试包混合运行已验证；公开发布、单组件启停与自动恢复仍待完成。使用流程和限制见 [扩展管理](EXTENSION_MANAGEMENT.md)。

## 三个不同的概念

| 声明或操作 | 作用 |
|---|---|
| `dsh.bundle: { "patch": "./cordis.patch.yml" }` | 导出组合配置，供 profile 启动器加载模块及配置 |
| `dsh.client: { "platform": "web" }` | 声明 Web 前端加载信息；前端代码通常通过 `exports["./client"]` 导出 |
| `dsh plugin --profile web add <package>` | 在指定 profile 中通过 pnpm 安装依赖，并协调符合条件的 bundle 列表 |

有前端声明不代表已经安装，也不代表有可自动组合的配置层。后端插件不必有前端；一个完整市场可以同时声明两种角色。官方 CLI 的 `add` 成功还必须与实际加载结果区分。

R35 已确认：统一兼容层同时支持原生 DSH 资源和 dsh-std 组件，作者仍可自愿选择接入方式。adapter-dsh 自身提供 bundle，标准组件通过 `dsh-plugin.json` 被它发现，不要求每个标准组件再声明 `dsh.bundle`。官方 CLI 安装包与适配器激活组件是两个步骤。本市场已接入固定版本 dsh-std 的声明检查与状态端口；版本声明、适配器候选与主题插件/配色文件的区别见 [资源兼容与主题支持](COMPATIBILITY_AND_THEMES.md)。

## 当前事实

- 源码开发仍可由 `integration/set-plugin.mjs` 挂载；`npm run package` 根据后端导入图和明确的公共资产生成完整安装包，同时声明 `dsh.client` 与 `dsh.bundle`。
- 安装包包含所需运行文件和依赖声明，不依赖源码目录；宿主元数据从实际运行的 CLI 解析，数据与凭据写入 DSH 用户目录。
- 现有插件分类的四项是 DSH 官方功能模块；部分已由宿主或预设组合，不能重复挂载来制造“安装成功”。MCP 客户端还需要具体连接配置。
- 下载 TGZ 只校验并导出文件；宿主状态接口只读取。“已安装扩展”中的单独确认操作才执行官方 CLI。

## 实施顺序与验收

1. **商城自身可安装（已验证）**：包含运行文件、前端、许可、依赖声明和 bundle 配置。verify: `npm run verify:package` 在全新隔离 profile 中通过官方 CLI 安装，验证市场入口、后端、卸载与数据保留；不添加源码挂载路径。
2. **安装对象真实可用**：接入至少一个经核查的社区 bundle，固定版本、来源和兼容要求。只有 client 声明或需要额外组合的模块另行标注。verify: 作者实际发布包与目录信息一致，现有内置模块不会重复安装。
3. **界面调用官方安装**：用户确认包和目标 profile，服务端用固定可执行路径与参数数组调用 CLI。一次只执行一个 profile 变更；不拼接 shell 命令，不把浏览器参数直接传给包管理器。verify: 真正执行 `add` 后核对依赖、bundle、文件与运行状态；失败、取消、需要重启或配置分别可见。
4. **恢复与管理**：变更前保留受影响的 manifest、锁文件和用户配置。禁用按官方配置机制实施，卸载使用 `remove`；不把删除文件等同于卸载。verify: 重启持久、功能入口可用、卸载后入口消失、无重复加载，未修改其他插件或会话数据；失败可恢复到已验证状态。
5. **标准组件纳入同一管理流程**：固定标准组件和适配器版本，在现有操作编排中增加标准接入路径；安装预览包含适配器依赖与必要能力，记录所选路径。标准组件启停按对应适配器生命周期实施。verify: 包安装、协议协商、组件激活和功能使用分别核查；原生与标准组件共存、缺失能力、重复入口及失败恢复测试通过，卸载保留其他组件仍需的共享适配器。

热加载只在受支持的组合通过运行验证后提供。包安装成功但没有生效时显示具体原因，不能承诺所有插件无需重启。

## 核查来源

- [官方包声明](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/util/package-manifest/src/types.ts)
- [官方 CLI 与 profile 说明](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/apps/cli/README.zh.md)
- 本地固定依赖 `@deepseek-ai/dsh/README.zh.md`、`@deepseek-ai/dsh-app-boot/README.zh.md`、`@deepseek-ai/dsh-package-manifest/lib/types/types.d.ts`；以安装的 0.1.5-rc.2 行为为集成验收基准。
- [Awesome DSH Plugin 收录规则](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/d9a53bf020be61f21eb9a55f5a12ae7e49bf3d61/README.zh.md)：其清单要求 `dsh.bundle`；这是该目录的收录规则，不能扩张成所有 DSH 模块都必须有 bundle 的结论。
