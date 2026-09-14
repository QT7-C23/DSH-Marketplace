# DSH 市场入口与 Prompt 宿主接入实验

后续进展：本文保留第一轮 20 项测试时的历史结论。市场主要页面与真实本机社区已在下一轮接入，当前完成范围见 [社区流程验收](2026-09-13-community-flow.md)。

日期：2026-09-13。甲方认可原型后，本轮推进独立宿主实验，验证侧栏入口和会话内模板使用。结论：**市场插件可以加载进真实 DSH；周报模板能追加到真实草稿，保留原文、文件引用和已上传附件。** 完整市场迁移、其他资源的安装与在线社区仍未完成。

## 1. 环境与可复现范围

- 实测：Windows、Node.js 24.16.0、Microsoft Edge、Playwright 1.62.1。
- 运行时：npm 官方包 `@deepseek-ai/dsh@0.1.5-rc.2`，依赖固定在 [integration/package-lock.json](../../integration/package-lock.json)。264 项 DSH 包版本覆盖避免同族包在安装时漂移，统一验证同时检查 lockfile 中实际解析版本。
- 源码参考：[DSH 固定提交](https://github.com/deepseek-ai/deepseek-harness/tree/c291e7961a515f6d7af9304e7fd1d257929aef26)。浅层 Git 获取因连接失败未完成，随后读取维护方该提交的源码归档；本轮运行 npm 发行包，并未从该提交构建发行物，不能据此宣称两者逐字一致。
- 源码、安装包、宿主数据与截图都在忽略目录；仅自编的插件、启动脚本、测试、依赖声明和锁文件纳入项目。没有修改上游源码或父仓库其他项目。
- 每次完整验证创建独立 `DSH_HOME` 和两个虚构工作区，随机监听本机端口；子进程不继承 API 凭据。测试结束后关闭浏览器及本次宿主。配置隔离不等同于操作系统沙箱。

复现入口见 [integration/README](../../integration/README.md)，统一命令仍为 `npm run verify`。

## 2. 已运行的验收

| 场景 | 实际结果 | 证据层级 |
|---|---|---|
| 无目标会话 | 市场入口可打开；会话内模板入口尚不出现 | 真实 DSH 与浏览器 |
| 进入市场 | 侧栏“社区资源”进入自编主面板，五类样本可见 | 真实插件加载；样本列表不等于安装能力 |
| 插入模板 | 填写三项、预览、追加；原文与后续新输入保留 | 真实编辑器 |
| 文件引用 | 从 DSH 文件建议选中 `report.md`；追加后原引用节点仍在 | 真实引用对象，未被扁平化为普通文本 |
| 附件 | 浏览器生成无私密内容的文本附件，经 DSH 上传；核对磁盘字节与 SHA-256 路径，追加后附件节点仍在 | 真实上传和落盘，没有上传个人文件 |
| 预览过期 | 预览后继续输入，点击追加被拒绝；重新预览后可追加 | 真实输入版本冲突 |
| 切换会话 | 切到另一个工作区的空白会话，旧预览消失；回到原会话保留原文 | 两个实际宿主会话；不声称附件跨切换恢复 |
| 停用与再启用 | 更新独立 profile 补丁并刷新，入口消失；再次启用并刷新后恢复且不重复 | 实际宿主配置与浏览器重载 |
| 不自动发送 | 插入流程没有产生会话或子代理的 prompt 提交 RPC | 浏览器网络检查；未调用真实模型 |
| 忙碌、命令占用、无效目标 | 适配器拒绝插入 | 单元测试；忙碌会话尚无运行时复现 |

统一验证通过 **20 项测试**：原型 14 项、插入适配器 2 项、宿主浏览器实验 4 项；另通过类型检查、构建、静态门禁及原型 26 组颜色对比度检查。截图保存于 `artifacts/dsh-integration/host-market.png` 和 `host-prompt.png`，已人工查看；测试结束截图也保留在同目录。

## 3. 接入方式与发现的问题

插件声明 DSH 客户端模块，通过公开 `main`、`sidebar.panellist`、`conversation.input.dock` 插槽挂载。会话绑定和输入快照来自公开合同；使用带 `draftRev` 的 `slash/input-insert-text` 事件追加文本。没有读取编辑器私有状态，也没有用 DOM 注入实现产品功能。

插入前同时核对目标会话、打开状态、运行与待提交状态、输入阶段及草稿版本。文本快照里的文件引用占用完整显示文字，而编辑器插入坐标把引用计为一个单元；适配器对这一差异换算。该换算绑定当前 DSH 版本，升级时必须重跑真实引用测试。

已打开页面在停用补丁更新后 **15 秒内没有自行移除入口**；刷新后移除成功。本轮只承诺停用/启用后刷新生效，不能把注册时具备 disposer 推导为热卸载已通过。正式管理器需要明确刷新要求，并先处理未发送内容的保存与恢复。

DSH 会复用同一工作区的空白会话，因此切换验收使用两个工作区。初始 API Key 提示异步出现，测试通过页面上的“稍后配置”继续，未修改认证或模型设置来跳过流程。

附件响应体读取曾由浏览器驱动返回“页面已关闭”错误，但同时检查到页面仍打开、浏览器仍连接、附件卡片已出现。根因尚未确认；最终验收采用成功 HTTP 状态、宿主实际落盘字节和保留的附件节点共同核对，没有仅凭卡片判定上传成功。

## 4. 未完成事项及后续顺序

1. 将已评审市场界面接入真实宿主，并覆盖忙碌状态、会话关闭与刷新时草稿/引用/附件恢复。当前实验 UI 只承担技术验证；尚无全局市场选择 Prompt 后返回目标会话的完整导航流程。
2. 建立社区最小后端：真实账户、作者权限、Prompt 投稿与版本、另一账户发现使用、撤回与网络失败处理。原型中的身份切换和本机发布继续保留演示标识。
3. 完整同步一个资源来源，再接插件及所属 Slash、Skill 目录和 MCP 连接；每类分别验证获取、加载、调用、移除与恢复。
4. 在明确支持版本后验证升级和兼容收益。当前结果覆盖一个发行版本、一种操作系统，不证明跨版本兼容、其他平台可用或模型输出质量。

首发仍是插件、Skill、MCP、Slash、Prompt 五类，并支持社区投稿。模型目录、模型下载、Cookbook 与主题继续暂缓；本轮实验结果没有缩减完整产品目标。

## 参考合同

- [侧栏与主面板布局](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-layout/src/client/index.ts)
- [会话插槽合同](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-conversation/src/client/contract/slots.ts)
- [输入合同](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-conversation/src/client/contract/input.ts)
- [编辑器坐标投影](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/packages/client/ui-conversation/src/client/input/editor/projection.ts)
- [CLI 的 profile 与补丁说明](https://github.com/deepseek-ai/deepseek-harness/blob/c291e7961a515f6d7af9304e7fd1d257929aef26/apps/cli/README.md)
