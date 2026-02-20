import { defineConfig } from "astro/config"
import vercel from "@astrojs/vercel"
import react from "@astrojs/react"
import mdx from "@astrojs/mdx"
import sitemap from "@astrojs/sitemap"
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  site: "https://convexforgets.com",
  output: "static",
  adapter: vercel({
    imageService: true,
  }),
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
