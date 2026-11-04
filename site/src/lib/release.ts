// Release-dependent wording. Contract sidecars and the browser-safe core are on main but not in a
// published release until the toolkit version moves past 0.3.1. The release commit bumps the version
// (docs/publishing.md), so "next release" notes disappear from the site in that same commit.
import { readRepoJson } from './repo';

const LAST_RELEASE_WITHOUT_SIDECARS = '0.3.1';

export const TOOLKIT_VERSION = readRepoJson<{ version: string }>('package.json').version;

function newer(version: string, than: string): boolean {
  const parse = (text: string): number[] => text.split('-')[0]!.split('.').map(Number);
  const a = parse(version);
  const b = parse(than);
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
}

/** True once a toolkit release includes contract sidecars. */
export const SIDECARS_RELEASED = newer(TOOLKIT_VERSION, LAST_RELEASE_WITHOUT_SIDECARS) && !TOOLKIT_VERSION.includes('-');
