/// <reference types="vitest" />
/// <reference types="vite/client" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { mockDevServerPlugin } from "vite-plugin-mock-dev-server";
import childProcess from "node:child_process";
import { currentToken } from "./mock/token.ts";

let commitHash = "unknown";
try {
  commitHash = childProcess.execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString();
} catch {
  // dépôt sans commit : on garde « unknown »
}

/**
 * Proxy partagé par le serveur de dev et `vite preview` : `/api` part vers
 * l'hôte Azure Functions local (:7071) avec le principal Azure simulé en
 * en-tête, `/.auth` est servi par les mocks (`mock/`), comme Static Web Apps
 * le ferait en production.
 *
 * Sans Azure Functions Core Tools : `pnpm dev:server` dans `apps/api` sert
 * les mêmes routes sur :7071 (scripts/dev-server.ts).
 */
const proxy = {
  "/api": {
    // API_TARGET : une autre instance locale de l'API (port ≠ 7071).
    target: process.env.API_TARGET ?? "http://localhost:7071",
    changeOrigin: true,
    configure: (proxyServer: any) => {
      proxyServer.on("proxyReq", (proxyReq: any, _req: any, res: any) => {
        const token = currentToken.value;
        if (token && token.clientPrincipal) {
          proxyReq.setHeader(
            "x-ms-client-principal-name",
            token.clientPrincipal.userDetails,
          );
          proxyReq.setHeader(
            "x-ms-client-principal",
            Buffer.from(JSON.stringify(token.clientPrincipal)).toString(
              "base64",
            ),
          );
        } else {
          proxyReq.destroy();
          res.writeHead(401, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Unauthorized" }));
        }
      });
    },
  },
  "/.auth": {
    target: "mock",
    changeOrigin: true,
    secure: false,
  },
};

export default defineConfig({
  plugins: [react(), mockDevServerPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
    __COMMIT_HASH__: JSON.stringify(commitHash.trim()),
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.mjs",
    // Formulaires Mantine complets : ~3 s seuls, davantage en parallèle.
    testTimeout: 15_000,
  },
  build: {
    chunkSizeWarningLimit: 1000,
  },
  server: {
    host: "0.0.0.0",
    proxy,
  },
  preview: {
    host: "0.0.0.0",
    proxy,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      "@tabler/icons-react": "@tabler/icons-react/dist/esm/icons/index.mjs",
    },
  },
});
