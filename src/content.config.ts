/**
 * Album stories: the Markdown body of each `index.md`, rendered by Astro's own Markdown
 * pipeline (no extra dependency). The content engine stays the single parser of
 * `index.md`: this loader takes the story text it extracted and only renders it, so
 * frontmatter rules and error messages live in one place (src/lib/content/schemas.ts).
 *
 * Entry ids are slug paths (`demo-event-a/day-2`), the same keys as `Albums.nodes`.
 */
import { defineCollection } from 'astro:content';
import type { Loader } from 'astro/loaders';
import { z } from 'astro/zod';
import { resolve, sep } from 'node:path';
import { ALBUMS_DIR } from './lib/config.ts';
import { loadAlbums, slugPathKey } from './lib/content/index.ts';

function albumStories(): Loader {
  return {
    name: 'album-stories',
    async load({ store, renderMarkdown, generateDigest, watcher, logger }) {
      const sync = async () => {
        // Drafts and hidden albums included: pages simply never ask for a story they do not show.
        // Content errors are reported (and fail the build) by the pages, with full messages.
        const albums = await loadAlbums({ includeDrafts: true, includeHidden: true });
        store.clear();
        for (const node of albums.nodes.values()) {
          if (node.depth === 0 || !node.story) continue;
          const id = slugPathKey(node.slugPath);
          store.set({ id, data: {}, body: node.story, rendered: await renderMarkdown(node.story), digest: generateDigest(node.story) });
        }
      };
      await sync();

      // In `astro dev`, re-render when an index.md changes.
      const albumsDir = resolve(ALBUMS_DIR) + sep;
      watcher?.on('all', (_event, path) => {
        if (resolve(path).startsWith(albumsDir) && /index\.md$/i.test(path)) {
          sync().catch((error: unknown) => logger.error(String(error)));
        }
      });
    },
  };
}

export const collections = {
  stories: defineCollection({ loader: albumStories(), schema: z.object({}) }),
};
