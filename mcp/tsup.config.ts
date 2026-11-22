import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export default defineConfig({
  entry: {
    server: "mcp/server.ts",
    daemon: "mcp/daemon.ts",
  },
  format: ["esm"],
  outDir: "mcp/dist",
  clean: true,
  sourcemap: true,
  target: "node20",
  external: ["@modelcontextprotocol/sdk", "zod"],
  esbuildOptions(options) {
    options.alias = { "@": projectRoot };
  },
});
