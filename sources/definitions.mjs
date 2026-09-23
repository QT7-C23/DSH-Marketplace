export const SOURCE_DEFINITIONS = [
  { id: 'dsh', name: 'DSH 官方插件与命令', url: 'https://github.com/deepseek-ai/deepseek-harness', description: '读取与当前宿主一致的 0.1.5-rc.2 包元数据及关联命令。' },
  { id: 'skills', name: 'Anthropic Skills', url: 'https://github.com/anthropics/skills', automaticDiscovery: true, description: '扫描仓库中的 Skill 目录并发现新增资源；保留完整文件，只收录许可已核验且符合当前获取条件的条目。' },
  { id: 'mcp', name: 'MCP 官方注册目录', url: 'https://registry.modelcontextprotocol.io/docs', automaticDiscovery: true, description: '分页扫描最新的有效服务，保留支持 stdio 或 Streamable HTTP 的定义与配置要求。' },
  { id: 'npm', name: 'npm DSH 社区扩展', url: 'https://www.npmjs.com/search?q=keywords%3Adsh-plugin', automaticDiscovery: true, description: '分页发现标注 dsh-plugin、dsh-theme 或 dsh-std 的发布包；安装前另行核验宿主清单与兼容性。' },
  { id: 'skills-openai', name: 'OpenAI Skills', url: 'https://github.com/openai/skills', automaticDiscovery: true, description: '扫描 OpenAI 公开 Skill 目录，保留原文、文件和许可；安装时检查宿主依赖。' },
  { id: 'community', name: 'DSH Marketplace GitHub', url: 'https://github.com/QT7-C23/DSH-Marketplace', automaticDiscovery: true, description: '读取本仓库审核合并后的六类资源索引；社区提交必须经过审核才会进入该索引。' },
];
// Presentation translations only; this array does not limit discovery.
export const SKILLS = [
  ['internal-comms', '内部沟通助手', '按场景整理内部公告、进展和团队沟通材料。'],
  ['frontend-design', '前端界面设计', '为网页和应用建立视觉方向、排版与界面实现。'],
  ['webapp-testing', '网页应用测试', '借助 Playwright 检查本地网页，保留截图和测试证据。'],
  ['mcp-builder', 'MCP 服务开发', '按照配套参考与检查脚本开发 MCP 服务。'],
  ['skill-creator', 'Skill 编写与评估', '编写、修改 Skill，并设计评估与效果比较。'],
];
export const PLUGINS = [
  ['plan-mode', '规划模式', '先规划、评审，再继续任务。', '/plan'],
  ['command-compact', '对话压缩命令', '为长对话提供主动压缩入口。', '/compact'],
  ['command-goal', '目标管理命令', '查看和管理当前任务目标。', '/goal'],
  ['mcp-client', 'MCP 客户端', '为 DSH 接入外部 MCP 工具服务。', null],
];
export const MCP_SERVERS = [
  ['io.github.upstash/context7', 'Context7 文档检索', '按库与版本获取代码文档和使用示例。'],
  ['io.github.github/github-mcp-server', 'GitHub 仓库工具', '通过 GitHub 官方 MCP 访问仓库、Issue 和 PR；需要配置身份与权限。'],
  ['com.microsoft/microsoft-learn-mcp', 'Microsoft Learn 文档', '检索微软官方文档与代码示例。'],
];
