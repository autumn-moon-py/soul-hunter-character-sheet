import type { SoulHunterCharacter } from "@/src/types";
import { buildDiceBotCommand } from "./export-record";

export const CHARACTER_DATA_SCRIPT_ID = "soul-hunter-character";
export const DICE_COMMAND_SCRIPT_ID = "soul-hunter-dice";

/** 内嵌 JSON：转义 < 以免提前闭合 script，同时保持合法 JSON */
function serializeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export function serializeCharacter(character: SoulHunterCharacter): string {
  return serializeJson(character);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function documentShell(
  character: SoulHunterCharacter,
  headExtra: string,
  body: string,
): string {
  const name = escapeHtml(character.identity.name || "狩魂者");
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${name} · 角色卡</title>
${headExtra}
</head>
<body>
<script type="application/json" id="${CHARACTER_DATA_SCRIPT_ID}">${serializeCharacter(character)}</script>
<script type="application/json" id="${DICE_COMMAND_SCRIPT_ID}">${serializeJson(buildDiceBotCommand(character))}</script>
${body}
</body>
</html>`;
}

/** 仅生成带内嵌数据的 HTML 外壳；可视部分在导出时从实时 DOM 克隆 */
export function buildCharacterHtml(character: SoulHunterCharacter): string {
  return documentShell(character, "", "");
}

/** 合并当前页面加载的所有样式表，让导出文件复用编辑预览的样式 */
function collectStyles(): string {
  const rules: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let cssRules: CSSRuleList;
    try {
      cssRules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of Array.from(cssRules)) {
      rules.push(rule.cssText);
    }
  }
  return rules.join("\n");
}

/** 克隆纸面并落定表单当前值：去除编辑控件，除备注外全部只读且不可聚焦 */
function clonePaper(paper: Element): string {
  const clone = paper.cloneNode(true) as HTMLElement;

  // 升级卡片只用于成长操作，不随角色卡导出
  clone.querySelectorAll(".paper-block").forEach((block) => {
    const title = block.querySelector(".paper-block-title")?.textContent?.replace(/\s+/g, "");
    if (title === "升级") block.remove();
  });

  // 下拉选择转成纯文本，避免导出文件里残留可交互的编辑态
  clone.querySelectorAll('button[role="combobox"]').forEach((button) => {
    const span = document.createElement("span");
    span.className = button.className.includes("text-center")
      ? "pc-combobox-static is-center"
      : "pc-combobox-static";
    span.textContent = button.textContent?.trim() ?? "";
    if (button.hasAttribute("data-placeholder")) span.setAttribute("data-placeholder", "");
    button.replaceWith(span);
  });

  clone.querySelectorAll("input").forEach((node) => {
    const input = node as HTMLInputElement;
    input.setAttribute("value", input.value);
    input.removeAttribute("disabled");
    input.setAttribute("readonly", "");
    input.setAttribute("tabindex", "-1");
    input.classList.add("export-locked");
  });

  clone.querySelectorAll("textarea").forEach((node) => {
    const textarea = node as HTMLTextAreaElement;
    textarea.textContent = textarea.value;
    textarea.removeAttribute("disabled");
    if (textarea.dataset.exportEditable === "true") return;
    textarea.setAttribute("readonly", "");
    textarea.setAttribute("tabindex", "-1");
    textarea.classList.add("export-locked");
  });

  // 弹窗在导出文件里不可用，未被折叠标记的截断文字直接完整展开
  clone.querySelectorAll(".line-clamp-2, .line-clamp-3").forEach((element) => {
    if (element.hasAttribute("data-export-collapsible")) return;
    element.classList.remove("line-clamp-2", "line-clamp-3");
  });

  // 除展开按钮外，新增/替换/步进等编辑按钮全部移除
  clone.querySelectorAll("button").forEach((button) => {
    if (button.hasAttribute("data-export-expand")) return;
    button.remove();
  });

  return clone.outerHTML;
}

const EXPORT_STYLE = `
body { padding: 16px 12px 32px; }
body > .paper { margin: 0 auto 14px; }
.export-toolbar { position: fixed; top: 14px; right: 14px; z-index: 20; display: flex; gap: 6px; }
.export-toolbar button {
  border: 1px solid #2b2b2b; border-radius: 999px; background: #232323; color: #fff;
  padding: 6px 14px; font-size: 12px; cursor: pointer;
}
.export-dice-panel {
  position: fixed; top: 54px; right: 14px; z-index: 20;
  width: min(420px, calc(100vw - 28px));
  border: 1px solid #2b2b2b; border-radius: 10px; background: #232323; color: #fff;
  padding: 10px 12px 12px; box-shadow: 0 12px 30px -12px rgba(0, 0, 0, 0.45);
}
.export-dice-panel[hidden] { display: none; }
.export-dice-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; }
.export-dice-head > span:first-child { opacity: 0.75; }
.export-dice-actions { display: flex; gap: 6px; }
.export-dice-panel button {
  border: 1px solid #4a4a4a; border-radius: 999px; background: #2f2f2f; color: #fff;
  padding: 3px 10px; font-size: 11px; cursor: pointer;
}
.export-dice-text {
  display: block; margin-top: 8px; max-height: 160px; overflow: auto;
  white-space: pre-wrap; word-break: break-all; font-size: 11px; line-height: 1.6;
  color: #e8e4da; user-select: all;
}
.pc-combobox-static {
  display: flex; width: 100%; min-height: 22px; align-items: center;
  padding: 0 2px; font-size: 11px; color: var(--pc-ink);
}
.pc-combobox-static.is-center { justify-content: center; }
.pc-combobox-static[data-placeholder] { color: #a89f8c; }
.export-locked { pointer-events: none; }
@media print {
  body { padding: 0; background: #fff; }
  .export-toolbar { display: none !important; }
  .export-dice-panel { display: none !important; }
  .paper { break-after: page; }
  .paper:last-of-type { break-after: auto; }
}
`;

const EXPORT_SCRIPT = `
document.querySelectorAll('textarea[data-export-editable="true"]').forEach(function (el) {
  var resize = function () {
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  };
  el.addEventListener("input", resize);
  resize();
});

document.querySelectorAll('button[data-export-expand]').forEach(function (button) {
  button.addEventListener('click', function () {
    var article = button.closest('article');
    var target = article && article.querySelector('[data-export-collapsible]');
    if (!target) return;
    var cls = target.getAttribute('data-export-clamp') || 'line-clamp-2';
    var collapsed = target.classList.toggle(cls);
    var label = article.querySelector('[data-export-label]');
    if (label) label.textContent = collapsed ? '展开' : '收起';
  });
});

(function () {
  var node = document.getElementById("${DICE_COMMAND_SCRIPT_ID}");
  var panel = document.querySelector("[data-export-dice-panel]");
  var trigger = document.querySelector("[data-export-dice]");
  if (!node || !panel || !trigger) return;

  var text = node.textContent || "";
  try { text = JSON.parse(text); } catch (error) {}
  panel.querySelector("[data-export-dice-text]").textContent = text;

  trigger.addEventListener("click", function () {
    panel.hidden = !panel.hidden;
  });
  panel.querySelector("[data-export-dice-close]").addEventListener("click", function () {
    panel.hidden = true;
  });

  var copyButton = panel.querySelector("[data-export-dice-copy]");
  copyButton.addEventListener("click", function () {
    var feedback = function (label) {
      copyButton.textContent = label;
      setTimeout(function () { copyButton.textContent = "复制"; }, 1500);
    };
    var fallback = function () {
      var area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (error) { ok = false; }
      area.remove();
      feedback(ok ? "已复制" : "复制失败");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { feedback("已复制"); }, fallback);
    } else {
      fallback();
    }
  });
})();
`;

/** 以实时纸面 DOM 生成导出 HTML，保证与编辑预览一致 */
export function buildCharacterPageHtml(character: SoulHunterCharacter): string {
  const papers = Array.from(document.querySelectorAll(".paper")).map(clonePaper).join("\n");
  return documentShell(
    character,
    `<style>\n${collectStyles()}\n${EXPORT_STYLE}\n</style>`,
    `<div class="export-toolbar no-print">
<button type="button" data-export-dice>骰娘导出</button>
<button type="button" onclick="window.print()">导出 PDF</button>
</div>
<div class="export-dice-panel no-print" data-export-dice-panel hidden>
<div class="export-dice-head"><span>骰娘录卡指令</span><span class="export-dice-actions"><button type="button" data-export-dice-copy>复制</button><button type="button" data-export-dice-close>关闭</button></span></div>
<code class="export-dice-text" data-export-dice-text></code>
</div>
${papers}
<script>${EXPORT_SCRIPT}</script>`,
  );
}

export function exportCharacterHtml(character: SoulHunterCharacter): void {
  const html = buildCharacterPageHtml(character);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const name = (character.identity.name || "狩魂者").replace(/[\\/:*?"<>|]/g, "");
  link.href = url;
  link.download = `${name}-角色卡.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
