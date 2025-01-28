import { defineConfig } from "vite";
import path from "node:path";
import electron from "vite-plugin-electron";
import renderer from "vite-plugin-electron-renderer";
import fs from "fs-extra";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    electron([
      {
        entry: "electron/main.ts",
        onstart(options) {
          // Copia os arquivos da pasta resources para dist-electron no início
          fs.copySync("resources", "dist-electron");
          options.startup();
        },
        vite: {
          build: {
            rollupOptions: {
              external: ["@prisma/client", ".prisma/client"],
            },
          },
        },
      },
      {
        entry: "electron/preload.ts",
        onstart(options) {
          options.reload();
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@pages": path.resolve(__dirname, "./src/pages"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@images": path.resolve(__dirname, "./src/assets"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@interfaces": path.resolve(__dirname, "./src/interfaces"),
    },
  },
});
