# 下载、收藏、评分与来源仓库 Star

日期：2026-09-13。甲方指出此前要求的下载量、Star 等被遗漏。

## 原因与改动

旧 `ResourceStats` 在没有本机投稿统计时直接返回空。GitHub 精选走浏览器导出，未进入服务端计数；首页新增的作品因此没有指标。此前的本机投稿统计仍存在，但覆盖范围不足。

- 所有资源卡片与详情保留下载、收藏、评分、仓库 Star，图标配文字；未知数值显示状态，真实零仍显示零。
- GitHub 精选通过同一事务与请求去重机制统计资料下载，支持账户收藏及评分。正文继续由 GitHub 目录提供，本机账户不能修改或撤回它；旧账户和原有表保留。
- Star 使用公开 GitHub 仓库 API 的 `stargazers_count`，不把 watcher、评分、收藏或整个仓库的热度冒充单条 Prompt 的数据。详情提供仓库链接与获取时间。
- 四项指标各有排序；没有数据的条目排在已知值之后。同一仓库合并读取，成功缓存 30 分钟，失败退避并保留旧值的时间；Star 网络读取不阻塞本机资源。

## 数据口径

下载为当前本机市场成功生成文件的有效请求数，重试不重复累计，不证明用户保存到磁盘，也不等于安装人数。本机旧副本和来源样本的浏览器导出不计数。收藏仅包含主动同步到账户的当前人数，本机收藏不上传。评分按账户保留一份 1–5 分记录，可修改与撤销。尚未部署公共统计后端，因此这些数值不是全网市场总量。

GitHub Star 属于来源仓库，多个 Prompt 共用一个仓库时显示相同值。独立来源样本只有真实仓库 Star，其下载、收藏和评分仍未知。新 Prompt 投稿继续通过 GitHub 文件与 PR；接收仓库仍待甲方指定。

## 验证依据

先复现 GitHub 目录无服务端统计、客户端下载绕过计数，以及卡片缺少指标行，再实现并回归。新增测试覆盖实际 SQLite 重启、去重、版本变化、私有收藏、目录移除、只读内容边界，以及 Star 的真实零、未知、限流、缓存和排序。

统一命令为 `npm run verify`，包含 44 项原型/数据/目录/适配器测试与 10 项真实宿主浏览器测试。浏览器断网和极端数值场景使用明确的测试夹具；首页截图与 `artifacts/dsh-integration/repository-stars-live.json` 使用未拦截的实际 API 返回，不能混为一类证据。

最终统一验证全部通过，隔离证据位于 `artifacts/dsh-integration/verify-9164Lf/`。已查看首页与窄屏截图，确认指标可见且按行重排。更新已有 4181 预览前，单独备份其 SQLite 并记录旧表行数；新统计仅增补三张目录互动表。

2026-09-13 已匿名实取四个仓库的 Star：`f/prompts.chat`、`deepseek-ai/deepseek-harness`、`anthropics/skills`、`modelcontextprotocol/servers`。数量随时间变化，以页面的获取时间为准。

GitHub 官方资料：[仓库接口](https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28)、[Star 字段含义](https://docs.github.com/en/rest/activity/starring)、[限流与重试](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)。
