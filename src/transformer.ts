// Markmap transformer —— 在 raw Markdown 阶段用 textTransform 把 ` ```markmap `
// 围栏代码块替换为占位 <div>，浏览器侧通过内联脚本 hydrate 成交互式思维导图。
//
// 设计依据：
//   * Quartz v5 transformer 形态，textTransform 比 htmlPlugins 更可靠（不与其他 rehype 插件冲突）
//   * 浏览器脚本以 contentType:"inline" 注入，spaPreserve:true 适配 SPA 导航
//   * markmap-lib / markmap-view 通过 ESM 动态 import 自 jsdelivr CDN，SSR 零依赖
import type { QuartzTransformerPlugin } from "@quartz-community/types";

// —————————————————————————————————— options

export interface MarkmapOptions {
  /** 允许平移 */
  pan?: boolean;
  /** 允许缩放 */
  zoom?: boolean;
  /** 占位容器高度（px） */
  height?: number;
  /** 自定义 markmap-lib / markmap-view ESM CDN URL。默认 jsdelivr 0.18 minor */
  cdn?: {
    lib?: string;
    view?: string;
  };
}

// —————————————————————————————————— plugin

export const Markmap: QuartzTransformerPlugin<Partial<MarkmapOptions>> = (opts) => {
  const pan = opts?.pan ?? true;
  const zoom = opts?.zoom ?? true;
  const height = opts?.height ?? 600;
  const libUrl =
    opts?.cdn?.lib ?? "https://cdn.jsdelivr.net/npm/markmap-lib@0.18/+esm";
  const viewUrl =
    opts?.cdn?.view ?? "https://cdn.jsdelivr.net/npm/markmap-view@0.18/+esm";

  // 浏览器内联脚本字符串。此处是纯文本，不经过 esbuild。
  // 关键点：
  //   - 监听 Quartz SPA 自定义事件 "nav"：每次页面切换后重新 hydrate
  //   - 用 Map<element, Markmap 实例> 去重，避免重复 init
  //   - 动态 ESM import CDN，缓存到 window.__quartzMarkmapLib 防止重复加载
  //   - base64 → UTF-8 解码用 TextDecoder（浏览原生，无 escape/uri 兼容问题）
  //   - 深浅色随 <html data-theme> 切换重建（markmap-view v0.18 read SVG color from CSS）
  const hydrateScript = `
(function () {
  if (window.__quartzMarkmapBooted) return;
  window.__quartzMarkmapBooted = true;
  var INSTANCES = new Map();
  function b64ToUtf8(b) {
    var bin = atob(b);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  }
  function isDark() {
    var t = document.documentElement.getAttribute("data-theme");
    if (t) return t === "dark";
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  }
  function ensureLib() {
    if (window.__quartzMarkmapLib) return window.__quartzMarkmapLib;
    window.__quartzMarkmapLib = Promise.all([
      import(${JSON.stringify(libUrl)}),
      import(${JSON.stringify(viewUrl)}),
    ]).then(function (m) {
      return { Transformer: m[0].Transformer, Markmap: m[1].Markmap };
    });
    return window.__quartzMarkmapLib;
  }
  function hydrateEl(el) {
    if (INSTANCES.has(el)) return;
    var raw = el.getAttribute("data-source") || "";
    var pan = el.getAttribute("data-pan") !== "false";
    var zoom = el.getAttribute("data-zoom") !== "false";
    var h = parseInt(el.getAttribute("data-height") || "600", 10) || 600;
    var md = b64ToUtf8(raw);
    ensureLib().then(function (lib) {
      try {
        var t = new lib.Transformer();
        var _a = t.transform(md || "# (empty)\\n"), root = _a.root;
        // 视觉容器
        var wrap = document.createElement("div");
        wrap.className = "quartz-markmap-wrap";
        wrap.style.width = "100%";
        wrap.style.height = h + "px";
        wrap.style.background = isDark() ? "#161618" : "#faf8f8";
        wrap.style.borderRadius = "8px";
        wrap.style.border = "1px solid var(--lightgray, #e5e5e5)";
        wrap.style.overflow = "hidden";
        var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.color = isDark() ? "#ebebec" : "#2b2b2b";
        wrap.appendChild(svg);
        // 清掉 loading 占位
        el.innerHTML = "";
        el.appendChild(wrap);
        var mm = lib.Markmap.create(svg, { autoResize: true, pan: pan, zoom: zoom }, root);
        INSTANCES.set(el, { mm: mm, root: root, opts: { pan: pan, zoom: zoom }, svg: svg, wrap: wrap });
        // 异步 fit 一次，让初始视图贴合内容
        requestAnimationFrame(function () {
          try { mm.fit(); } catch (e) {}
        });
      } catch (e) {
        el.innerHTML = '<div class="quartz-markmap-error">思维导图渲染失败：' + (e && e.message ? e.message : e) + "</div>";
      }
    });
  }
  function hydrateAll() {
    var els = document.querySelectorAll(".quartz-markmap:not([data-mm-ready])");
    els.forEach(function (el) {
      el.setAttribute("data-mm-ready", "1");
      hydrateEl(el);
    });
  }
  // cold-load + SPA 每次 nav 后触发
  document.addEventListener("nav", hydrateAll);
  // 主题切换时重建（markmap 不能热切色，整体重建最稳）
  var themeObs = new MutationObserver(function (mutations) {
    for (var i = 0; i < mutations.length; i++) {
      if (mutations[i].attributeName === "data-theme") {
        INSTANCES.forEach(function (entry, el) {
          try { entry.wrap.style.background = isDark() ? "#161618" : "#faf8f8"; entry.svg.style.color = isDark() ? "#ebebec" : "#2b2b2b"; entry.mm.fit(); } catch (e) {}
        });
        return;
      }
    }
  });
  themeObs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  // 首次（Quartz 在 afterDOMReady 注入，DOM 已就绪；但 SPA 的 nav 也会再 fire）
  hydrateAll();
})();
`;

  return {
    name: "Markmap",
    // 用 textTransform 替代 htmlPlugins: 在 raw Markdown 阶段做字符串替换，
    // 避免与 syntax-highlighting / pretty-code 等 rehype 阶段插件冲突
    textTransform(_ctx: unknown, src: string): string {
      const raw = typeof src === "string" ? src : src.toString("utf8");
      const heightStr = String(height);

      // 匹配 ```markmap ... ``` 围栏代码块（含可选 info string 尾随）
      return raw.replace(
        /```markmap\s*\n([\s\S]*?)```/g,
        (_match: string, body: string) => {
          const encoded = Buffer.from(body.trim(), "utf8").toString("base64");
          return [
            `<div class="quartz-markmap" data-source="${encoded}"`,
            ` data-pan="${String(pan)}" data-zoom="${String(zoom)}"`,
            ` data-height="${heightStr}">`,
            '<div class="quartz-markmap-loading">思维导图加载中…</div>',
            "</div>",
          ].join("");
        },
      );
    },
    externalResources() {
      return {
        js: [
          {
            contentType: "inline",
            script: hydrateScript,
            loadTime: "afterDOMReady",
            spaPreserve: true,
          },
        ],
      };
    },
  };
};