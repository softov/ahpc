import { releases, type Release } from '../.vitepress/releases';

/** The releases, for the archive page. */
declare const data: Release[];
export { data };

export default {
  watch: ['./v*.md'],
  load: (): Release[] => releases(),
};
