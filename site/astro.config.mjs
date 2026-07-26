import mdx from "@astrojs/mdx";
import { unified } from "@astrojs/markdown-remark";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

import { restrictedMdxPolicy } from "./src/lib/restricted-mdx-policy.ts";

export default defineConfig({
  site: "https://dantech0xff.github.io",
  base: "/pencil-blade-2026",
  output: "static",
  trailingSlash: "always",
  devToolbar: {
    enabled: false,
  },
  build: {
    format: "directory",
  },
  i18n: {
    defaultLocale: "en",
    locales: ["en", "vi"],
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },
  markdown: {
    processor: unified({
      remarkPlugins: [restrictedMdxPolicy],
    }),
  },
  integrations: [
    mdx(),
    sitemap(),
  ],
});
