import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import path from "path";

export default defineConfig({
  server: {
    host: "localhost",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, "../dist"),
    emptyOutDir: true,
    target: "es2024",
    rollupOptions: {
      // Multi-page input: redirect.html is the MSAL v5 redirect bridge for COOP-protected
      // Entra ID flows. Must be served WITHOUT Cross-Origin-Opener-Policy headers and
      // listed as a redirect URI in the Entra ID app registration.
      input: {
        main: path.resolve(__dirname, "index.html"),
        redirect: path.resolve(__dirname, "redirect.html"),
      },
      output: {
        manualChunks(id: string) {
          if (id.includes("@radix-ui/")) return "radix";
          if (id.includes("@fluentui/")) return "fluentui";
          if (id.includes("/marked/") || id.includes("/dompurify/")) return "markdown";
          if (id.includes("highcharts")) return "charts";
        },
      },
    },
  },
  plugins: [
    react(),
    svgr({
      // CRA-compatible: import { ReactComponent as X } from './icon.svg'
      svgrOptions: { exportType: "named", ref: true },
      include: "**/*.svg",
    }),
    tailwindcss(),
  ],
  define: {
    // CRA→Vite: Elevate uses process.env.REACT_APP_* which CRA inlines at build time.
    // Vite uses import.meta.env.VITE_* instead. This shim maps common ones.
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || "development"),
    "process.env.PUBLIC_URL": JSON.stringify(""),
    "process.env.REACT_APP_MODEL_ENDPOINT": JSON.stringify(
      process.env.VITE_MODEL_ENDPOINT || "copilot"
    ),
    "process.env.REACT_APP_ANTHROPIC_API_KEY": JSON.stringify(
      process.env.VITE_ANTHROPIC_API_KEY || ""
    ),
    "process.env.REACT_APP_APP_SECRET_KEY": JSON.stringify(
      process.env.VITE_APP_SECRET_KEY || ""
    ),
    "process.env.REACT_APP_DEXTER_API_URL": JSON.stringify(
      process.env.VITE_DEXTER_API_URL || ""
    ),
    "process.env.REACT_APP_DEXTER_ROUTER_URL": JSON.stringify(
      process.env.VITE_DEXTER_ROUTER_URL || ""
    ),
    "process.env.REACT_APP_DEXTER_MACHINES_URL": JSON.stringify(
      process.env.VITE_DEXTER_MACHINES_URL || ""
    ),
    "process.env.REACT_APP_AUTH_CLIENT_ID": JSON.stringify(
      process.env.VITE_AUTH_CLIENT_ID || ""
    ),
    "process.env.REACT_APP_AUTH_API_SCOPE": JSON.stringify(
      process.env.VITE_AUTH_API_SCOPE || ""
    ),
    "process.env.REACT_APP_AUTH_ROUTER_SCOPE": JSON.stringify(
      process.env.VITE_AUTH_ROUTER_SCOPE || ""
    ),
    "process.env.REACT_APP_AUTH_REDIRECT_URI": JSON.stringify(
      process.env.VITE_AUTH_REDIRECT_URI || ""
    ),
    "process.env.REACT_APP_AUTH_DISABLED": JSON.stringify(
      process.env.VITE_AUTH_DISABLED || "true"
    ),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
