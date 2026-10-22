import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { type Plugin, defineConfig } from "vite";

const PUBLISHED = "https://lmgarret.github.io/eu-model-catalog/catalog.json";

/** In dev, serves dist/catalog.json from `pnpm build:data`, or the published one if there is none. */
function devCatalog(): Plugin {
  return {
    name: "dev-catalog",
    configureServer(server) {
      server.middlewares.use("/catalog.json", (_req, res) => {
        const local = path.resolve("dist/catalog.json");
        res.setHeader("content-type", "application/json");
        if (existsSync(local)) return res.end(readFileSync(local));
        fetch(PUBLISHED)
          .then((r) => r.text())
          .then((t) => res.end(t), (err: unknown) => res.writeHead(502).end(String(err)));
      });
    },
  };
}

export default defineConfig({
  root: "site",
  // Relative, so the site works under the Pages subpath.
  base: "./",
  plugins: [tailwindcss(), svelte(), devCatalog()],
  resolve: { alias: { $lib: path.resolve("site/src/lib") } },
  build: { outDir: "../dist", emptyOutDir: true },
});
