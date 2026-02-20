import { defineConfig } from "astro/config"
import react from "@astrojs/react"
import mdx from "@astrojs/mdx"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  site: "https://convexforgets.com",
  output: "static",
  trailingSlash: "always",
  integrations: [
    react(),
    mdx(),
    sitemap({
      filter: (page) => !page.includes("/app/"),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
})
