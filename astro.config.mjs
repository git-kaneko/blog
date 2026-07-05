import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import rehypePrettyCode from 'rehype-pretty-code';
import { siteConfig } from './src/config';
import remarkLinkCard from './src/plugins/remark-link-card.mjs';

import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: siteConfig.site,
  integrations: [tailwind(), sitemap()],
  markdown: {
    remarkPlugins: [remarkLinkCard],
    rehypePlugins: [
      [rehypePrettyCode, {
        theme: 'github-dark',
        onVisitLine(node) {
          if (node.children.length === 0) {
            node.children = [{type: 'text', value: ' '}];
          }
        },
      }],
    ],
  },
});