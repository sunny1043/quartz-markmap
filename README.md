# quartz-markmap

A Quartz v5 transformer plugin that renders ` ```markmap ` fenced code blocks as **interactive mind maps** in the browser, powered by [markmap-lib](https://github.com/markmap/markmap) + [markmap-view](https://github.com/markmap/markmap) loaded on-demand from a CDN.

- **Zero build-time dependencies on d3/markmap** — the heavy lifting happens client-side via dynamic ESM `import()`.
- **SSR-safe** — server output is a `<div class="quartz-markmap">` placeholder with the source Markdown base64-encoded in `data-source`; no JS runs during `npx quartz build`.
- **Theme-aware** — re-fits and recolors when Quartz toggles between light/dark.
- **SPA-friendly** — listens to Quartz's custom `nav` event so mindmaps hydrate after every in-app navigation.

## Install

In your Quartz site's `quartz.config.yaml`:

```yaml
plugins:
  - source: github:sunny1043/quartz-markmap
    enabled: true
    order: 35            # between obsidian-flavored-markdown(30) and github-flavored-markdown(40)
    options:
      pan: true
      zoom: true
      height: 600
```

Then:

```bash
cd path/to/your/quartz
npm run install-plugins
npx quartz build --serve
```

## Use

Anywhere in a Markdown note:

~~~~markdown
```markmap
# 线性代数
## 行列式
- 性质
- 展开
## 矩阵
- 秩
- 逆
```
~~~~

The fenced content is treated as plain Markdown (headings + nested lists) by `markmap-lib` and rendered into a pannable, zoomable SVG mind map.

## Options

| option | type | default | description |
| --- | --- | --- | --- |
| `pan` | boolean | `true` | Allow dragging to pan the mind map |
| `zoom` | boolean | `true` | Allow scroll/Pinch to zoom |
| `height` | number | `600` | Rendered container height in pixels |
| `cdn.lib` | string | jsdelivr `markmap-lib@0.18` | ESM URL for `markmap-lib` |
| `cdn.view` | string | jsdelivr `markmap-view@0.18` | ESM URL for `markmap-view` |

## Compatibility

- Quartz `>=5.0.0`
- Node `>=22`
- Modern browsers with native ESM dynamic `import()`

## License

MIT © Sunny