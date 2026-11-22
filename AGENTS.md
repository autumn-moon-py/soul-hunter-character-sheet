# AGENTS.md

《狩魂者 TRPG》在线车卡器。Next.js 16 + React 19 + TypeScript + Tailwind + Zustand，数据存浏览器 localStorage，无后端。

## 常用命令

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm test           # vitest run
npm run build
npm run ai         # 本地 AI 助手服务：stdio MCP + 网页数据桥（127.0.0.1:4317）
npm run ai:build   # 打包 MCP 服务到 mcp/dist
```

交付前至少跑 `typecheck`、`test`、`build`；涉及界面的改动再用浏览器实际点一遍。

## 目录

- `app/`：App Router 入口与全局样式 `globals.css`
- `components/soulhunter/`：纸面、卡牌区块、存档/导出/检查弹窗、底部工具条
- `components/ui/`：shadcn/Radix 基础组件
- `src/rules/`：纯函数规则（属性推导、配额、校验、成长、字数统计）
- `src/content/`：由 `content/*.json` 组装的卡牌目录
- `content/`：规则数据 JSON，来源为上级目录的规则书
- `lib/soulhunter/`：Zustand store、localStorage 存档、HTML/骰娘导出
- `mcp/`：本地 AI 助手服务，MCP 工具复用 `src/rules`，网页通过 `lib/soulhunter/bridge.ts` 同步角色
- `scripts/`：内容抽取与校验脚本（Python）

## 关键约定

- 界面与代码注释使用简体中文；不输出 emoji。
- 存档结构 `schemaVersion: 1`，键为 `soul-hunter.saves.v1`、`soul-hunter.save.v1.<id>`、`soul-hunter.current.v1`。改字段时必须兼容 HTML/JSON 导入的旧数据。
- 纸面视觉集中在 `app/globals.css` 的 `.paper` / `.pc-*` 规则。这些是未分层 CSS，优先级高于 Tailwind 工具类；调字号、行高、边框时优先改这里。
- 灵能力字数只统计汉字（`hanLength`），标点、符号、数字不计。
- 导出的角色卡 HTML 通过克隆实时 `.paper` DOM + 内联当前样式表生成：
  - 除备注外，输入框只读且不可聚焦；
  - 新增、替换、步进、下拉等编辑控件不导出；
  - 折叠卡片保留可点击的「展开/收起」；
  - 「升级」卡片不导出。
- 骰娘指令只包含核心录卡字段，不加入事件业力等拓展内容。
- 拓展（边缘人、子夜生物改造、惊吓盒子等）暂缓，数据与 UI 未接入。

## 部署

- 纯静态站，`npm run build` 产出 `out/`。
- 线上三处，均已连接 GitHub `main`，push 后自动构建：
  - Cloudflare Pages：`sh-cf.subrecovery.top`
  - Vercel：`sh-vercel.subrecovery.top`
  - Netlify：`sh-nf.subrecovery.top`
- 构建命令 `npm run build`，输出目录 `out`。
- 手动部署：`npm run deploy:cf`、`deploy:vercel`、`deploy:nf`、`deploy:all`；Vercel 本机需开代理。
- 版本号：`next.config.mjs` 构建时取 git 日期与短哈希，写入 `NEXT_PUBLIC_APP_VERSION` 和 `<meta name="app-version">`，页面右下角显示。核对线上版本用 `curl -s <地址>/ | grep app-version`。
- `wrangler` 不要放进 `devDependencies`：其 `@cloudflare/workers-utils` 的 vitest peer 与本项目 vitest 3 冲突，会导致 Cloudflare 构建的 `npm ci` 失败，统一用 `npx --yes wrangler@latest`。
- IGA Pages、BytePlus Edge Pages 已弃用。

## Git

- 未经用户明确授权，不执行 `git add`、`git commit`、`git push` 等写操作。
- 提交信息用中文，说明改了什么与为什么。
- 作者按项目约定配置，不擅自使用其他身份。
