// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://gist.1mb.dev',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/admin'),
    }),
  ],
  build: {
    format: 'directory',
  },
  vite: {
    build: {
      cssMinify: true,
    },
  },
});
