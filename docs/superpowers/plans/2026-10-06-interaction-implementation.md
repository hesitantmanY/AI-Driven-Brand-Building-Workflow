# Brand-building 交互实现计划

> **For agentic workers:** 按下列依赖批次执行；用户已授权本轮实现及子 agent。共享未提交工作区不提交、不回滚。已有决策以完整交互规格和 01–08 决策票为准。

**Goal:** 实现交互规格，并使用隔离合成数据逐项验证 A01–A22。

**Architecture:** 在 `docs/lib/interaction.js` 集中处理确认、对象说明、独立撤销和覆盖前保护。各工作坊保留数据结构与渲染方式，删除入口显式清理依赖；档案模块负责服务端实际版本结果。

**Tech Stack:** 原生浏览器 JavaScript / CSS、FastAPI、本地 Node 测试、Playwright / Chrome。

## Global Constraints

- 历史加载每次确认，直接覆盖，不自动备份。
- 模拟语料默认参与且可勾选退出，默认包含负面反馈；Work1 来源按各自勾选保留。
- 重命名显式保存/取消，失焦保留草稿；冲突为覆盖、另存、取消，复制保留原版本。
- 直接删除每条独立 10 秒，hover/focus 暂停；导航保留，整体工作区成功替换后失效。
- 最低支持宽度 1024 CSS px；更窄提示并保留可横向滚动的桌面界面。
- 按钮采用 B 方向并同步 `design.md`；W5 证据块只读，修改去上游。
- 前置保存或存档失败停止覆盖并提供重试；覆盖后保存失败使用不同反馈。
- 不对真实 `server/data` 执行破坏性验证。已有修改基线保存在临时目录，报告明确本轮增量。

## 起点核对

2026-10-06：26 个已修改文件、19 项未跟踪文件；原有根目录 JS/Python 测试为 79 passed / 0 failed。原有语料失效、来源指针、案例保护及 AI 重生成修复保留。现有 Runner 暂停/继续语义与规格冲突，需恢复暂停后只能中止。

## 批次 1：共用交互与档案

- [ ] 新增 `docs/lib/interaction.js` 并在壳中加载，提供焦点受控的异步选择/确认、独立撤销、对象命名和持久化失败重试。
- [ ] 在 `docs/lib/history.js` / `savepanel.js` 实现加载确认、显式命名提交和三选冲突；`archive.js` / `server/storage.py` / `server/app.py` 支持源快照复制及实际元数据。
- [ ] 用对象数组删除/撤销测试验证原顺序、内容、三次独立删除、无关编辑与工作区替换边界；用临时服务端目录验证复制/覆盖。

共用调用契约：

```js
await Interaction.confirm({title:'清空模拟语料？', message:'将删除当前模拟语料。', confirmLabel:'清空模拟语料', trigger:document.activeElement});
await Interaction.choose({title:'版本名称冲突', message:'请选择操作。', actions:[{value:'overwrite',label:'覆盖旧版本',danger:true},{value:'copy',label:'另存为新版本'},{value:null,label:'取消此次操作'}]});
await Interaction.removeItem({list:()=>state.work2.segmentation.candidates,index:0,type:'候选市场',name:'合成市场',onChange:()=>autosave()});
Interaction.invalidateUndo();
```

## 批次 2：各坊删除与来源

- [ ] `workshop1.js` / `workshop2.js` 按第 6 节盘点全部入口，明确依赖范围并清理实际引用；无依赖单项使用独立撤销。
- [ ] `workshop3.js` / `workshop4.js` 实现分来源清空、实际纳入统计与风险删除；渠道/伙伴恢复全部原字段和位置。
- [ ] 运行各坊原有测试及新增的依赖清理验证，确认迁移幂等、评分聚合不回写。

## 批次 3：覆盖、证据与按钮/视口

- [ ] `app.js` 重置和导入通过共用前置保护；`workshop5.js` 自动同步失败停止覆盖，重试重新读取当前上游并保护备份期间的输入。
- [ ] W5 所有证据图表/排名表移除写操作，提供明确上游导航；章节覆盖列出实际范围。
- [ ] `runner.js` 恢复三态语义和全局 AI 互斥；`global-brand-building.html` 及 `design.md` 同步 B 方向、对象提示、24/44px 热区、1024px 桌面布局。
- [ ] 当前保存请求期间新增输入必须保留未保存状态，失败反馈不得同时宣称成功。

## 批次 4：验收与报告

- [ ] `node scripts/run-tests.js`：现有与新增根目录 JS/Python 检查全部通过。
- [ ] 显式运行 `tests/audit/**/*.test.js`：根目录 runner 不涵盖嵌套审计。
- [ ] `server/.venv/bin/python scripts/ui_smoke.py`：全部 23 个步骤真实挂载、代表性输入/新增通过。
- [ ] 新增隔离验收脚本，启动使用空临时数据目录的真实 FastAPI 服务；真实点击/键盘/刷新和请求失败覆盖 A01–A22，保存逐项证据及四个视口截图。
- [ ] `git diff --check`，核对本轮与基线增量，记录实现范围、验收证据及实际限制。
