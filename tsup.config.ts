import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["esm"],
  target: "node20",
  clean: true,
  dts: true,
  sourcemap: false,
  // cli.ts 첫 줄의 #!/usr/bin/env node shebang은 esbuild가 그대로 보존한다
});
