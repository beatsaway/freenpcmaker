import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  // Human rig + Mesh2Motion animation library (vendored under ./static)
  publicDir: resolve(__dirname, "static"),
  server: {
    host: true,
    port: 8770,
    open: "/demo/index.html",
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        demo: resolve(__dirname, "demo/index.html"),
      },
    },
  },
});
