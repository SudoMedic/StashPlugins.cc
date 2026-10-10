// @ts-check
import { defineConfig } from 'astro/config';

// SITE_URL / BASE_PATH let the same build run on a custom domain or a
// github.io project path (BASE_PATH=/StashPlugins.cc/).
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://stashplugins.cc',
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'always',
  build: { format: 'directory' },
});
