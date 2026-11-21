# 狩魂者车卡器

Next.js 16 + React 19 + TypeScript 的《狩魂者 TRPG》角色卡工具，数据保存在浏览器 localStorage，角色卡可导出 HTML，也支持骰娘 / 回声岛录卡指令。

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

## TODO

- [ ] 参考 DHSheet 仓库完善存档管理（新建、切换、重命名、复制、删除的完整交互与校验）
- [ ] 拓展支持（暂缓）
  - [ ] 拓展勾选 UI，保存已启用拓展
  - [ ] 边缘人扮演指南：业力标签、事件业力
  - [ ] 子夜生物改造：义体标签、逆秩计数器、变异度、3/4 号灵能印记、嵌合基因标签
  - [ ] 惊吓盒子：鬼币、越界警戒值
  - [ ] 侠界之旅联动、刘航的枪术大全、韦迟的符咒手册、失序症联动的卡牌内容接入
