import { defineConfig } from "tsup";

// 单入口 transformer 插件，构建为 ESM 给 Quartz v5 加载器消费。
// SSE 在 SSR 阶段不渲染任何 JSX，无需 preact JSX runtime。
// 内联浏览器脚本以字符串字面量形式内嵌在 transformer 里，由 Quartz util/resources.tsx
// 作为 contentType:"inline" 直接注入 URL <script>，不经过 bundler 解析。

const SINGLETON_EXTERNALS = [
  "@quartz-community/types",
  "hast",
  "@types/hast",
  "@types/unist",
  "vfile",
  "vfile/*",
  "unified",
  // unist-util-visit IS bundled (small, no singleton contract)
];

export default defineConfig({
  entry: { index: "src/index.ts" },
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.json",
  sourcemap: true,
  clean: true,
  treeshake: true,
  target: "es2022",
  splitting: false,
  outDir: "dist",
  platform: "node",
  noExternal: [/.*/],
  external: SINGLETON_EXTERNALS,
  banner: {
    js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
});