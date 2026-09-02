import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { PreviewServer, ViteDevServer } from "vite";
import { defineConfig } from "vite";

const ANVIL = "http://127.0.0.1:8545";

function anvilProxy() {
  const mount = (server: ViteDevServer | PreviewServer) => {
    server.middlewares.use((req, res, next) => {
      const path = req.url?.split("?")[0] ?? "";
      if (path !== "/rpc" && path !== "/rpc/") {
        next();
        return;
      }
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        const body = Buffer.concat(chunks);
        fetch(ANVIL, {
          method: req.method ?? "POST",
          headers: { "content-type": "application/json" },
          body,
        })
          .then(async (r) => {
            const text = await r.text();
            res.statusCode = r.status;
            res.setHeader("content-type", "application/json");
            res.end(text);
          })
          .catch((err: Error) => {
            res.statusCode = 502;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: err.message }));
          });
      });
    });
  };

  return {
    name: "anvil-rpc-proxy",
    configureServer: mount,
    configurePreviewServer: mount,
  };
}

export default defineConfig({
  plugins: [anvilProxy(), react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 43173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: "0.0.0.0",
    port: 43173,
    strictPort: true,
    allowedHosts: true,
  },
});
