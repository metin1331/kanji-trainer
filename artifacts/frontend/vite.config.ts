import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { kuromojiDictPlugin } from "./vite.kuromoji-dict";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const frontendDir = path.resolve(import.meta.dirname);
const repoRoot = path.resolve(frontendDir, "../..");

export default defineConfig(async ({ mode }) => {
  const rawPort = process.env.PORT ?? "3000";
  const port = Number(rawPort);
  const backendPort = process.env.BACKEND_PORT ?? "8080";

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  const basePath = process.env.BASE_PATH ?? "/";

  // Monorepo: read .env from repo root; Vercel injects VITE_* into process.env at build time.
  const envFromFiles = loadEnv(mode, repoRoot, "");
  const viteApiOrigin = (
    process.env.VITE_API_ORIGIN ??
    envFromFiles.VITE_API_ORIGIN ??
    ""
  )
    .trim()
    .replace(/\/+$/, "");

  const viteDemoModeRaw = (
    process.env.VITE_DEMO_MODE ??
    envFromFiles.VITE_DEMO_MODE ??
    ""
  )
    .trim()
    .toLowerCase();
  const viteDemoMode =
    viteDemoModeRaw === "true" || viteDemoModeRaw === "1" ? "true" : "";

  if (mode === "production" && !viteApiOrigin) {
    console.warn(
      "[vite] VITE_API_ORIGIN is not set — production will request relative /api/* (404 on Vercel without a proxy).",
    );
  }

  if (mode === "production" && viteDemoMode) {
    console.log("[vite] VITE_DEMO_MODE enabled (CV portfolio build)");
  }

  return {
    base: basePath,
    envDir: repoRoot,
    define: {
      "import.meta.env.VITE_API_ORIGIN": JSON.stringify(viteApiOrigin),
      "import.meta.env.VITE_DEMO_MODE": JSON.stringify(viteDemoMode),
    },
    plugins: [
      react(),
      tailwindcss(),
      kuromojiDictPlugin(basePath),
      runtimeErrorOverlay(),
      ...(process.env.NODE_ENV !== "production" &&
      process.env.REPL_ID !== undefined
        ? [
            await import("@replit/vite-plugin-cartographer").then((m) =>
              m.cartographer({ root: repoRoot }),
            ),
            await import("@replit/vite-plugin-dev-banner").then((m) =>
              m.devBanner(),
            ),
          ]
        : []),
    ],
    resolve: {
      alias: {
        "@": path.resolve(frontendDir, "src"),
        "@moji-grade": path.resolve(repoRoot, "artifacts/backend/src/lib/mojiMoriSrs.ts"),
        "@assets": path.resolve(repoRoot, "attached_assets"),
        path: "path-browserify",
      },
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["kuromoji"],
    },
    root: frontendDir,
    build: {
      outDir: path.resolve(frontendDir, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      proxy: {
        "/api": {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true,
        },
      },
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
