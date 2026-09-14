import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { hostRuntime } from './host-runtime.mjs';
import { Community } from '../../community/service.mjs';
import { createHandler } from '../../community/http.mjs';
import { RepositoryStars } from '../../community/repository-stars.mjs';
import { githubPrompts } from '../../catalog/resources.mjs';
import { SEEDS } from '../../prototype/catalog.mjs';
import { SourceManager } from '../../sources/manager.mjs';
import { scheduleSourceChecks } from '../../sources/scheduler.mjs';
import { Documentation } from '../../sources/documentation.mjs';
import { GitHubConnection } from '../../sources/github-auth.mjs';
import { Translation } from './translation.mjs';
import { PluginAvailability, hostInventoryPort } from './availability.mjs';
import { ExtensionManager } from './compatibility/manager.mjs';
import { ProfileInstaller } from './compatibility/installer.mjs';
import { profilePackages, nativeRuntimePort, standardRuntimePort } from './compatibility/ports.mjs';

/** Mount the community API behind DSH's existing authenticated connection. */
export const name = 'dsh-market-integration';
export const inject = ['connection', 'loader'];
export function apply(ctx, config = {}) {
  const host = hostRuntime();
  const folder = path.join(host.home, 'community');
  mkdirSync(folder, { recursive: true });
  ctx.effect(() => {
    const service = new Community(path.join(folder, 'community.sqlite'), githubPrompts);
    const sources = new SourceManager(path.join(folder, 'sources'), { onChange: entries => service.replaceCatalog([...githubPrompts, ...entries]) });
    service.replaceCatalog([...githubPrompts, ...sources.resources()]);
    const stars = new RepositoryStars();
    const github = new GitHubConnection({ onChange: () => stars.invalidate() });
    const documentation = new Documentation(() => service.snapshot().catalog);
    const translation = new Translation(documentation, () => ctx.get('llm'), () => ctx.get('agentDefaultModel')?.currentSelection());
    const availability = new PluginAvailability(() => service.snapshot().catalog, hostInventoryPort(ctx));
    // The profile is explicit plugin configuration, never supplied by an HTTP request.
    const profile = config.profile;
    const extensions = profile ? new ExtensionManager({
      environment: { profile, hostVersion: host.version, nodeVersion: process.versions.node, packageVersion: host.packageVersion },
      packages: profilePackages(host.home, profile), native: nativeRuntimePort(ctx), standard: standardRuntimePort(ctx),
      installer: new ProfileInstaller({ home: host.home, profile, cli: host.cli, folder: path.join(folder, 'operations') }),
    }) : null;
    const handle = createHandler(service, () => stars.read([...service.snapshot().catalog, ...SEEDS]), sources, documentation, translation, availability, extensions, github);
    // This DSH bridge uses a synthetic request URL; Host has already passed its trust fence.
    const receive = request => {
      const url = new URL(request.url);
      const target = new URL(url.pathname + url.search, `http://${request.headers.get('host')}`);
      return handle(new Request(target, request));
    };
    const disposeRead = ctx.connection.fetch.register({ path: '/api/community/read', methods: ['GET'], requestBody: 'buffered', fetch: receive });
    const disposeWrite = ctx.connection.fetch.register({ path: '/api/community', methods: ['POST'], requestBody: 'streaming', fetch: receive });
    const disposeStars = ctx.connection.fetch.register({ path: '/api/community/stars', methods: ['GET'], requestBody: 'buffered', fetch: receive });
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
    const stopChecks = scheduleSourceChecks(sources);
    return async () => { await translation.close(); await disposeRead(); await disposeWrite(); await disposeStars(); await disposeGitHubRead(); await disposeGitHub(); await disposeSourceRead(); await disposeSources(); await disposeDocumentation(); await disposeModels(); await disposeTranslation(); await disposeAvailability(); await disposeExtensionRead(); await disposeExtensions(); await stopChecks(); service.close(); };
  });
}
