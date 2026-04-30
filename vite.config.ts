import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import crypto from "crypto";
import { componentTagger } from "lovable-tagger";

// Build-time version metadata. Regenerated on every `vite build` invocation,
// so each published deploy carries a unique hash you can read from the footer.
const BUILD_TIME = new Date().toISOString();
const BUILD_HASH = crypto
  .createHash("sha256")
  .update(BUILD_TIME)
  .digest("hex")
  .slice(0, 7);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __BUILD_HASH__: JSON.stringify(mode === "development" ? "dev" : BUILD_HASH),
    __BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
}));
