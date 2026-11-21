# 狩魂者车卡器

Next.js 16 + React 19 + TypeScript 的《狩魂者 TRPG》角色卡工具，数据保存在浏览器 localStorage，角色卡可导出 HTML，也支持骰娘录卡指令。

## 开发

```bash
npm install
npm run dev      # http://localhost:3000
npx tsc --noEmit
npx vitest run
npm run build
```

## 结构

- `components/soulhunter/`：角色卡页面、卡牌选择、升级区、导出与存档弹窗
- `src/rules/`：属性推导、配额、成长、校验等纯规则函数
- `src/content/`：由 `content/*.json` 组装的卡牌目录
- `lib/soulhunter/`：Zustand store、localStorage 存档、HTML / 录卡导出

## 部署

站点是 `output: "export"` 的纯静态产物，构建到 `out/`，三处均可访问：

| 平台 | 地址 | 自动部署 |
|---|---|---|
| Cloudflare Pages | https://sh-cf.subrecovery.top | 已连接 GitHub `main` |
| Vercel | https://sh-vercel.subrecovery.top | 已连接 GitHub `main` |
| Netlify | https://sh-nf.subrecovery.top | 已连接 GitHub `main` |

平台默认地址：`soul-hunter-character-sheet.pages.dev`、`soul-hunter-character-sheet.netlify.app`、`out-eta-dusky.vercel.app`。

三个平台都由 Git 集成在 push `main` 后自动构建，构建命令 `npm run build`，输出目录 `out`。也可以手动部署：

```bash
npm run deploy:cf
npm run deploy:vercel   # 本机需开代理，Vercel API 直连会超时
npm run deploy:nf
npm run deploy:all
```

页面右下角会显示构建版本号，格式为 `YYYYMMDD-短哈希`，同时写入 `<meta name="app-version">`。核对线上版本：

```bash
curl -s https://sh-cf.subrecovery.top/ | grep app-version
```

版本号由 `next.config.mjs` 在构建时读取 git 提交生成。

注意：不要把 `wrangler` 加回 `devDependencies`。它依赖的 `@cloudflare/workers-utils` 声明了 `vitest ^4 || ^5` 的 peer，与本项目的 vitest 3 冲突，会让 Cloudflare 构建的 `npm ci` 因锁文件缺包而失败。部署统一用 `npx --yes wrangler@latest`。

## TODO

- [ ] 拓展支持（暂缓）
  - [ ] 拓展勾选 UI，保存已启用拓展
  - [ ] 边缘人扮演指南：业力标签、事件业力
  - [ ] 子夜生物改造：义体标签、逆秩计数器、变异度、3/4 号灵能印记、嵌合基因标签
  - [ ] 惊吓盒子：鬼币、越界警戒值
  - [ ] 侠界之旅联动、刘航的枪术大全、韦迟的符咒手册、失序症联动的卡牌内容接入
