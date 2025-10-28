import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: { open: true },
  build: { outDir: "web-dist", emptyOutDir: true }
});
