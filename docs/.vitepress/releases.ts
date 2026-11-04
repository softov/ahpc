import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The `docs/updates/` folder: one `v<major>_<minor>.md` page for each minor release. */
const UPDATES = resolve(dirname(fileURLToPath(import.meta.url)), '../updates');

/** One minor release, as its page names it. */
export interface Release {
  /** The minor version, such as `0.14`. */
  version: string;
  /** The page's site path, such as `/updates/v0_14`. */
  link: string;
  /** The date of the release's `.0`, from the page's `date`, as `YYYY-MM-DD`. */
  date: string;
}

/** Every release page in `docs/updates/`, newest first. */
export const releases = (): Release[] => readdirSync(UPDATES).flatMap((entry) => {
  const name = /^v(\d+)_(\d+)\.md$/.exec(entry);
  if (!name) return [];
  const text = readFileSync(join(UPDATES, entry), 'utf8');
  const date = /^date:\s*(\S+)\s*$/m.exec(text)?.[1];
  if (date === undefined) throw new Error(`docs/updates/${entry}: no date in its front matter`);
  return [{ version: `${name[1]}.${name[2]}`, link: `/updates/${entry.slice(0, -3)}`, date }];
}).sort((a, b) => {
  const [aMajor, aMinor] = a.version.split('.').map(Number);
  const [bMajor, bMinor] = b.version.split('.').map(Number);
  return bMajor! - aMajor! || bMinor! - aMinor!;
});
