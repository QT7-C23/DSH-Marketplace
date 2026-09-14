# 三语 README 与开源许可准备

日期：2026-09-13。甲方已创建公开仓库 [QT7-C23/DSH-Marketplace](https://github.com/QT7-C23/DSH-Marketplace)，要求采用 MIT，提供英文、中文、日语 README，并附免责和版权声明。

## 文档组织

- [英文 README](../../README.md) 为默认入口；[中文](../../README.zh-CN.md) 与 [日语](../../README.ja-JP.md) 互链，启动命令、功能状态和贡献边界一致。
- 简介、实际截图、能力表、三步启动、数据行为、开发与贡献、许可与免责声明按新用户阅读顺序编排。
- 参考 [PowerToys README](https://github.com/microsoft/PowerToys/blob/main/README.md) 的简介、安装和详细文档入口组织，以及 [Anthropic Skills README](https://github.com/anthropics/skills/blob/main/README.md) 对资源许可、使用方式和免责声明的区分；正文独立撰写。
- 旧中文 README 的详细操作内容移至 [本机开发说明](../LOCAL_DEVELOPMENT.md)，保留宿主路径与操作边界。
- 截图来自隔离宿主实际运行，保留上游品牌说明；不包含认证地址或私人账户资料。

三语文档均注明：应用界面当前为中文，自动发现新资源及安装管理尚未完成；来源刷新仅覆盖固定选集；本机统计不代表公共平台规模，仓库 Star 不代表单条资源热度。

## 许可与版权

- [LICENSE](../../LICENSE) 保留完整标准 MIT 文本，版权行为 `Copyright (c) 2026 QT7-C23 and contributors`。参照 [MIT 许可证文本](https://choosealicense.com/licenses/mit/)，不添加禁止商用等额外限制。
- [DISCLAIMER.md](../../DISCLAIMER.md) 提供三语说明，涵盖保证排除、开发状态、第三方资源、AI 输出、商标与独立性、权利异议联系；适用许可证和法律优先。
- [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) 记录选定 Skill、8 份 Prompt 的作者、MCP 元数据和主要依赖，明确根 MIT 不重新授权第三方内容。
- 保留 DeepSeek、React、fflate、esbuild、TypeScript、Playwright 的许可证副本及 Playwright NOTICE；原有 Apache-2.0 Skill 许可与 CC0 Prompt 许可保留。
- 主要依赖表不是未来发行包的完整审计；实际分发时仍按打包内容保留各依赖声明。[Apache-2.0 官方文本](https://www.apache.org/licenses/LICENSE-2.0) 为许可核对来源之一。

## 验证与发布边界

`npm run verify` 通过：53 项模块/原型测试、11 项真实 DSH 浏览器测试，以及目录、类型、构建和静态检查。宿主证据为忽略目录 `artifacts/dsh-integration/verify-ZF59v2/`。

额外文档复核确认三语语言导航、许可链接和 PowerShell 命令一致，标准 MIT 正文完整，7 份许可证及 NOTICE 与上游逐字节一致。5 份 manifest/lockfile 仅增加许可和根项目仓库元数据，没有依赖变更。结果存于忽略目录 `artifacts/documentation-preparation/verification.json`；原 README 和元数据备份保存在同目录。

截至本轮，文件准备在本地完成，没有提交或推送；GitHub 仓库已创建，但首次文件上传、应用投稿链接配置和自动收录尚未完成。没有配置 GitHub Actions，也没有把本机验证表示为线上 CI。历史研究中“仓库尚未指定”的表述按当时状态保留，当前状态以三语 README 与产品方案为准。
