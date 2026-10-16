/**
 * The CLI help and the MCP tool table, read from the built client when the site is built.
 *
 * `HELP` is the text `ahpc help` prints and `TOOLS` is the table `ahpc mcp`
 * serves, so neither page can disagree with the client. The modules are
 * imported from `dist/src`, so `npm run build` runs before the site is built.
 */

import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** One argument of a tool. */
export interface ArgumentRow {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

/** One tool as `tools/list` describes it. */
export interface ToolRow {
  name: string;
  /** The `--mcp-tools` group that serves it, or `core` for the tools always served. */
  group: string;
  title: string;
  description: string;
  readOnly: boolean;
  arguments: ArgumentRow[];
}

export interface Reference {
  help: string;
  groups: string[];
  tools: ToolRow[];
}

export declare const data: Reference;

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../../dist/src');

/** A module of the built client. */
const load = (path: string): Promise<any> => import(pathToFileURL(resolve(DIST, path)).href);

/** A schema's type in a few words: `string`, `string[]`, `turn | input | idle`. */
const typeOf = (schema: Record<string, any>): string => {
  if (Array.isArray(schema.enum)) return schema.enum.join(' | ');
  if (schema.type === 'array') return `${schema.items?.type ?? 'any'}[]`;
  return String(schema.type ?? 'any');
};

export default {
  watch: ['../../../dist/src/cli/main.js', '../../../dist/src/mcp/tools.js'],
  async load(): Promise<Reference> {
    const { HELP } = await load('cli/main.js');
    const { GROUPS, TOOLS } = await load('mcp/tools.js');
    return {
      help: HELP,
      groups: ['core', ...GROUPS],
      tools: TOOLS.map((tool: any): ToolRow => ({
        name: tool.name,
        group: tool.group ?? 'core',
        title: tool.title,
        description: tool.description,
        readOnly: tool.readOnly,
        arguments: Object.entries(tool.input.properties as Record<string, any>).map(([name, schema]) => ({
          name,
          type: typeOf(schema),
          required: (tool.input.required ?? []).includes(name),
          description: schema.description ?? '',
        })),
      })),
    };
  },
};
