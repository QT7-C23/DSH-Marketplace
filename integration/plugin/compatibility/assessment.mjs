import semver from 'semver';
import { projectManifest } from '@dsh-std/manifest';

/** A declaration or negotiation result is never a claim that code has run successfully. */
export function assessCompatibility(candidate, environment, route, adapter) {
  if (!route && candidate.routes.length === 1) route = candidate.routes[0];
  const result = (state, issues = []) => ({ route: route || null, state, issues });
  if (!route || !candidate.routes.includes(route)) return result('route-required');
  // Both runtimes auto-discover their own declaration. A route label cannot prevent double activation.
  if (candidate.routes.length > 1) return result('incompatible', ['dual-entry']);
  if (environment.hostVersion === '0.1.5-rc.2' && candidate.name === 'dsh-theme-machine' && candidate.version === '0.1.3') return result('incompatible', ['theme-startup']);
  const observed = environment.hostVersion !== '0.1.5-rc.2' ? []
    : candidate.name === 'dsh-skin-galactic-opera' && candidate.version === '0.2.1' ? ['theme-contrast']
    : candidate.name === '@kubor/dsh-bloom-theme' && candidate.version === '0.12.0' ? ['theme-interaction'] : [];
  const range = candidate.packageManifest.engines?.dsh;
  if (range !== undefined && (!semver.validRange(range) || !semver.valid(environment.hostVersion) || !semver.satisfies(environment.hostVersion, range))) return result('incompatible', ['host-version']);
  const node = candidate.packageManifest.engines?.node;
  if (node !== undefined && (!semver.validRange(node) || !semver.satisfies(environment.nodeVersion || process.versions.node, node))) return result('incompatible', ['node-version']);
  const peers = Object.entries(candidate.packageManifest.peerDependencies || {}).filter(([name]) => /^@deepseek-ai\/dsh(?:-[a-z0-9-]+)?$/.test(name));
  let peersVerified = peers.length > 0 && typeof environment.packageVersion === 'function';
  if (peersVerified) for (const [name, required] of peers) {
    const actual = environment.packageVersion(name);
    if (!actual && candidate.packageManifest.peerDependenciesMeta?.[name]?.optional) { peersVerified = false; continue; }
    if (!semver.validRange(required) || !semver.valid(actual) || !semver.satisfies(actual, required)) return result('incompatible', ['host-version']);
  }
  if (route === 'native') return result(range || peersVerified ? 'declared' : 'unverified', observed);
  if (!adapter) return result('adapter-required');
  const manifest = candidate.standardManifest;
  if (!manifest || manifest.facets.host.apiVersion !== 'v1alpha1') return result('incompatible', ['host-facet-version']);
  try {
    const validation = adapter.manifestDefinitions.validate(projectManifest(manifest), adapter.protocols);
    if (!validation.compatible || validation.issues.length) return result('incompatible', ['manifest-definition']);
    const host = adapter.describe().runtime.declaration;
    const report = adapter.protocols.negotiate([host, { participant: { id: 'market-preflight' }, requires: manifest.requires.contracts }]);
    return result(report.compatible ? 'negotiated' : 'incompatible', [...new Set(report.issues.map(issue => issue.code))]);
  } catch { return result('incompatible', ['invalid-contract']); }
}
