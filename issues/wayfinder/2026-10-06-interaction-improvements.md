---
kind: map
labels:
  - wayfinder:map
status: closed
---

# Brand-building 工作坊交互改进规格

## Destination

形成一份覆盖 2026-10-06 交互检查报告的、可交给实现阶段的交互规格：清楚说明增删/清空/恢复等操作后果，统一按钮状态和窄屏行为，并写明可验证的验收条件。

## Notes

- 范围是五个工作坊与全局档案操作；决策基于 `issues/2026-10-06-interaction-audit/README.md`。
- 遵守现有 `CONTEXT.md` 和 `AGENTS.md` 的已确认语义。特别是 W5 证据块只读、修改去上游；档案加载为直接覆盖且不自动备份。路线图只补交互表达，不重开这些既定行为。
- 先产出交互规格，不在本地图中实现、重做整套品牌视觉或改数据模型。
- 本地 Markdown tracker 没有原生依赖边；子 ticket 用 `parent` 元数据关联。可用 `rg -l 'parent: 2026-10-06-interaction-improvements' issues/wayfinder` 查询未决子项。

## Decisions so far

- [08 直接删除后的撤销窗口](2026-10-06-interaction-improvements/08-undo-window.md)：独立 10 秒入口，hover/focus 暂停倒计时，导航保留；整体工作区替换成功后旧撤销结束。

- [07 覆盖前保存或存档失败](2026-10-06-interaction-improvements/07-preoverwrite-archive-failure.md)：前置保存或存档失败一律停止覆盖，保留当前内容并提供重试；成功完成两步后才继续。历史加载无备份规则保持。

- [06 按钮外观及状态](2026-10-06-interaction-improvements/06-button-state-language.md)：选择 B；主操作黑底、次操作纸底，危险状态始终可见；hover 描边、focus 轮廓、按下内描边，取消按钮位移动效；实现阶段同步 design.md。

- [05 窄屏支持边界](2026-10-06-interaction-improvements/05-narrow-screen-support.md)：仅承诺最低 1024px 桌面编辑；更窄视口显示提示，保留桌面界面并允许横向滚动；密集表格局部滚动。

- [04 删除控件怎样说明对象、范围和危险程度](2026-10-06-interaction-improvements/04-delete-control-language.md)：按风险分层；候选市场、渠道行、标签直接删除并提供撤销，指标、语料和画像先确认影响；删除控件包含对象名，桌面目标至少 24×24px、触屏至少 44×44px。

- [01 历史版本加载前如何说明覆盖后果](2026-10-06-interaction-improvements/01-archive-restore-warning.md)：每次加载都先确认；按是否有未保存改动展示相应覆盖警告，默认聚焦「取消」，确认动作是「加载并覆盖」；始终明确不会自动创建恢复备份。
- [02 Work3 清空语料应按来源划定范围](2026-10-06-interaction-improvements/02-corpus-clear-scope.md)：仅分别清空本地真实语料或模拟语料；确认与完成提示显示数量、保留来源和模拟建模状态；Work1 来源依旧按勾选参与，不增加「清空全部语料」。
- [03 版本重命名与同名冲突如何提交或取消](2026-10-06-interaction-improvements/03-archive-naming-flow.md)：行内重命名显式保存/取消、失焦保留草稿；同名冲突明确提供覆盖、另存为新版本、取消；另存保留原版本，成功反馈仅在服务端返回实际名称后出现。

## Delivery

- 01–08 决策票均已关闭，未决项为 0。
- [完整、可验收的交互规格](2026-10-06-interaction-specification.md) 汇总对象范围、文案、按钮状态、撤销、失败处理、W5 上游入口和桌面支持边界。
- 规格提供五坊及全局操作盘点、22 项验收场景和审计八项发现的对应关系。
- 附带 05 布局和 06 按钮方向示意原型；原型是规格参考，没有产品业务行为，不代表实现验收通过。
- 本路线图完成的是决策与规格交付；产品代码、design.md 同步及上述验收属于后续实现阶段。

## Out of scope

- 改变 W5 证据块只读规则或允许案例模式写入：与现有术语及保护边界相冲突。
- 恢复历史版本时自动创建备份：现有决定明确选择直接加载、不自动备份。
- 本轮修复实现、数据库/schema 变更和品牌视觉全面重设计；本路线图终点是实现规格。
