import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { hostRuntime } from './host-runtime.mjs';
import { Community } from '../community/service.mjs';
import { createHandler } from '../community/http.mjs';
import { RepositoryStars } from '../community/repository-stars.mjs';
import { NpmDownloads } from '../community/npm-downloads.mjs';
import { githubPrompts } from '../../catalog/resources.mjs';
import { SEEDS } from '../prototype/catalog.mjs';
import { SourceManager } from '../sources/manager.mjs';
import { scheduleSourceChecks } from '../sources/scheduler.mjs';
import { Documentation } from '../sources/documentation.mjs';
import { GitHubConnection } from '../sources/github-auth.mjs';
import { Translation } from './translation.mjs';
import { PluginAvailability, hostInventoryPort } from './availability.mjs';
import { ExtensionManager } from './compatibility/manager.mjs';
import { ProfileInstaller } from './compatibility/installer.mjs';
import { profilePackages, nativeRuntimePort, standardRuntimePort } from './compatibility/ports.mjs';
import { SkillFiles } from './resources/skill-files.mjs';
import { SkillResources } from './resources/skills.mjs';
import { McpManager } from './resources/mcp-manager.mjs';
import { mcpProfilePort } from './resources/mcp-profile.mjs';
import { STANDARD_LOADER_EXPORT } from './compatibility/standard-loader.mjs';

/** Mount the community API behind DSH's existing authenticated connection. */
export const name = 'dsh-market-integration';
export const inject = ['connection', 'loader'];
export function apply(ctx, config = {}) {
  const host = hostRuntime();
  const folder = path.join(host.home, 'community');
  mkdirSync(folder, { recursive: true });
  ctx.effect(() => {
    const service = new Community(path.join(folder, 'community.sqlite'), githubPrompts);
    const sources = new SourceManager(path.join(folder, 'sources'), { onChange: entries => service.replaceCatalog(entries) });
    service.replaceCatalog(sources.resources());
    const stars = new RepositoryStars();
    const npm = new NpmDownloads();
    const github = new GitHubConnection({ onChange: () => stars.invalidate() });
    const documentation = new Documentation(() => service.snapshot().catalog);
    const translation = new Translation(documentation, () => ctx.get('llm'), () => ctx.get('agentDefaultModel')?.currentSelection());
    const availability = new PluginAvailability(() => service.snapshot().catalog, hostInventoryPort(ctx));
    const skills = new SkillResources({ catalog: () => service.snapshot().catalog, files: new SkillFiles({ home: host.home }), registry: () => ({ get: async name => {
      const scope = await ctx.get('agentPresets')?.standingKeyFor();
      return ctx.get('skills')?.get(name, { scope });
    } }), home: host.home });
    // The profile is explicit plugin configuration, never supplied by an HTTP request.
    const profile = config.profile;
    const installer = profile ? new ProfileInstaller({ home: host.home, profile, cli: host.cli, folder: path.join(folder, 'operations') }) : null;
    const extensions = profile ? new ExtensionManager({
      environment: { profile, hostVersion: host.version, nodeVersion: process.versions.node, packageVersion: host.packageVersion },
      packages: profilePackages(host.home, profile), native: nativeRuntimePort(ctx, installer), standard: standardRuntimePort(ctx, {
        installer, profileDir: path.join(host.home, 'profiles', profile),
        ...(config.standardLoader === 'package' ? { loaderName: STANDARD_LOADER_EXPORT } : {}),
      }),
      installer,
    }) : null;
    const mcpPorts = profile ? mcpProfilePort({ installer, inventory: () => ctx.loader.entries(), prefix: () => {
      const rows = [...ctx.loader.entries()].filter(entry => entry.options.id === 'community-market');
      if (rows.length !== 1) throw Error('The marketplace profile entry is ambiguous');
      return rows[0].id.slice(0, -rows[0].options.id.length);
    } }) : null;
    const mcp = mcpPorts ? new McpManager({ home: host.home, scope: `profile:${profile}`, catalog: () => service.snapshot().catalog, ...mcpPorts, tools: { schemas: () => ctx.get('tools')?.schemas() || [] } }) : null;
    const handle = createHandler(service, ids => stars.read([...service.statisticsResources(ids), ...SEEDS.filter(item => ids.includes(item.id))]), sources, documentation, translation, availability, extensions, github, skills, mcp, (ids, signal) => npm.read(service.statisticsResources(ids), signal), installer);
    // This DSH bridge uses a synthetic request URL; Host has already passed its trust fence.
    const receive = request => {
      const url = new URL(request.url);
      const target = new URL(url.pathname + url.search, `http://${request.headers.get('host')}`);
      return handle(new Request(target, request));
    };
    const disposeRead = ctx.connection.fetch.register({ path: '/api/community/read', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeResource = ctx.connection.fetch.register({ path: '/api/community/resource', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeWrite = ctx.connection.fetch.register({ path: '/api/community', methods: ['POST'], requestBody: 'streaming', fetch: receive });
    const disposeStars = ctx.connection.fetch.register({ path: '/api/community/stars', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeNpm = ctx.connection.fetch.register({ path: '/api/community/npm-downloads', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeOperations = ctx.connection.fetch.register({ path: '/api/community/operations', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeWithdrawals = ctx.connection.fetch.register({ path: '/api/community/withdrawals', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeGitHubRead = ctx.connection.fetch.register({ path: '/api/community/github/read', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeGitHub = ctx.connection.fetch.register({ path: '/api/community/github', methods: ['POST'], requestBody: 'streaming', fetch: receive });
    const disposeSourceRead = ctx.connection.fetch.register({ path: '/api/community/sources/read', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeSources = ctx.connection.fetch.register({ path: '/api/community/sources', methods: ['POST'], requestBody: 'streaming', fetch: receive });
    const disposeDocumentation = ctx.connection.fetch.register({ path: '/api/community/documentation', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeModels = ctx.connection.fetch.register({ path: '/api/community/translation/models', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeTranslation = ctx.connection.fetch.register({ path: '/api/community/translation', methods: ['POST'], requestBody: 'streaming', fetch: receive });
    const disposeAvailability = ctx.connection.fetch.register({ path: '/api/community/availability', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeExtensionRead = ctx.connection.fetch.register({ path: '/api/community/extensions/read', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeExtensions = ctx.connection.fetch.register({ path: '/api/community/extensions', methods: ['POST'], requestBody: 'streaming', fetch: receive });
    const disposeSkillsRead = ctx.connection.fetch.register({ path: '/api/community/skills/read', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeSkills = ctx.connection.fetch.register({ path: '/api/community/skills', methods: ['POST'], requestBody: 'streaming', fetch: receive });
    const disposeMcpRead = ctx.connection.fetch.register({ path: '/api/community/mcp/read', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeMcp = ctx.connection.fetch.register({ path: '/api/community/mcp', methods: ['POST'], requestBody: 'streaming', fetch: receive });
    const stopChecks = scheduleSourceChecks(sources);
    return async () => {
      await translation.close(); await npm.close();
      for (const dispose of [disposeRead, disposeResource, disposeWrite, disposeStars, disposeNpm, disposeOperations, disposeWithdrawals, disposeGitHubRead, disposeGitHub, disposeSourceRead, disposeSources, disposeDocumentation, disposeModels, disposeTranslation, disposeAvailability, disposeExtensionRead, disposeExtensions, disposeSkillsRead, disposeSkills, disposeMcpRead, disposeMcp]) await dispose();
      await stopChecks(); service.close();
    };
  });
}
