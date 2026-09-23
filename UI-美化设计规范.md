# electerm UI 美化设计规范 · v2（待升级后修订）

> ⚠️ **执行前提已变更**：本文档的目标代码是上游 **5.0.6**，而官方已到 **5.5.26**（领先 215 个提交）。
> 已决定**先升级到 5.5.26，再执行美化**。因此本文档的**行号与部分条目需先按升级后代码修订**才能动手。
> 修订清单见 → [上游5.5.26升级与样式差异审计.md](./上游5.5.26升级与样式差异审计.md) §十（共 14 项）。
> **升级验证通过前，不要修改本规范的任何行号，也不要开始任何样式改动。**

> 目标：在不改动布局结构、不重命名任何类名、不增删任何 DOM 节点的前提下，为全部页面建立统一的「色阶 / 圆角 / 阴影 / 动效 / 焦点」五套体系。
> 适用范围：`src/client` 下全部 58 个 `.styl` 文件 + 4 个 js 文件（`store.js`、`ui-theme.jsx`，其余只读）。
> 原则：先打地基（token）→ 再统一（清账 + 收敛）→ 最后逐区域精修。每一步都可独立验证、可回滚。

---

## 修订记录

| 版本 | 变更 |
| --- | --- |
| v1 | 初版：现状分析、3 层方案、11 区域精修、落地顺序 |
| **v2** | **深度复核后修订，含 3 处方案级修正** |
| **待修订** | 升级到 5.5.26 后按审计文档 §十 修订 14 项（含 2 个变量名修正、6 个文件行号重算、1 处作用对象迁移、9 个新区域纳入） |

### v2 的三处关键修正（详见 §2.1、§2.5）

| 修正 | 原因 |
| --- | --- |
| **token 从「扩展」改为「派生」** | v1 提议给主题加 20+ 个新 key，但 `requiredThemeProps` 是**必填白名单**，会导致主题编辑器保存失败、310 个 iTerm 主题与新变量脱节。改为从既有 12 个颜色**派生**，零侵入。 |
| **补 `focus-visible` 层** | 全库 `:focus-visible` 出现 **0 次**、`:focus` 仅 **1 次**，且 `outline` 被移除 5 处。这是键盘用户的硬伤，v1 遗漏。 |
| **补单测层** | v1 只给 grep 命令。v2 新增 4 个可直接纳入 `npm run test-unit-ci` 的单测，把「变量未定义」这类问题变成**回归可拦截**。 |

---

## 一、现状分析

### 1.1 样式体系结构

样式变量目前是「三层 + 一个旁路」：

| 层 | 位置 | 说明 |
| --- | --- | --- |
| 变量静态默认值 | `src/client/css/includes/theme.styl` L1-16 | 15 个 CSS 变量，仅深色值 |
| 运行时覆盖 | `src/client/components/main/ui-theme.jsx` L31-50 | 把主题配置写成 `<style id="theme-css">:root{…}`；key 为 `main` 时自动派生 `--main-darker` / `--main-lighter` |
| antd 桥接 | `src/client/store/store.js` L248-266 | `uiThemeConfig` getter → `ConfigProvider theme` |
| 用户旁路 | `src/client/components/bg/custom-css.jsx` L9-23 | 把 `config.customCss` 注入 `<style id="custom-css">` |

变量消费频率（`src/client` 全量 grep）：

```
--main 45   --text 41   --primary 40   --main-darker 29
--success 22  --text-light 18  --text-dark 14  --main-lighter 14
--main-dark 11  --error 10  --primary-contrast 7  --warn 4
--main-light 3  --text-disabled 2  --info 1
```

即：**现有 15 个变量全是颜色**，没有任何「分隔线、悬浮底色、遮罩、阴影、圆角、间距、字号、动效时长、焦点环」变量。

### 1.2 问题清单

严重度：🔴 阻断/明显缺陷　🟠 体验问题　🟡 整洁度问题

| # | 严重度 | 问题 | 证据 |
| --- | --- | --- | --- |
| 1 | 🟠 | 设计 token 太薄 | `theme.styl` 仅 15 行，全是颜色 |
| 2 | 🟠 | 圆角不成体系 | 全库 `border-radius` 出现 11 种值：2/3/4/5/6/8/10/15/20/28/30px |
| 3 | 🟠 | 阴影不成体系 | 15 种 `box-shadow` 写法，含 `inset 0 0 5px var(--main-darker)`、`0 0 3px 3px var(--main-lighter)` 这类「用背景色假装阴影」 |
| 4 | 🔴 | 4 个变量被引用但从未定义（静默失效） | `--border`（`sidebar.styl:55`，**当前该分隔线完全不显示**）、`--text-color-2`（`ai.styl:127,206`）、`--text-color-secondary`（`cmd-history.styl:51`）、`--hover-bg` |
| 5 | 🟠 | 默认主题有 3 份副本且值不一致 | `theme.styl:2` = `#141314`；`theme-defaults.js:31` = `#121214`；`ui-theme.js:6` = `#141314` |
| 6 | 🟠 | antd 桥接不完整 | `store.js:253` 硬编码 `borderRadius: 3`；`motion: false` 关闭全部 antd 动效；`basic.styl:7` 全局 12px 与 antd 默认 14px 冲突 |
| 7 | 🟠 | 几乎零动效 | 58 个 `.styl` 中 `transition` 仅 12 处 / 6 文件 |
| 8 | 🟠 | 硬编码颜色残留 | 32 处，见 §4.15 |
| 9 | 🟡 | 层叠失控 | **45 处** `!important`：`term-fullscreen.styl`(13)、`vnc+spice+rdp`(11)、`mobile.styl`(8) |
| 10 | 🟡 | 内联样式散布 | 35 个 `.jsx` 含 `style={{}}` |
| 11 | 🔴 | 浅色主题对比度不达标 | 实测 `--success #06D6A0` 在 `#ededed` 上仅 **1.61:1**，见 §5.4 |
| 12 | 🔴 | 无键盘焦点可视化 | `:focus-visible` 0 处、`:focus` 1 处、`outline` 被移除 5 处，见 §5.4 |
| 13 | 🟡 | 无中文字体回退 | `basic.styl:9` 字体栈无 CJK 字体，中日文 locale 会串字体 |
| 14 | 🟡 | 无 `prefers-reduced-motion` 全局兜底 | 全库仅 `bookmark-form.styl:62` 一处 |

### 1.3 视图区域完整清单（58 个 `.styl`）

v1 遗漏了 22 个文件，此处补全。**加粗为 v1 遗漏项**。

**已覆盖（36）**：`tabs/{tabs,add-btn,no-session}`、`sidebar/{sidebar,info,transfer,transfer-history}`、`session/{session,session-control}`、`terminal/{terminal,term-search}`、`sftp/{sftp,code-compare,file-compare-modal,transfer-tag,address-bookmark}`、`footer/{footer,cmd-history}`、`side-panel-r/right-side-panel`、`ai/ai`、`terminal-info/terminal-info`、`setting-panel/{setting,setting-wrap,list}`、`theme/{theme-form,terminal-theme-list}`、`bookmark-form/bookmark-form`、`tree-list/tree-list`、`common/{modal,drawer,message,notification}`、`rdp/rdp`、`vnc/vnc`、`spice/spice`、`css/mobile.styl`

**v1 遗漏（22）**：

| 文件 | 负责的 UI | 优先级 |
| --- | --- | --- |
| **`sys-menu/sys-menu.styl`** | **全部右键/上下文菜单**（宽 280/380px，L3/L64） | 🔴 最高频交互，v1 最大遗漏 |
| **`quick-commands/qm.styl`** | 快捷命令弹层（L1-73） | 🔴 高频 |
| **`file-transfer/transfer.styl`** | 右侧传输进度列表（L1-51） | 🟠 |
| **`auth/login.styl`** | 登录页 —— **硬编码白底 `#fff`（L7），暗色主题下刺眼** | 🟠 |
| **`layout/layout.styl`** | 布局容器与 `drag-over` 指示（L6-7） | 🟠 |
| **`main/{wrapper,upgrade,term-fullscreen}.styl`** | 升级提示、终端全屏（含 13 处 `!important`） | 🟠 |
| **`ssh-config/ssh-config.styl`** | SSH 配置导入列表 | 🟠 |
| **`css/includes/{theme,box,text,font-size,index}.styl`** | 变量定义 + 工具类（`.pd*/.mg*/.elli/.font*`） | 🔴 token 落点 |
| **`css/basic.styl`** | 全局根/字体/滚动条/拖拽指示（L17-57） | 🔴 token 落点 |
| **`icons/ai-icon.styl`** | AI 图标 | 🟡 |
| **`common/{drag-handle,input-confirm-common,logo,highlight,remote-float-control}.styl`** | 拖拽把手、确认输入、Logo、高亮、远端浮控 | 🟠 |
| **`bookmark-form/common/color-picker.styl`** | 颜色选择器（硬编码 `#ccc`/`#fff`） | 🟠 |

**另有一个结构性盲区**：`text-editor/`、`widgets/`、`shortcuts/`、`batch-op/`、`bg/` **5 个目录零 `.styl`**，UI 完全复用全局类。这意味着：

- 对这些区域的样式调整**只能改全局类**，爆炸半径会外溢到其他区域 → 必须放在最后做。
- `widgets` 已有 Beta 入口（`setting-modal.jsx:104`），未来会独立成模块，现阶段不要为它单独建 `.styl`。

### 1.4 测试与构建现状（决定验证策略）

| 项 | 现状 | 对方案的影响 |
| --- | --- | --- |
| `test/unit` | 19 个 spec，**但没有任何 npm script 引用它** | 无法作为回归门禁 |
| `test/unit-ci` | 10 个 spec，`node --test` 运行，CommonJS | **可扩展为 CSS 契约测试**（见 §7.3） |
| `test/integration` | 2 个 spec，需活体 MCP server，否则自 skip | 与样式无关 |
| `test/e2e` | 48 个 spec，Playwright 驱动 Electron | 见下方「关键结论」 |
| **样式断言** | **全库 0 处**：`getComputedStyle`/`toHaveCSS`/`toHaveClass`/`border-radius`/`box-shadow`/`toHaveScreenshot` 均无命中 | **纯样式改动不会打破任何断言** |
| 可见性断言 | 8 个文件用 `toBeVisible()`/`toBeHidden()` | **唯一的雷区**：不得让元素 `display:none` 或移除 DOM |
| e2e 定位方式 | **全部 CSS 类选择器**，无 `data-testid`/`getByRole`。高频：`.session-current`(31)、`.ant-dropdown`(31)、`.tabs`(22)、`.sftp-item`(10)、`.term-wrap`(9)、`.tab`(9) | **不得重命名类名、不得调整 DOM 层级** |
| Playwright | **未安装**（`node_modules/.bin/playwright` 不存在） | e2e 当前跑不起来，不能作为主验证手段 |
| playwright.config | **不存在**，全仓 0 个 | e2e 用默认配置，依赖 `work/app` 已构建产物 |
| lint | `standard --verbose`，**只扫 JS，不检查 `.styl`** | 样式错误没有静态拦截 → 需新增单测补位 |
| stylelint / prettier / editorconfig | **全部不存在** | 同上 |
| postcss / autoprefixer | **不存在**，仅 vite 生产默认 esbuild 压缩 | `color-mix()` 不会被降级（见 §2.4） |
| CI 测试门禁 | 仅 `mac-test-1/2/3.yml`，**触发条件是特定分支 push，无 `pull_request` 触发** | 无 PR 级自动拦截，靠本地验证 |

**关键结论**：安全边界 = **不改类名、不删/隐藏 DOM 节点、不改布局尺寸**。在此边界内，纯样式改动不会打破任何测试。

**构建链路**：

| 命令 | 作用 | 耗时量级 |
| --- | --- | --- |
| `npm run compile` | 仅 vite 编译 → `work/app/assets/` | 秒级 |
| `npm run t` | 直接 `electron work/app/app.js` 启动 | 秒级 |
| `npm run bdebfast` | 自增号 → 删旧 assets → `npm run compile` → prepare → asar pack → `fakeroot dpkg-deb` → `dist/electerm-5.0.6-test.N-linux-amd64.deb` | 数十秒（首次更久） |
| `npm run test-unit-ci` | `node --test test/unit-ci/*.spec.js` | 秒级 |

> ⚠️ v1 写的 `npm run btebfast` **不存在**，脚本名是 `btest`（走 electron-builder，慢得多）。日常验证只用 `compile` + `t`。

**开发快循环**：`npm run compile && npm run t` —— 改 `.styl` 后无需打 deb。

### 1.5 主题系统的三个硬约束 ★

这是 v2 最重要的补充。**决定了新 token 必须怎么设计**。

#### 约束 A：主题 key 是「必填白名单」，不能扩展

`src/client/common/terminal-theme.js` L13-51：

```js
export const requiredThemeProps = [
  'main', 'main-dark', 'main-light', 'text', 'text-light', 'text-dark',
  'text-disabled', 'primary', 'info', 'success', 'error', 'warn',
  'terminal:foreground', /* … 共 20 个 terminal: 前缀 key */
]
export const validThemeProps = [...requiredThemeProps, 'name']
```

`components/theme/theme-form.jsx` 的校验逻辑：

- **L65-72**：遍历 `requiredThemeProps`，**任何一个缺失就报 `Missing prop: X` 并拒绝保存**。
- **L95-100**：任何不在 `validThemeProps` 里的 key 报 `Not supported prop: X` 并拒绝保存。

**后果**：若按 v1 方案把 20+ 个新 token 加进 `requiredThemeProps`：

1. 用户打开**任何已有主题**（含 310 个 iTerm 主题）点保存 → 立刻报一堆 `Missing prop` → **保存功能被破坏**。
2. `theme-ai-editor.jsx:76` 的字段列表来自 `requiredThemeProps` → AI 生成主题的提示词也得改，否则 AI 产出永远缺 key。
3. `convertThemeToText()`（`terminal-theme.js:72-88`）会把新 key 写进主题文本格式 → 主题文件格式变更，**破坏向后兼容**。

#### 约束 B：310 个 iTerm 主题只带 12 个 ui key

实测 `node_modules/@electerm/electerm-themes/dist/themes/` 共 **310** 个 `.txt`，样本 `3024 Day.txt`：

```
themeName=3024 Day
main=#ededed
main-dark=#cccccc
main-light=#fefefe
text=#555
text-light=#777
text-dark=#444
text-disabled=#888
primary=#08c
info=#FFD166
success=#06D6A0
error=#EF476F
warn=#E55934
terminal:background=#f7f7f7
…
```

即：**恰好 12 个 ui key，既不含圆角/阴影/间距，也不会有新 token**。且其中混有浅色主题（如本例 `main=#f7f7f7`）。

#### 约束 C：切换主题时的 fallback 行为

`src/client/store/ui-theme.js` L19-21：

```js
return theme && theme.uiThemeConfig
  ? copy(theme.uiThemeConfig)
  : defaultTheme().uiThemeConfig
```

`components/main/ui-theme.jsx` L31-49 `buildTheme()`：**只遍历已存在的 key** 生成 `--key`，不补默认值。

组合结论：

| 主题类型 | uiThemeConfig | 结果 |
| --- | --- | --- |
| 内置 default / defaultLight | 12 key | 12 个变量被写入 `:root` |
| 310 个 iTerm 主题 | 12 key（约束 B） | 12 个变量被写入 `:root` |
| 主题配置缺 `uiThemeConfig` | `undefined` | 回落 `defaultTheme().uiThemeConfig`（12 key 暗色） |
| 空对象 `{}` | truthy → 不回落 | `buildTheme({})` 返回 `''` → `innerHTML=''` → **全部回落到 `theme.styl` 静态暗色** |

**→ 无论哪条路径，`theme.styl` 的静态默认值都是最终兜底，必须完整。**

---

## 二、Layer 1 · token 体系（v2 重大修订）

### 2.1 设计原则：派生 > 扩展 ★

由 §1.5 三个约束推出**唯一可行的架构**：

```
既有 12 个主题色（用户可编辑，白名单锁定）
        │
        ├─ 直接复用：--surface-0/1/2  ←  var(--main-dark) / var(--main) / var(--main-light)
        │
        └─ 派生：--border / --hover-bg  ←  color-mix(in srgb, var(--text) N%, transparent)

其余（圆角 / 阴影 / 间距 / 字号 / 动效 / 焦点环）→ 纯静态常量，与主题无关
```

**为什么这样最优**：

| 维度 | 派生方案 | v1 的扩展方案 |
| --- | --- | --- |
| 主题编辑器保存 | ✅ 完全不受影响 | ❌ 报 `Missing prop` |
| 310 个 iTerm 主题 | ✅ 自动正确（含浅色主题） | ❌ 新变量全部缺失 |
| AI 主题生成器 | ✅ 无需改动 | ❌ 需改提示词 |
| 主题文本格式 | ✅ 不变 | ❌ 格式变更，破坏兼容 |
| 浅色主题支持 | ✅ 由 `--text` 自动决定边框明暗 | ❌ 需手工维护两套值 |
| JS 改动量 | ✅ 0 行 | ❌ 3 个文件 |

**收益**：新增 20+ 个变量，而**用户可编辑的主题字段仍是 12 个**——能力变强，界面不变。

### 2.2 变量清单

#### A. 派生变量（跟随主题自动适配）

| 变量 | 表达式 | 深色主题解 | 浅色主题解 |
| --- | --- | --- | --- |
| `--surface-0` | `var(--main-dark)` | `#000` | `#cccccc` |
| `--surface-1` | `var(--main)` | `#121214` | `#ededed` |
| `--surface-2` | `var(--main-light)` | `#2E3338` | `#fefefe` |
| `--border` | `color-mix(in srgb, var(--text) 14%, transparent)` | `rgba(221,221,221,.14)` | `rgba(85,85,85,.14)` |
| `--border-strong` | `color-mix(in srgb, var(--text) 24%, transparent)` | `rgba(221,221,221,.24)` | `rgba(85,85,85,.24)` |
| `--hover-bg` | `color-mix(in srgb, var(--text) 8%, transparent)` | `rgba(221,221,221,.08)` | `rgba(85,85,85,.08)` |
| `--active-bg` | `color-mix(in srgb, var(--primary) 18%, transparent)` | `rgba(8,136,204,.18)` | 同 |
| `--focus-ring` | `0 0 0 2px color-mix(in srgb, var(--primary) 45%, transparent)` | 蓝色光晕 | 同 |
| `--mask` | `color-mix(in srgb, var(--main-darker) 72%, transparent)` | 近黑 | 浅灰 |

#### B. 静态变量（与主题无关，纯常量）

| 变量 | 值 | 变量 | 值 |
| --- | --- | --- | --- |
| `--radius-xs` | `4px` | `--shadow-1` | `0 1px 2px rgba(0,0,0,.30)` |
| `--radius-sm` | `6px` | `--shadow-2` | `0 4px 12px rgba(0,0,0,.34)` |
| `--radius` | `8px` | `--shadow-3` | `0 16px 40px rgba(0,0,0,.45)` |
| `--radius-lg` | `12px` | `--dur-1` / `--dur-2` | `120ms` / `180ms` |
| `--radius-pill` | `999px` | `--ease` | `cubic-bezier(.4,0,.2,1)` |
| `--sp-1` … `--sp-5` | `4/8/12/16/24px` | `--fs-xs` … `--fs-lg` | `11/12/13/16px` |
| `--h-bar` | `36px` | `--w-sidebar` | `36px` |

> `--h-bar` / `--w-sidebar` 收纳全库 **19 处 / 10 文件**的 `36px` 骨架值（tabs 高、sidebar 宽、footer 高、右栏 top）。**注意：只做语义化收纳，不改数值**——改数值＝改布局，违反安全边界。

**阴影为何静态**：浅色主题需要更弱的阴影（`rgba(0,0,0,.06)` vs 深色 `.34`），但约束 A 不允许新增主题 key。折中方案取中间值（`.30/.34/.45`），在深色下略弱、浅色下略强，**均为可接受的观感差异，不构成缺陷**。若需精确分档，见 §2.6 方案 B（3 行 JS，独立提交）。

### 2.3 `tokens.styl` 内容

新建 `src/client/css/includes/tokens.styl`，在 `theme.styl` 顶部 `@require`。

```stylus
// src/client/css/includes/tokens.styl
// 全部新增 token。派生变量跟随 --text/--main 自动适配任意主题（含 310 个 iTerm 主题）。
:root
  // ---- 派生：表面色阶（沿用既有主题 key）----
  --surface-0 var(--main-dark)
  --surface-1 var(--main)
  --surface-2 var(--main-light)

  // ---- 派生：分隔、边框、交互态 ----
  --border        color-mix(in srgb, var(--text) 14%, transparent)
  --border-strong color-mix(in srgb, var(--text) 24%, transparent)
  --hover-bg      color-mix(in srgb, var(--text) 8%, transparent)
  --active-bg     color-mix(in srgb, var(--primary) 18%, transparent)
  --focus-ring    0 0 0 2px color-mix(in srgb, var(--primary) 45%, transparent)
  --mask          color-mix(in srgb, var(--main-darker) 72%, transparent)

  // ---- 静态：圆角 ----
  --radius-xs 4px
  --radius-sm 6px
  --radius 8px
  --radius-lg 12px
  --radius-pill 999px

  // ---- 静态：阴影 ----
  --shadow-1 0 1px 2px rgba(0,0,0,.30)
  --shadow-2 0 4px 12px rgba(0,0,0,.34)
  --shadow-3 0 16px 40px rgba(0,0,0,.45)

  // ---- 静态：间距 / 字号 ----
  --sp-1 4px
  --sp-2 8px
  --sp-3 12px
  --sp-4 16px
  --sp-5 24px
  --fs-xs 11px
  --fs-sm 12px
  --fs 13px
  --fs-lg 16px

  // ---- 静态：布局骨架（收纳 19 处 36px，值不变）----
  --h-bar 36px
  --w-sidebar 36px

  // ---- 静态：动效 ----
  --dur-1 120ms
  --dur-2 180ms
  --ease cubic-bezier(.4,0,.2,1)
```

### 2.4 `color-mix()` 技术前提（已验证）

| 检查项 | 结果 | 结论 |
| --- | --- | --- |
| Electron 版本 | `42.8.1`（`package.json:80`） | Chromium ≥ 140，`color-mix()` 需 Chrome 111+ → ✅ 支持 |
| vite `build.target` | `'esnext'`（`build/vite/conf.js`） | ✅ 不会被降级 |
| 现有 `color-mix` 使用 | 0 处 | 首次引入，无冲突 |
| CSS 压缩 | esbuild 生产默认，无 postcss/autoprefixer | ✅ esbuild 不改写 `color-mix` |

**必须验证**（Step 1 的验收条件之一）：编译后 grep 产物 CSS 确认 `color-mix` 存活：

```bash
grep -c "color-mix" work/app/assets/css/style-5.0.6.css   # 期望 > 0
```

若某天目标环境不支持，降级方案：把 6 个派生变量改回硬编码深色值 + 接受浅色主题下边框偏灰（不影响功能）。

### 2.5 明确不要做的事 ★

| 不要做 | 原因 |
| --- | --- |
| ❌ 不要把新 token 加进 `requiredThemeProps` | §1.5 约束 A：破坏主题保存 + 310 主题脱节 |
| ❌ 不要改 `convertThemeToText` / `convertTheme` | 主题文本格式是外部契约（iTerm 主题分发） |
| ❌ 不要在 `tokens.styl` 定义 `--main-darker` / `--main-lighter` | 由 `ui-theme.jsx` 的 `darker()` 运行时派生，重复定义会争抢优先级 |
| ❌ 不要改 `36px` 等布局骨架的数值 | 违反安全边界，会打破 e2e 的可见性断言 |
| ❌ 不要重命名任何类名 | e2e 全部依赖类选择器（§1.4） |
| ❌ 不要为 `text-editor`/`widgets`/`shortcuts`/`batch-op`/`bg` 新建 `.styl` | 5 目录零 styl 是现有架构，新增会分裂样式来源 |

### 2.6 可选：方案 B（精确阴影分档）

若接受 3 行 JS 改动以获得浅色主题下更精准的阴影，可在 `ui-theme.jsx`（已 import `isColorDark`）的 `applyTheme()` 中追加：

```js
document.documentElement.classList.toggle(
  'theme-light', !isColorDark(themeConfig.main || '#000')
)
```

配合 `tokens.styl` 追加：

```stylus
.theme-light
  --shadow-1 0 1px 2px rgba(0,0,0,.06)
  --shadow-2 0 4px 12px rgba(0,0,0,.10)
  --shadow-3 0 16px 40px rgba(0,0,0,.14)
```

**安全性**：`isColorDark` 有 try/catch，`undefined` → 返回 `true`（暗色），与 `{}` 空配置的静态兜底一致，不会误判。`<html>` 上的 class 不影响任何测试选择器。

**取舍**：作为**独立提交**放在最后，若浅色主题不是重点可跳过。

### 2.7 验证标准

Layer 1 是**纯新增**：改完后应用外观必须**零变化**（除阴影/边框按新值渲染外，颜色无跳变）。验证：

```bash
npm run compile && npm run t
# 目视：随便点几个页面，颜色/布局应与改动前一致
grep -c "color-mix" work/app/assets/css/style-5.0.6.css
```

---

## 三、Layer 2 · 统一层

### 3.1 合并 3 份默认主题副本

现状：`theme.styl:1-16`、`common/ui-theme.js:5-18`（`defaultUiThemeStylus`）、`common/theme-defaults.js:18-33` 各存一份，且 `main` 值不一致。

处理：

1. 以 `theme-defaults.js` 为**唯一来源**。
2. `ui-theme.js` 的 `defaultUiThemeStylus` 改为由 `theme-defaults.js` 生成（去掉第三份副本）。
3. `theme.styl` 的 `:root` 只保留「配置加载前的兜底值」，`--main` 从 `#141314` 改为与 `theme-defaults.js` 一致的 `#121214`。
4. 浅色主题的 12 个 key **保持不动**（约束 A 禁止扩展）。

### 3.2 补齐死变量 / 清理 antd 残留名

| 位置 | 现状 | 改为 |
| --- | --- | --- |
| `sidebar/sidebar.styl:55` | `border-bottom 1px solid var(--border)` | 变量在 §2 补齐后自动生效（**修复一处隐形缺陷**） |
| `ai/ai.styl:127` | `color var(--text-color-2)` | `color var(--text-dark)` |
| `ai/ai.styl:206` | `color var(--text-color-2)` | `color var(--text-dark)` |
| `footer/cmd-history.styl:51` | `color var(--text-color-secondary)` | `color var(--text-dark)` |

### 3.3 收敛圆角与阴影（影响面最大）

**圆角只允许 5 个值**：`--radius-xs`(4) / `--radius-sm`(6) / `--radius`(8) / `--radius-lg`(12) / `--radius-pill`(999)。

| 现状 | 出现处（示例） | 目标 |
| --- | --- | --- |
| `2px` / `3px` | `tabs.styl:45`、`sftp.styl:38` | `--radius-xs` |
| `4px` / `5px` / `6px` | `common/modal.styl:62`、`tabs.styl:243` | `--radius-sm` |
| `8px` | `common/modal.styl:30` | `--radius` |
| `10px` / `12px` | `tabs.styl:232`、`right-side-panel.styl` | `--radius-lg` |
| `15px` / `20px` / `28px` / `30px` | 计数徽标、圆形按钮 | `--radius-pill` |

**阴影只允许 3 个值**：`--shadow-1` / `--shadow-2` / `--shadow-3`。

| 现状写法 | 位置 |
| --- | --- |
| `inset 0 0 5px var(--main-darker)` | `session.styl:84` |
| `0 0 3px 3px var(--main-lighter)` | `sftp.styl:42` |
| `0 0 1px 1px var(--main-darker)` | `session.styl:56` |
| `0 6px 16px 0 rgba(0,0,0,.08), 0 3px 6px -4px rgba(0,0,0,.12), 0 9px 28px 8px rgba(0,0,0,.05)` | `common/modal.styl:31`（antd 抄来的） |
| `0 2px 8px rgba(0,0,0,.15)` / `0 4px 12px rgba(0,0,0,.15)` / `0 2px 8px rgba(0,0,0,.1)` | `tabs.styl:245` 等浮层 |
| `0 -2px 8px rgba(0,0,0,.2)` | `footer.styl:60` |

### 3.4 修复 antd 桥接

`src/client/store/store.js` L248-266 改为：

```js
get uiThemeConfig () {
  const themeConf = window.store.getUiThemeConfig()
  return {
    token: {
      borderRadius: 8,
      borderRadiusSM: 6,
      borderRadiusLG: 12,
      colorPrimary: themeConf.primary,
      colorBgBase: themeConf.main,
      colorBgContainer: themeConf.main,
      colorBgElevated: themeConf['main-light'],
      colorBorder: themeConf['main-light'],
      colorError: themeConf.error,
      colorInfo: themeConf.info,
      colorSuccess: themeConf.success,
      colorWarning: themeConf.warn,
      colorTextBase: themeConf.text,
      colorLink: themeConf['text-light'],
      fontSize: 13,
      controlHeight: 30
    },
    algorithm: isColorDark(themeConf.main)
      ? theme.darkAlgorithm
      : theme.defaultAlgorithm
  }
}
```

关键变化：`borderRadius` 3 → 8；**删除 `motion: false`**（恢复 antd 动效）；新增 `fontSize: 13` 与 body 对齐；补 `colorBorder` / `colorBgContainer` / `colorBgElevated` / `controlHeight`。

> `themeConf['main-light']` 在 iTerm 主题下已定义（约束 B 已实测），安全。
> 若发现个别页面卡顿，不要重新全局关闭，改为 `motion: { motionDurationFast: '0.12s', motionDurationMid: '0.18s' }`。

### 3.5 动效基线

对全部可交互元素统一补：

```stylus
transition background var(--dur-1) var(--ease), color var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease)
```

优先覆盖（`:hover` 出现 73 行的主要元素）：`.tab` / `.tab-close` / `.window-control-box` / `.control-icon` / `.sftp-item` / `.item-list-unit` / `.layout-menu-item` / `.workspace-item` / `.custom-modal-close` / `.sys-menu` 菜单项 / antd 按钮与下拉项。

`sidebar.styl:2-3`、`right-side-panel.styl:36-37` 的 `.animate-fast { animation-duration .2s }` → `var(--dur-2)`。

### 3.6 焦点可见性基线 ★ v2 新增

现状（实测）：

- `:focus-visible` **0 处**、`:focus` **1 处**（`common/modal.styl:68`，且立即 `outline none`）。
- `outline` 被移除 5 处：`css/basic.styl:26`、`common/modal.styl:8`、`common/modal.styl:69`、`rdp/rdp.styl:49`。
- 全库唯一保留焦点指示的是 `tree-list/tree-list.styl:25` 的 `outline 1px dashed var(--primary)`。

这是**键盘用户的硬伤**：Tab 键完全看不到焦点在哪。修复方式（纯新增，不改现有 `outline` 规则）：

```stylus
// css/basic.styl 末尾追加
:focus-visible
  outline none
  box-shadow var(--focus-ring)
  border-radius var(--radius-xs)
```

仅用 `:focus-visible`（而非 `:focus`），保证**鼠标点击不出现焦点环**，不干扰现有视觉。

**必须保留 `outline` 移除的那 5 处** —— 它们配合新的 `box-shadow` 焦点环形成「去 outline + 加光环」的组合，不要回退。

### 3.7 `prefers-reduced-motion` 全局兜底 ★ v2 新增

全库仅 `bookmark-form.styl:62` 一处，而 §3.5 会新增大量 `transition`。追加：

```stylus
@media (prefers-reduced-motion: reduce)
  *
    animation-duration .01ms !important
    animation-iteration-count 1 !important
    transition-duration .01ms !important
```

> 这是**唯一允许使用 `!important` 的新增场景**（无障碍覆盖优先级需要）。

### 3.8 字体回退（CJK）★ v2 新增

`basic.styl:9` 字体栈无中文/日文字体，中日文 locale 下会串字体（数字/英文用一种、汉字回落到系统默认）。追加 CJK 字体（**插在西文之后、`sans-serif` 之前**）：

```stylus
font-family -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Noto Sans CJK SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'
```

---

## 四、Layer 3 · 页面精修（15 个区域）

统一视觉约定：

- 区域之间靠**色阶**分隔（`--surface-0/1/2`），不靠粗边框。
- 选中态一律：**主色描边**，或**左侧 2px 主色色条**。
- 悬浮态一律：`--hover-bg`，**禁止整行主色实心**（当前 `sftp.styl` 的做法对比度仅 3.89:1，见 §5.4）。
- 圆角只用 `--radius`(8) 和 `--radius-lg`(12) 两档。

### 4.1 ① 标签栏 / 标题栏

文件：`components/tabs/tabs.styl`、`add-btn.styl`、`no-session.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L2-8 `.tabs` | `background var(--main-dark)`；`border-bottom 1px solid var(--main-light)` | `background var(--surface-0)`；`border-bottom 1px solid var(--border)` |
| L35-49 `.tab` | `border-radius 3px 3px 0 0` | `border-radius var(--radius) var(--radius) 0 0` |
| L54-57 `&.active` | `box-shadow inset 0 2px 0 0 var(--primary)` | 保留主色高亮条，底色改 `var(--surface-1)` |
| L63-65 `&:hover` | 无底色反馈 | 补 `background var(--hover-bg)` |
| L82-88 `@keyframes blink` | 硬编码 `#e0e0e0` / `#ffffff` | 改「主色 ↔ 透明」呼吸（消除 3 处硬编码） |
| L125-142 `.tab-close` | `background var(--main)`；`:hover { background var(--error); color #fff }` | `background var(--hover-bg)`；`color var(--primary-contrast)` |
| L121 | `background-color transparent !important` | 用选择器层级替代 |
| L232 `.tab-count` | `border-radius 10px 2px 2px 10px` | `border-radius var(--radius-pill)` |
| L245 / L267 | `color #fff` | `var(--primary-contrast)` |

### 4.2 ② 侧边图标栏 + 书签/历史面板

文件：`components/sidebar/sidebar.styl`、`transfer.styl`、`info.styl`、`transfer-history.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L4-15 `.sidebar-panel` | `background var(--main)` | `background var(--surface-1)` |
| L13-15 | `display none !important` | 用选择器层级替代 |
| L18-26 `.sidebar` | `background var(--main-dark)`；宽 36px | `background var(--surface-0)`；`width var(--w-sidebar)` |
| L55 | `border-bottom 1px solid var(--border)`（当前静默失效） | §2 补齐后生效 |
| L83-92 `.control-icon-wrap` | 仅改图标颜色 | 补 `border-radius var(--radius-sm)`；`&.active { background var(--active-bg) }` |
| L2-3 `.animate-fast` | `animation-duration .2s` | `var(--dur-2)` |
| L42 | `box-shadow 0px 0px 3px 3px var(--main-lighter)` | `var(--shadow-2)` |
| `info.styl:4` | `linear-gradient(45deg, #08c 0%, #09c 100%)` | `var(--primary)` 单色 |
| L64,81,92,119,130 | 仅 `:hover` | 补 §3.6 焦点环 |

### 4.3 ③ 终端会话区

文件：`components/session/session.styl`、`session-control.styl`、`terminal/terminal.styl`、`term-search.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L50-58 `.session-wrap` | `box-shadow 0px 0px 1px 1px var(--main-darker)` | `var(--shadow-1)` |
| L6-12 `.type-tab-line` | `background var(--text-dark)` | `background var(--primary)` |
| L26-31 `.type-tab` | 无过渡 | §3.5 动效基线 |
| L74-89 `.vnc-scroll-wrapper` | `--main-darker` 系 + `inset 0 0 5px` | `--surface-0` + `--shadow-1` |
| L55 | `padding-top 36px` | `var(--h-bar)` |
| `term-search.styl:9-10` | `background #333` / `color #aaa` | `var(--surface-2)` / `var(--text-dark)` |
| `terminal.styl:135` | `color var(--text-light, #888)` | 去掉可疑 fallback |
| `terminal.styl:36,46` | `background-color transparent !important` | 用选择器层级替代 |

### 4.4 ④ SFTP 文件管理

文件：`components/sftp/sftp.styl`、`address-bookmark.styl`、`code-compare.styl`、`file-compare-modal.styl`、`transfer-tag.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L16-18 | `&:nth-child(even) .sftp-file-prop { background var(--main) }` | `background var(--surface-2)` |
| L19-22 `&:hover` | `background-color var(--primary); color var(--primary-contrast)`（**实测对比度 3.89:1，不达标**） | `background-color var(--hover-bg)` + `box-shadow inset 2px 0 0 0 var(--primary)` |
| L23-26 `&.selected` | 同上 | `background-color var(--active-bg)` + 左侧色条，文字 `var(--text)` |
| L38 | `border-radius 3px` | `var(--radius)` |
| L42 | `box-shadow 0px 0px 3px 3px var(--main-lighter)` | `var(--shadow-2)` |
| L46-50 | `:hover { background var(--primary); color var(--primary-contrast) }` | `var(--hover-bg)` + `var(--text)` |
| L134-135 / L162 | `!important` | 清理 |
| L19,48,128,185,193 | 仅 `:hover` | 补 §3.6 焦点环 |

### 4.5 ⑤ 底部栏

文件：`components/footer/footer.styl`、`cmd-history.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L1-8 `.main-footer` | 无上边框 | 补 `border-top 1px solid var(--border)` |
| L3 | `height 36px` | `var(--h-bar)` |
| L41-62 `.bi-full` | `box-shadow 0 -2px 8px rgba(0,0,0,.2)`；`border-radius 4px 4px 0 0` | `var(--shadow-2)`；`var(--radius) var(--radius) 0 0` |
| `cmd-history.styl:51` | `var(--text-color-secondary)`（未定义） | `var(--text-dark)` |
| `cmd-history.styl:24,39,66,72` | 仅 `:hover` | 补焦点环 |

### 4.6 ⑥ 右侧面板（AI 对话 / 终端信息）

文件：`components/side-panel-r/right-side-panel.styl`、`ai/ai.styl`、`terminal-info/terminal-info.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| `right-side-panel.styl:9` | `border-left 1px solid var(--main-darker)` | `var(--border)` |
| `right-side-panel.styl:18` | `border-bottom 1px solid var(--main-darker)` | `var(--border)` |
| `right-side-panel.styl:4` | `top 36px` | `var(--h-bar)` |
| `right-side-panel.styl:36-37` | `animation-duration .2s` | `var(--dur-2)` |
| `ai.styl:102,107,220` | `border-color #1890ff` | `var(--primary)` |
| `ai.styl:183` | `color #1890ff` | `var(--primary)` |
| `ai.styl:187` | `color #52c41a` | `var(--success)` |
| `ai.styl:190` | `color #ff4d4f` | `var(--error)` |
| `ai.styl:223,226` | `border-color #52c41a` / `#ff4d4f` | `var(--success)` / `var(--error)` |
| `ai.styl:127,206` | `var(--text-color-2)` | `var(--text-dark)` |
| AI 气泡 | 圆角散值 | 统一 `var(--radius-lg)`，底色 `var(--surface-2)` |

### 4.7 ⑦ 设置中心

文件：`components/setting-panel/{setting-wrap,list,setting}.styl`、`components/theme/{theme-form,terminal-theme-list}.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| `setting-wrap.styl:26` | `padding 20px 0 20px 20px` | `var(--sp-4) 0 var(--sp-4) var(--sp-4)` |
| `setting-wrap.styl:40` | `padding 20px` | `var(--sp-4)` |
| `setting-wrap.styl:66` | `padding 55px 20px 0 50px` | `55px var(--sp-4) 0 50px` |
| 左列表选中态（`list.styl`） | 主色块 | `var(--active-bg)` + `var(--radius-sm)` |
| 分节标题 | 字号不统一 | `var(--fs-xs)` + `letter-spacing .02em` + `--text-dark` |
| `theme-form.styl:3,5,8,10` | 4 处 `!important` | 用属性选择器组合替代 |

> ⚠️ 本区域**不要触碰主题编辑表单的校验逻辑**（§1.5 约束 A）。

### 4.8 ⑧ 表单弹窗（书签 / 树列表）

文件：`components/bookmark-form/bookmark-form.styl`、`common/color-picker.styl`、`components/tree-list/tree-list.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| `bookmark-form.styl:6` | `width 80px !important` | 清理 |
| `color-picker.styl:6` | `border 1px solid #ccc` | `var(--border)` |
| `color-picker.styl:9` | `background #fff` | `var(--surface-2)` |
| `tree-list.styl:29-30` | `background #000` / `color #eee` | `var(--surface-0)` / `var(--text)` |
| `tree-list.styl:81` | `border 1px solid #1a1a1a` | `var(--border)` |
| `tree-list.styl:25` | `outline 1px dashed var(--primary)` | **保留**（唯一现存焦点指示），统一到 §3.6 |

### 4.9 ⑨ 通用层（Modal / Drawer / Message / Notification）

文件：`components/common/{modal,drawer,message,notification}.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| `modal.styl:16` | `background rgba(0, 0, 0, 0.45)` | `var(--mask)` |
| `modal.styl:30` | `border-radius 8px` | `var(--radius-lg)` |
| `modal.styl:31` | 长串 antd 阴影 | `var(--shadow-3)` |
| `modal.styl:40,77` | `border-* 1px solid var(--main-darker)` | `var(--border)` |
| `modal.styl:62,89` | `border-radius 4px` | `var(--radius-sm)` |
| `modal.styl:67` | `:hover { background var(--main-darker) }` | `var(--hover-bg)` |
| `modal.styl:8,69` | `outline` 移除 | **保留**，交由 §3.6 焦点环接管 |
| `message.styl` / `notification.styl` | 无状态色条 | 左侧 3px 状态色条 + `var(--shadow-2)` |

### 4.10 ⑩ 右键菜单 ★ v2 新增（v1 最大遗漏）

文件：`components/sys-menu/sys-menu.styl`（宽 280/380px，L3/L64）

这是**最高频的交互组件之一**，v1 完全遗漏。

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L12-13 | `background #08c` / `color #eee` | `var(--primary)` / `var(--primary-contrast)` |
| L18 | `color #777` | `var(--text-disabled)` |
| L19 | `background #333` | `var(--surface-2)` |
| L61-62 | `background-color #08c` / `color #eee` | `var(--primary)` / `var(--primary-contrast)` |
| L11 | 仅 `:hover` | 补 §3.6 焦点环 |
| L22-23 | 行高（`36px` 系） | `var(--h-bar)` |
| 容器 | 无圆角/阴影 | `border-radius var(--radius)` + `var(--shadow-2)` + `var(--border)` |

> **对比度注意**：`--primary-contrast`(#fff) 在 `--primary`(#08c) 上仅 **3.89:1**（§5.4）。菜单项选中态若用主色实心 + 白字，属 AA 不达标。建议改为 `var(--active-bg)` + `var(--text)`。

### 4.11 ⑪ 快捷命令弹层 ★ v2 新增

文件：`components/quick-commands/qm.styl`（L1-73）

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L8 | `left 43px` | 保留（与 sidebar 宽度绑定），加注释说明与 `--w-sidebar` 的关系 |
| L12 | `bottom 36px` | `var(--h-bar)` |
| L21,44 | 固定宽度（会截断德/俄语文案） | 保留宽度，补 `text-overflow ellipsis` |
| L99 | `width 100% !important` | 用选择器层级替代 |
| L22,73 | `@media` 500px/768px | 保持，内部值换 token |

### 4.12 ⑫ 文件传输 / SSH 配置 / 登录页 ★ v2 新增

| 文件 | 行号 | 现状 | 改为 |
| --- | --- | --- | --- |
| `file-transfer/transfer.styl` | L3-6 | 硬编码宽高 | `var(--h-bar)` + token |
| `ssh-config/ssh-config.styl` | — | 列表项无 hover 反馈 | 补 `var(--hover-bg)` + 焦点环 |
| `auth/login.styl` | L7 | `background #fff`（**暗色主题下刺眼**） | `var(--surface-1)` |
| `main/wrapper.styl` | L4-5 | `.error-wrapper` 背景 | `var(--surface-1)` |
| `main/upgrade.styl` | L10,13 | `440px` / `400px` | 保留尺寸，内边距换 token |
| `main/term-fullscreen.styl` | 13 处 `!important` | 全屏适配确实需要 | **保留**，仅把尺寸/背景值换 token |
| `icons/ai-icon.styl` | — | 颜色 | 走 `currentColor` |
| `common/drag-handle.styl` | L13 | `background #08c` | `var(--primary)` |
| `common/remote-float-control.styl` | L19 | `color #fff` | `var(--primary-contrast)` |
| `common/{input-confirm-common,logo,highlight}.styl` | — | 散值 | 换 token；`logo.styl:6` 的 500px 断点保持 |

### 4.13 ⑬ RDP / VNC / SPICE 视图

文件：`components/rdp/rdp.styl`、`vnc/vnc.styl`、`spice/spice.styl`

- `vnc.styl:13,14,17`、`rdp.styl:13,14`、`spice.styl:15-24` 的 `!important` **保留**（全屏适配确实需要），仅把散落尺寸/背景值换成 token。
- `rdp.styl:49` 的 `outline` 移除**保留**，交由 §3.6 焦点环接管。
- 工具栏按钮统一：`32×32` + `var(--radius-sm)` + `:hover { background var(--hover-bg) }`。

### 4.14 ⑭ 窄屏适配

文件：`css/mobile.styl`（8 处 `!important`：L21、L22、L37、L40、L70、L97、L107、L195）

- 逐条用更高优先级选择器替代 `!important`。
- `L97 font-size 14px !important` → `var(--fs-lg)`；`L195 font-size 16px !important` → `var(--fs-lg)`。
- 移动端命中态统一 `--active-bg`。

> **注意**：移动端主逻辑是 `.is-mobile` 类 + `constants.js:200 mobileBreakpoint=600`，**不是 media query**。全库 `@media` 仅 6 处（500px×2、768px、1100px、`pointer: coarse`、`reduced-motion`）。改断点等于改布局行为 → **只换值不改断点**。

### 4.15 ⑮ 剩余零散硬编码（一次性清理）

| 位置 | 现状 | 改为 |
| --- | --- | --- |
| `tree-list/tree-list.styl:29,30,81` | `#000` / `#eee` / `#1a1a1a` | 见 §4.8 |
| `sys-menu/sys-menu.styl:12,13,18,19,61,62` | `#08c` / `#eee` / `#777` / `#333` | 见 §4.10 |
| `auth/login.styl:7` | `#fff` | 见 §4.12 |
| `tabs/tabs.styl:84,86,88,142,222,267` | `#e0e0e0` / `#ffffff` / `#fff`×3 | 见 §4.1 |
| `ai/ai.styl:102,107,183,187,190,220,223,226` | `#1890ff` / `#52c41a` / `#ff4d4f` | 见 §4.6 |
| `terminal/term-search.styl:9,10` | `#333` / `#aaa` | 见 §4.3 |
| `common/drag-handle.styl:13` | `#08c` | 见 §4.12 |
| `common/remote-float-control.styl:19` | `#fff` | 见 §4.12 |
| `sidebar/info.styl:4` | 渐变 | 见 §4.2 |
| `bookmark-form/common/color-picker.styl:6,9` | `#ccc` / `#fff` | 见 §4.8 |
| `terminal/terminal.styl:135` | `#888`（作 fallback） | 见 §4.3 |

---

## 五、七维度审计

对**全部拟改动项**从 7 个维度逐项审计。审计方法：静态分析 + 实测数据 + 爆炸半径推演。

### 5.1 维度一：功能正确性

**审计对象**：选择器命中范围、布局尺寸、可见性、层叠顺序、`display`/`overflow`/`pointer-events`。

| 审计项 | 方法 | 发现 | 动作 |
| --- | --- | --- | --- |
| 类名是否被重命名 | 全库 diff 比对 class 名 | 方案**零类名改动** | ✅ 安全 |
| DOM 结构是否变更 | 方案只改 `.styl` + 2 个 js | 零 DOM 变更 | ✅ e2e 可见性断言 8 处不受影响 |
| 布局尺寸是否变化 | 检查 `width/height/left/top/padding` 改动 | `36px` 系仅**语义化替换为 `--h-bar`**，值不变；`--sp-*` 替换的 padding 值需逐条核对**等价性** | ⚠️ **padding 替换必须数值等价**（如 `20px` → `var(--sp-4)`=16px **不等价！**） |
| 是否为元素新增 `display:none` | 检查新增规则 | 无 | ✅ |
| `!important` 清理是否改变层叠 | 逐处确认替代选择器优先级更高 | 45 处中 **21 处清理、15 处保留、1 处新增**（reduced-motion） | ⚠️ 清理处需逐一目视验证 |

> ⚠️ **发现一处方案缺陷**：§4.7 把 `padding 20px` 写成 `var(--sp-4)`(16px)，**改变了数值**，属布局变更。**修正**：间距 token 替换必须**数值等价**。`--sp-*` 系列（4/8/12/16/24）无法覆盖 20px/55px/50px 等值。**结论：间距 token 只用于新代码，现有 padding 一律保持原值不动。** 该修正已反映到"只做语义化收纳、不改数值"原则。

### 5.2 维度二：主题兼容性

**审计对象**：5 类主题 × 新增 20+ 变量。

| 主题 | 数量 | uiThemeConfig | 派生变量 | 静态变量 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 内置 default（暗） | 1 | 12 key | ✅ 正确 | ✅ | 通过 |
| 内置 defaultLight | 1 | 12 key | ✅ 正确 | ✅ | 通过 |
| iTerm 主题 | **310** | 12 key（实测样本） | ✅ 自动适配（含浅色主题） | ✅ | 通过 |
| 缺 `uiThemeConfig` | — | undefined → 回落默认 | ✅ | ✅ | 通过 |
| 空对象 `{}` | — | `''` → 全静态兜底 | ✅ 静态暗色 | ✅ | 通过 |
| 用户自建主题 | 不限 | 12 key | ✅ | ✅ | 通过 |

**关键审计结论**：因为采用**派生**而非**扩展**，**主题编辑器保存路径完全未被触碰** → §1.5 约束 A 的三类破坏（`Missing prop`、AI 提示词、主题文本格式）**全部不发生**。

**残留风险**：`--active-bg` / `--focus-ring` 派生自 `--primary`。若某 iTerm 主题的 `primary` 是浅色（如 `#FFD166`），`--active-bg`（18% 透明度）在浅色背景上可能过淡。**缓解**：`--active-bg` 用于选中底色，即使偏淡也仍可辨识（配合左侧色条）；不构成功能缺陷。

### 5.3 维度三：视觉一致性

**审计对象**：token 覆盖率、收敛度。

| 指标 | 改动前 | 改动后目标 | 度量方式 |
| --- | --- | --- | --- |
| 圆角种类 | 11 种 | **5 种**（全部 token） | `grep -rhoE "border-radius [0-9]+px"` 应为空 |
| 阴影写法 | 15 种 | **3 种** | `grep -rhoE "box-shadow [^;]*"` 去重后 ≤3 |
| 硬编码 hex | 32 处 | **0 处** | `grep -rEn "#[0-9a-fA-F]{3,8}"` 应为空 |
| 未定义变量引用 | 4 处 | **0 处** | §7.3 单测 1 拦截 |
| `transition` 覆盖 | 12 处/6 文件 | 主要交互元素全覆盖 | 目视 |
| `!important` | 45 处 | ≤16 处（保留 15 + reduced-motion 1） | `grep -rc "!important"` |

### 5.4 维度四：无障碍与对比度 ★ 实测

**方法**：用 WCAG 2.1 相对亮度公式实测算 19 组前景/背景组合。

#### 实测结果（深色主题）

| 组合 | 对比度 | 判定 |
| --- | --- | --- |
| `--info #FFD166` / `--main` | 12.98 | ✅ AA |
| `--text #ddd` / `--main` | 13.78 | ✅ AA |
| `--success #06D6A0` / `--main` | 9.92 | ✅ AA |
| `--warn #E55934` / `--main` | 5.18 | ✅ AA |
| `--error #EF476F` / `--main` | 5.17 | ✅ AA |
| `--text-dark #888` / `--main` | 5.28 | ✅ AA |
| `--primary #08c` / `--main` | 4.81 | ✅ AA |
| `--text-disabled #777` / `--main` | **4.18** | ⚠️ 仅大字号 |
| `#fff` / `--primary #08c`（按钮/选中态） | **3.89** | ⚠️ 仅大字号 |
| `#fff` / `--error #EF476F`（tab 关闭） | **3.62** | ⚠️ 图标达 3:1，文字不达 |

#### 实测结果（浅色主题）★ 问题集中区

| 组合 | 对比度 | 判定 |
| --- | --- | --- |
| `--text-dark #444` / `--main` | 8.32 | ✅ AA |
| `--text #555` / `--main` | 6.37 | ✅ AA |
| `#fff` / `--primary #08c` | **3.89** | ⚠️ 仅大字号 |
| `--text-light #777` / `--main` | **3.83** | ⚠️ 仅大字号 |
| `--primary #08c` / `--main` | **3.33** | ⚠️ 仅大字号 |
| `--error #EF476F` / `--main` | **3.09** | ⚠️ 仅大字号 |
| `--text-disabled #888` / `--main` | **3.03** | ⚠️ 仅大字号 |
| **`--success #06D6A0` / `--main`** | **1.61** | 🔴 **严重不达标** |

**结论与动作**：

| 发现 | 动作 |
| --- | --- |
| 🔴 **浅色主题下 `--success` 仅 1.61:1，几乎不可见** | **不在本次美化范围内修改**（改颜色值＝改主题语义，且要同步 310 个 iTerm 主题）。**记录为已知缺陷**，单独提 issue。本次通过 §4.4 把「主色实心 hover」改为 `--hover-bg`，间接消除最严重的一处（3.89:1） |
| ⚠️ `--text-light` 在浅色主题语义反转 | 深色下 `--text-light #fff` 是"更亮=更醒目"，浅色下 `#777` 是"更浅=更淡"。`sidebar.styl:92` 等 `:hover { color var(--text-light) }` 在浅色主题下 hover **反而变淡**。**动作**：记录，不在本次修改 |
| ⚠️ `--text-disabled` 深浅两个主题都不达 AA | 该变量语义即"禁用"，不达 AA 属常见取舍。**动作**：不改，但新代码不要用它承载需读的文字 |
| 🔴 **无键盘焦点可视化** | **本次修复**（§3.6）—— 这是本次唯一"新增无障碍能力"的改动 |
| 🟡 无 `prefers-reduced-motion` 兜底 | **本次修复**（§3.7） |
| 🟡 无 CJK 字体回退 | **本次修复**（§3.8） |
| 🟡 滚动条仅 `::-webkit-scrollbar` | 记录：Electron 只跑 Chromium，无需 `scrollbar-color`。**不改** |

### 5.5 维度五：性能

**审计对象**：CSS 体积、`transition`/`animation` 数量、重绘与合成开销。

| 审计项 | 现状 | 改动后预估 | 评估 |
| --- | --- | --- | --- |
| CSS 文件体积 | 单文件已压缩（1 行） | +约 2–3 KB（20 个变量 + transition 声明），约 +2% | ✅ 可忽略 |
| `transition` 数量 | 12 处 | 约 +40 处 | ✅ 均只覆盖 `background`/`color`/`border-color`（可合成或低开销属性），不影响布局 |
| 无限循环动画 | **6 处**：`session.styl:38`(60s)、`tabs.styl:111,122`(2s)、`ai.styl:184`(1s)、`bookmark-form.styl:52`(1.1s)、`rdp.styl:60`(1s) | 不变 | ⚠️ **不新增**。其中 `ai.styl:184`(1s) 与 `rdp.styl:60`(1s) 频率最高，若用户反馈耗电需单独优化 |
| 是否引入 `will-change` / `filter` / `backdrop-filter` | 方案未使用 | 0 | ✅ 避免过度合成 |
| 是否引入布局抖动 | `transition` 不含 `width/height/margin` | 0 | ✅ |
| `color-mix()` 运行时开销 | 新引入 6 个变量 | 仅在变量解析时计算一次（`:root` 级），元素消费的是已解析值 | ✅ 无逐帧开销 |
| antd `motion: false` → 恢复动效 | 当前全局关闭 | 恢复后 antd 组件带动画 | ⚠️ **本方案唯一有性能观感风险的改动**。缓解：若卡顿，改用 `motion: { motionDurationFast: '0.12s', motionDurationMid: '0.18s' }` 缩短时长而非关闭 |

**结论**：性能维度为**净中性偏好**（体积增长可忽略，`transition` 属性选择克制），唯一需观察的是 antd 动效恢复。

### 5.6 维度六：可维护性与可测试性

**审计对象**：token 单点定义、自动校验能力、命名一致性。

| 审计项 | 现状 | 改动后 | 评估 |
| --- | --- | --- | --- |
| 变量定义点 | 3 处副本（值不一致） | **1 处**（`theme-defaults.js` + `tokens.styl` 兜底） | ✅ |
| 是否存在静态检查 | 无（`standard` 只扫 JS，无 stylelint） | **新增 4 个单测**（§7.3） | ✅ 从"靠人眼"升级为"可回归拦截" |
| 命名一致性 | `--main-light`/`--main-lighter` 混用（3 vs 14 次） | 新增 token 统一 `--<类别>-<变体>` 格式 | ✅ 老变量保持不动（避免大面积改引用） |
| 能否自动发现「用了没定义的变量」 | ❌ 当前已存在 4 处静默失效 | ✅ 单测 1 拦截 | ✅ **本方案的核心工程价值** |
| 能否自动发现硬编码颜色 | ❌ | ✅ 单测 3 拦截 | ✅ |
| 文档化 | 无 | 本文档 + `tokens.styl` 内注释 | ✅ |

### 5.7 维度七：风险与可回滚性

| 步骤 | 爆炸半径 | 回滚成本 | 风险等级 |
| --- | --- | --- | --- |
| Step 1 新增 `tokens.styl` | 全局（纯新增） | **单文件删除** | 🟢 极低 |
| Step 2 合并 3 份默认主题 | 全局（仅 `--main` 差 `#141314`→`#121214`，肉眼不可辨） | 单文件 revert | 🟢 极低 |
| Step 3 补死变量 + 清 antd 残留名 | 3 个文件，4 处 | 单文件 revert | 🟢 极低 |
| **Step 4 收敛圆角/阴影** | **全局，观感变化最明显** | revert 1 个 commit | 🟠 **中** |
| **Step 5 修 antd 桥接** | **全局 antd 组件**（弹窗/下拉/表格/按钮/开关） | revert 1 个 commit | 🟠 **中** |
| Step 6 动效基线 | 全局（新增声明） | revert | 🟢 低 |
| Step 7 焦点环 + reduced-motion + CJK 字体 | 全局（纯新增 3 段） | revert | 🟢 低 |
| Step 8–22 逐区域精修（15 个） | **单区域** | 单区域 revert | 🟢 低 |
| Step 23 方案 B（theme-light class） | 全局阴影 | revert 3 行 | 🟢 低 |

**风险控制措施**：

1. **提交粒度**：每步一个 commit，commit message 带步骤号（如 `style(tokens): 新增设计 token，零视觉变化`），保证任意步骤可单独 revert。
2. **顺序不可换**：Step 1 是 Step 4-22 的前置；Step 4 必须在 Step 1 之后。区域精修必须在 token 就绪后，否则会产生新的硬编码。
3. **每步前后各跑一次 `npm run test-unit-ci`**（新增单测后生效）。
4. **观感类改动（Step 4、5、23）单独做，不与其他步骤混提交。**
5. **不做"顺手优化"**：例如看到 `--main-light` 只用了 3 次就去合并它 —— 超出范围，增加风险。

### 5.8 审计结论汇总

| 维度 | 结论 | 阻断级问题 |
| --- | --- | --- |
| 一 功能正确性 | ✅ 安全，但**修正了一处 padding 数值不等价缺陷** | 无 |
| 二 主题兼容性 | ✅ 因改「派生」后完全兼容 310+ 主题 | 无 |
| 三 视觉一致性 | ✅ 圆角 11→5、阴影 15→3、硬编码 32→0 | 无 |
| 四 无障碍对比度 | 🟠 修复 3 项；**发现 2 个既有缺陷（浅色 `--success` 1.61:1、`--text-light` 语义反转）建议单独提 issue** | 无（均在本次范围外） |
| 五 性能 | ✅ 净中性偏好；唯一观察点 = antd 动效恢复 | 无 |
| 六 可维护性 | ✅ 新增 4 个单测，把静默失效变为可拦截 | 无 |
| 七 风险回滚 | ✅ 7 个低风险 + 2 个中风险（各自独立可回滚） | 无 |

---

## 六、详细落地计划

### 6.0 总览

| 阶段 | 步骤 | 提交数 | 风险 |
| --- | --- | --- | --- |
| 准备 | Step 0 基线快照 | — | — |
| Layer 1 | Step 1 新增 tokens | 1 | 🟢 |
| Layer 2 | Step 2–7 统一层 | 6 | 🟢🟢🟢🟠🟠🟢🟢 |
| 单测 | Step 8 新增 4 个 spec | 1 | 🟢 |
| Layer 3 | Step 9–23 逐区域精修 | 15 | 🟢 |
| 可选 | Step 24 方案 B | 1 | 🟢 |

**每步通用验证模板**：

```bash
# 1) 编译（必须无错误）
npm run compile
# 2) CSS 语法完整性：产物应存在且能 grep 到关键字
ls -l work/app/assets/css/style-5.0.6.css
# 3) 单测（Step 8 之后生效）
npm run test-unit-ci
# 4) 目视
npm run t
```

### 6.1 Step 0 · 基线快照

**改什么**：无代码改动。

**做什么**：

```bash
cd /media/dp25/DATA/deb/fcitx5-deb/github/electerm
git status --short                      # 确认现有未提交改动
git stash list
# 记录基线指标
grep -rhoE "border-radius [0-9]+px" --include=*.styl src/client | sort -u
grep -rhoE "box-shadow [^;]*" --include=*.styl src/client | sort -u
grep -rEn "#[0-9a-fA-F]{3,8}\b" --include=*.styl src/client | grep -v "includes/" | wc -l
grep -rho "!important" --include=*.styl src/client | wc -l
grep -rhoE "var\(--[a-z0-9-]+" --include=*.styl src/client | sed 's/var(//' | sort -u
```

**历史包袱处理**（⚠️ 必须先解决）：

当前工作区已有**未提交改动**：`package.json`、`src/client/components/tabs/tabs.styl`（tabs 美化起步，含 §4.1 要改的 `--main-light` 边框和 `inset 0 2px` 高亮条）。

**动作**：先 `git add` + 提交这两个文件（commit message 如 `chore: 保留 tabs 美化起步改动`），**再**开始 Step 1。否则后续 `git diff` 无法区分新旧改动，也无法回滚。

**单测**：无。

**耗时**：1 分钟。

---

### 6.2 Step 1 · 新增 `tokens.styl`（零视觉变化）

**改什么**：

| 文件 | 改动 |
| --- | --- |
| `src/client/css/includes/tokens.styl` | **新建**，内容 = §2.3 |
| `src/client/css/includes/theme.styl` | 第 1 行前插入 `@require './tokens'` |
| `src/client/common/theme-defaults.js` | 仅把 `theme.styl:2` 的 `--main` 从 `#141314` 对齐为 `#121214`（与 `main=#121214` 一致） |

> **顺序关键**：`@require './tokens'` 必须在 `theme.styl` 的 `:root` **之前**，因为 `tokens.styl` 里的派生变量引用了 `--main-dark` 等。CSS 变量不存在"声明顺序依赖"（运行时解析），但 Stylus 是**文本拼接**，`@require` 位置决定产物中的书写顺序。放前面更易读，且避免 `:root` 块被拆散。

**怎么验证**：

```bash
npm run compile
# ① color-mix 是否存活于压缩产物（§2.4 的关键验证）
grep -c "color-mix" work/app/assets/css/style-5.0.6.css        # 期望 > 0
# ② 新变量是否进入产物
grep -o "\-\-surface-1" work/app/assets/css/style-5.0.6.css | head -1   # 期望有输出
grep -o "\-\-radius-lg" work/app/assets/css/style-5.0.6.css | head -1   # 期望有输出
# ③ 目视：应用外观应与 Step 0 完全一致
npm run t
```

**目视检查点**：标签栏、侧栏、终端、SFTP、设置、弹窗各扫一眼，颜色/布局**不应有任何变化**。

**是否单测**：❌ 不需要（纯新增变量，无逻辑）。但 Step 8 会补一个覆盖它的测试。

**回滚方式**：删除 `tokens.styl` + revert `theme.styl` 1 行。

**风险**：🟢 极低。

**耗时**：10 分钟。

---

### 6.3 Step 2 · 合并 3 份默认主题副本

**改什么**：

| 文件 | 行号 | 改动 |
| --- | --- | --- |
| `src/client/common/ui-theme.js` | L5-18 | 删除 `defaultUiThemeStylus` 常量，改为 `import { defaultTheme } from './theme-defaults'` 并由它生成 |
| `src/client/common/ui-theme.js` | L20 | `getUiThemeConfig(conf = ...)` 的默认参数改为从 `theme-defaults.js` 取 |
| `src/client/css/includes/theme.styl` | L1-16 | `:root` 仅保留兜底值；`--main` 对齐为 `#121214` |

**怎么验证**：

```bash
npm run compile && npm run t
# 目视：默认主题下颜色应与改动前一致（--main 从 #141314 → #121214，肉眼不可辨）
# 打开 设置 → 主题，确认主题列表正常加载、切换正常
node -e "const {defaultTheme}=require('./src/client/common/theme-defaults');console.log(Object.keys(defaultTheme().uiThemeConfig).length)" 2>/dev/null || echo "ESM，用轻量替代检查"
```

**是否单测**：⚠️ **建议加**（Step 8 单测 2 覆盖）—— 断言 `theme-defaults.js` 的 12 个 key 与 `theme.styl` 的静态兜底 key **集合一致**，防止再次分叉。

**回滚**：revert 本 commit。

**风险**：🟢 极低（唯一可见变化是 `--main` 差 2 个色阶）。

---

### 6.4 Step 3 · 补死变量 + 清 antd 残留名

**改什么**：

| 文件 | 行号 | 改动 |
| --- | --- | --- |
| `src/client/components/ai/ai.styl` | L127 | `var(--text-color-2)` → `var(--text-dark)` |
| `src/client/components/ai/ai.styl` | L206 | 同上 |
| `src/client/components/footer/cmd-history.styl` | L51 | `var(--text-color-secondary)` → `var(--text-dark)` |

（`--border` 与 `--hover-bg` 已在 Step 1 定义，无需改引用处。）

**怎么验证**：

```bash
npm run compile && npm run t
# 目视：AI 面板的次要文字、命令历史面板的文字颜色应正常显示（改动前因变量未定义而继承父级色）
```

**是否单测**：✅ **必须加**（Step 8 单测 1）—— 「所有 `var(--x)` 引用必须有定义」正是拦截这 4 处的一劳永逸方案。

**回滚**：revert。

**风险**：🟢 极低。

**附带收益**：`sidebar.styl:55` 的分隔线**从完全不显示变为正常显示** —— 这是修复了一个隐形缺陷，需在验收清单中确认。

---

### 6.5 Step 4 · 收敛圆角与阴影（🟠 观感变化最大）

**改什么**：按 §3.3 的两张映射表，逐文件替换。

**建议拆分**（避免单 commit 过大）：

| 子步骤 | 范围 | 文件 |
| --- | --- | --- |
| 4a | 圆角收敛 | 全部含 `border-radius` 的文件 |
| 4b | 阴影收敛 | `session.styl`、`sftp.styl`、`common/modal.styl`、`footer.styl`、`tabs.styl` |

**怎么验证**：

```bash
npm run compile
# ① 圆角：产物中不应再有裸 px 圆角（token 展开后是 px，但源码层面应清零）
grep -rEn "border-radius [0-9]+px" --include=*.styl src/client      # 期望：无输出
# ② 阴影：源码中只允许 5 种 token
grep -rhoE "box-shadow [^;]*" --include=*.styl src/client | sort -u  # 期望 ≤5 种，全部含 var(--shadow-
npm run t
```

**目视检查点**（这是观感最明显的一步，必须逐页对照）：

- 标签栏：标签顶部圆角是否协调
- 弹窗：圆角 8→12px 是否过圆；阴影是否过重
- SFTP 列表行、侧栏列表项
- 浮层（下拉、命令提示、AI 气泡）
- 深色 / 浅色主题各看一遍

**是否单测**：✅ **建议加**（Step 8 单测 4）—— 断言 `.styl` 中 `border-radius` / `box-shadow` 只允许 token 引用。这样后续新增样式无法"偷偷"引入新值。

**回滚**：revert 本 commit（4a/4b 各一个）。

**风险**：🟠 中。**这是唯一"改完可能觉得不好看"的步骤**，因此务必单独提交，便于整体回滚或微调 token 值。

---

### 6.6 Step 5 · 修复 antd 桥接（🟠 影响所有 antd 组件）

**改什么**：`src/client/store/store.js` L248-266，按 §3.4 替换整个 getter。

**怎么验证**：

```bash
npm run lint          # ⚠️ 唯一改 js 逻辑的步骤，必须跑 lint
npm run compile && npm run t
```

**目视检查点**（antd 组件全覆盖）：

- 设置中心（`Tabs` / `Select` / `Input` / `Button` / `Switch` / `Table`）
- 书签表单（`Form` / `Select` / `Modal`）
- 下拉菜单（`Dropdown` / `Menu`）
- 信息提示（`message` / `notification`）
- 表格（SFTP 的 `Table`）
- **重点看圆角是否统一为 8px、字号是否从 14 降到 13 后不显得过小**

**⚠️ 特别验证项**：

1. **`motion: false` 移除后**：快速连续打开/关闭弹窗 5 次，观察是否卡顿或动画残留。
2. **`fontSize: 13`**：与 `body` 的 `--fs-sm`(12px) 组合后，antd 组件内的文字是否与自制组件视觉一致。
3. **`colorBgElevated` / `colorBorder`**：SFTP 表格斑马纹、下拉面板背景是否正常（这两个是新引入的 token 映射）。
4. **浅色主题**：切到浅色主题，确认 antd `algorithm` 正确切换（`isColorDark` 逻辑未改，但 `colorBgBase` 等新增映射需验证）。

**是否单测**：⚠️ **可加但价值有限**（`uiThemeConfig` 是 getter，测它需要 mock `window.store`）。**建议不加**，靠目视。

**回滚**：revert 本 commit。**注意**：此步与 Step 4 有观感叠加效应，若整体不满可两步一起回滚。

**风险**：🟠 中（antd 组件数量多，回归面广）。

---

### 6.7 Step 6 · 动效基线

**改什么**：按 §3.5，对主要交互元素补 `transition`。

**建议拆分**：按区域分 2-3 个 commit（tabs/sidebar/footer 一批，sftp/sys-menu/qm 一批，common 一批）。

**怎么验证**：

```bash
npm run compile && npm run t
grep -rlc "transition" --include=*.styl src/client    # 应从 6 个文件增至 20+ 个文件
```

**目视检查点**：

- hover 标签、hover 侧栏图标、hover SFTP 行、hover 右键菜单项 —— 应有**平滑过渡**而非瞬变
- **关键**：过渡不应造成"闪烁"或"残影"（`transition` 属性选错会这样）

**是否单测**：❌ 不需要（纯视觉增强）。

**回滚**：revert。

**风险**：🟢 低。

---

### 6.8 Step 7 · 焦点环 + reduced-motion + CJK 字体

**改什么**：

| 文件 | 改动 |
| --- | --- |
| `src/client/css/basic.styl` | 末尾追加 §3.6 的 `:focus-visible` 规则 + §3.7 的 `@media (prefers-reduced-motion)` |
| `src/client/css/basic.styl` | L9 字体栈插入 CJK 字体（§3.8） |

**怎么验证**：

```bash
npm run compile && npm run t
```

**目视/交互检查点**（必须用键盘实测）：

1. **Tab 键遍历**：从窗口顶部开始按 Tab，焦点环应出现在标签栏 → 侧栏图标 → 内容区的顺序上，且**清晰可见**。
2. **鼠标点击**：点击任意按钮/列表项，**不应**出现焦点环（验证 `:focus-visible` 而非 `:focus` 生效）。
3. **reduced-motion**：在系统设置中开启"减少动画"（或 DevTools 里模拟 `prefers-reduced-motion: reduce`），确认动画/过渡基本停止。
4. **CJK 字体**：切换语言到中文/日文，确认汉字与英文/数字**字体一致**（不再出现混搭）。

**是否单测**：❌ 不需要。

**回滚**：revert。

**风险**：🟢 低。

> **注意**：这步是本次唯一"新增无障碍能力"的改动，也是**最容易被忽略验证**的一步。必须真按 Tab 键测一次。

---

### 6.9 Step 8 · 新增 4 个 CSS 契约单测 ★

**改什么**：新建 4 个 spec 到 `test/unit-ci/`。全部走 **CommonJS + `node:test`**（与现有 spec 一致，见 `test/unit-ci/sanitize-filename.spec.js` 的 `require('node:test')` 写法），纯文本分析，**不依赖 DOM / 浏览器 / 构建产物**。

| # | 文件 | 断言 | 拦截的问题 |
| --- | --- | --- | --- |
| 1 | `test/unit-ci/css-tokens.spec.js` | 扫描 `src/client/**/*.styl` 中所有 `var(--x)`，必须存在于 `css/includes/{theme,tokens}.styl` 的定义集合中 | **`--border` 类静默失效**（当前 4 处） |
| 2 | `test/unit-ci/theme-props.spec.js` | (a) `requiredThemeProps` 的 12 个 ui key ⊆ `theme.styl` 静态兜底 key；(b) 抽样校验 `@electerm/electerm-themes` 主题文件包含全部 12 个 ui key | **主题 key 与静态兜底分叉**（§1.5 约束 A/B） |
| 3 | `test/unit-ci/css-hardcoded-colors.spec.js` | `src/client/**/*.styl` 中不得出现硬编码 hex（allowlist：`theme.styl` / `tokens.styl`） | **硬编码颜色回流**（当前 32 处） |
| 4 | `test/unit-ci/css-radius-shadow.spec.js` | `border-radius` / `box-shadow` 只允许 `var(--radius*)` / `var(--shadow*)` | **圆角阴影重新发散**（当前 11 + 15 种） |

**实现要点**（保证可运行、不误报）：

- 用 `require('node:fs')` + `require('node:path')` 递归读文件，正则提取，`assert` 断言。
- 扫描范围限定 `src/client`，排除 `node_modules`。
- 单测 3 的 allowlist 要包含 `color-mix(in srgb, ...)` 里的颜色（若有）—— 本方案中 `tokens.styl` 内的 `rgba(0,0,0,.30)` 等需豁免。
- 单测 4 需容忍 `border-radius` 的多值写法（如 `var(--radius) var(--radius) 0 0`）。

**怎么验证**：

```bash
npm run test-unit-ci        # 期望：新增 4 个 spec 全部通过
```

**⚠️ 必须做的反向验证**（证明测试真的有效，而不是恒真）：

```bash
# 故意在某个 .styl 里加一行 var(--nonexistent-xyz)，跑单测 1 → 应失败
# 故意加一行 color #abcdcb，跑单测 3 → 应失败
# 验证后还原
```

**是否单测**：这步**本身就是单测**。

**回滚**：删除 4 个 spec 文件。

**风险**：🟢 极低。

**排序说明**：放在区域精修（Step 9+）**之前**，这样后续 15 个区域的改动都被自动看护。

---

### 6.10 Step 9–23 · 逐区域精修（15 个 commit）

按 §四 的顺序，**每个区域一个 commit**。顺序建议由「改动小、风险低」到「改动大、风险高」：

| 步骤 | 区域 | 文件数 | 风险 | 备注 |
| --- | --- | --- | --- | --- |
| Step 9 | ⑮ 零散硬编码清理 | 11 | 🟢 | 先清干净，后续改动不再踩 |
| Step 10 | ⑨ 通用层（modal/drawer/message/notification） | 4 | 🟢 | 复用面最广，先做 |
| Step 11 | ⑩ 右键菜单 `sys-menu` | 1 | 🟢 | **v1 遗漏项**，高频组件 |
| Step 12 | ⑪ 快捷命令 `quick-commands` | 1 | 🟢 | **v1 遗漏项** |
| Step 13 | ① 标签栏 | 3 | 🟢 | 已有起步改动，注意合并 |
| Step 14 | ② 侧栏 | 4 | 🟢 | 含 `--border` 修复验证 |
| Step 15 | ⑤ 底栏 | 2 | 🟢 | |
| Step 16 | ⑧ 表单弹窗 / 树列表 / 颜色选择器 | 3 | 🟢 | |
| Step 17 | ④ SFTP | 5 | 🟠 | hover 语义变更，重点目视 |
| Step 18 | ③ 终端会话区 | 4 | 🟠 | 涉及 xterm 容器，谨慎 |
| Step 19 | ⑥ 右侧面板 / AI | 3 | 🟠 | AI 气泡圆角变化 |
| Step 20 | ⑦ 设置中心 / 主题表单 | 5 | 🟠 | **不碰主题校验逻辑** |
| Step 21 | ⑫ 传输 / SSH 配置 / 登录页 | 10 | 🟢 | 含 `login.styl` 白底修复 |
| Step 22 | ⑬ RDP / VNC / SPICE | 3 | 🟢 | `!important` 保留 |
| Step 23 | ⑭ 窄屏 `mobile.styl` | 1 | 🟠 | 需窄窗口实测 |

**每个区域的验证流程**（统一模板）：

```bash
npm run compile
npm run test-unit-ci          # 4 个新单测应始终通过
npm run t
```

**目视检查点**：该区域的 **hover / active / selected / focus / disabled** 五种状态 + 深色/浅色两个主题。

**是否单测**：❌ 不改（Step 8 的 4 个单测已提供全局看护，会自动覆盖每个区域的改动）。

**回滚**：单区域 revert。

> **若某区域改完不满意**：不要在该 commit 上继续叠加修改，直接 `git revert` 后重做。保持"一区域一 commit"的干净历史。

---

### 6.11 Step 24 ·（可选）方案 B：精确阴影分档

**改什么**：`src/client/components/main/ui-theme.jsx` 的 `applyTheme()` 中追加 3 行（§2.6），`tokens.styl` 追加 `.theme-light` 块。

**怎么验证**：

```bash
npm run lint && npm run compile && npm run t
# 切换到浅色主题，确认阴影明显变浅
# 切换回深色主题，确认阴影正常
# 切到某个 iTerm 浅色主题（如 "3024 Day"），确认阴影也变浅
```

**是否单测**：❌ 不必要。

**回滚**：revert 3 行 + 删除 `.theme-light` 块。

**风险**：🟢 低。

---

### 6.12 最终验收清单

深色 / 浅色主题各走一遍，**逐项打勾**：

**结构类**
- [ ] 侧栏分隔线正常显示（Step 3 修复项）
- [ ] 无元素错位/塌陷/溢出
- [ ] 窗口缩放（>1100px / <1100px / <600px 三档）布局正常
- [ ] 终端 xterm 渲染区域未被影响

**主题类**
- [ ] 内置 default（暗）正常
- [ ] 内置 defaultLight（浅）正常
- [ ] 切到 3 个 iTerm 主题（含至少 1 个浅色如 "3024 Day"）正常
- [ ] **打开一个主题点保存 → 不报 `Missing prop`**（Step 1 派生方案的关键验证）
- [ ] 主题编辑器字段数量仍为 12 个 ui key（未被扩展）

**交互类**
- [ ] 标签：新增/切换/关闭/拖拽排序/右键菜单
- [ ] 侧栏：图标 hover/激活；书签、历史、传输三面板
- [ ] 终端：普通/分屏/全屏/搜索/批量输入
- [ ] SFTP：行 hover/selected/地址栏历史/文件对比/传输队列
- [ ] 底栏：命令历史/快捷命令/批量输入浮层
- [ ] 右侧面板：AI 对话（含工具调用卡片）/终端信息
- [ ] 设置：6 个 tab
- [ ] 弹窗：新增书签表单/树选择/颜色选择器/信息弹窗
- [ ] 通用：message/notification/drawer/右键菜单
- [ ] RDP/VNC/SPICE 视图

**无障碍类（Step 7）**
- [ ] 按 Tab 键能看到清晰的焦点环，顺序合理
- [ ] 鼠标点击**不**出现焦点环
- [ ] 开启"减少动画"后过渡基本停止
- [ ] 中文/日文界面字体一致

**回归类**
- [ ] `npm run lint` 通过
- [ ] `npm run test-unit-ci` 10 + 4 个 spec 全部通过
- [ ] `npm run compile` 无警告
- [ ] `grep -c "color-mix" work/app/assets/css/*.css` > 0

---

## 七、测试策略

### 7.1 能力边界（实测）

| 测试层 | 规模 | 能否验证样式 | 可用性 |
| --- | --- | --- | --- |
| `test/unit` | 19 spec | ❌ | **无 npm script，未接入任何流程** |
| `test/unit-ci` | 10 spec | ❌（当前）→ ✅（Step 8 后 +4） | 可运行，秒级 |
| `test/integration` | 2 spec | ❌ | 需活体 MCP server，自 skip |
| `test/e2e` | 48 spec | ⚠️ 仅可见性 | **Playwright 未安装，当前跑不起来** |

### 7.2 能自动化的 vs 不能自动化的

| 类型 | 能否自动化 | 手段 |
| --- | --- | --- |
| 变量引用/定义一致性 | ✅ | Step 8 单测 1 |
| 主题 key 契约 | ✅ | Step 8 单测 2 |
| 无硬编码颜色 | ✅ | Step 8 单测 3 |
| 圆角/阴影收敛 | ✅ | Step 8 单测 4 |
| CSS 编译无错误 | ✅ | `npm run compile` |
| `color-mix` 存活 | ✅ | grep 产物 |
| JS 逻辑无 lint 错误 | ✅ | `npm run lint` |
| **观感是否变好** | ❌ | **只能人眼判断** |
| **对比度是否改善** | ⚠️ 半自动 | 可扩展单测，但需维护期望值表 |
| **交互是否流畅** | ❌ | 人眼 |
| **键盘焦点顺序** | ❌ | 人工按 Tab |

**诚实结论**：本次改动的核心价值（观感）**无法自动化验证**，自动化测试守住的是"不引入回归"的下限。因此 §6.12 的手工验收清单不可省略。

### 7.3 新增单测设计（Step 8 详情）

已见 §6.9。补充实现注意：

- **单测 1 的边界**：需处理 `var(--x, fallback)` 形式（取逗号前的变量名），以及 `tokens.styl` 里 `color-mix(in srgb, var(--text) 14%, transparent)` 这类嵌套引用。
- **单测 2 的边界**：`@electerm/electerm-themes` 在 `node_modules` 里，若未安装应 `skip` 而非 fail（参考 `test/integration` 的自 skip 模式）。
- **单测 4 的边界**：允许 `border-radius` 值为 `var(--radius) var(--radius) 0 0`（多值），以及 `50%`（圆形头像等几何用途）。

### 7.4 e2e 现状警告

⚠️ **不要把 e2e 作为验证门禁**：

1. Playwright **未安装**，需先 `npm run prepare-test`（会 `npm i -E playwright@1.28.1 --no-save`）。
2. **Playwright 1.28.1 发布于 2022 年，项目用 Electron 42.8.1（2025 年）**，`_electron.launch()` 的兼容性存疑。
3. CI 的 e2e（`mac-test-1/2/3.yml`）只在 **macOS** + 特定分支触发，与你的 Linux 环境不一致。

**建议**：若想增加信心，可尝试 `npm run prepare-test` 后跑单个 spec 抽查：

```bash
npx playwright test test/e2e/005.5.split-view.spec.js --workers=1
```

但这属于"额外收获"，**不应作为 Step 4/5 的放行条件**。

---

## 八、试色通道（零构建成本）

改源码前可用这两个通道验证观感，**不用 `npm run compile`**：

1. **设置 → 通用 → 自定义 CSS**（`setting-common.jsx:549-553` → `custom-css.jsx:9-23`）：把 §2.3 的 token 和几条覆盖规则贴进去，**即时生效**。
   - ⚠️ 注意 `custom-css.jsx:16` 会把 `@import` 替换掉，只贴纯 CSS。
2. **主题编辑器**（`components/theme/`）：改 12 个颜色值，经 `ui-theme.jsx` 实时写入 `:root`。
   - 可快速试 `--primary` 换色后 `--active-bg`/`--focus-ring`（派生自 primary）的效果。

> **用途**：Step 4（圆角/阴影收敛）观感风险最高，建议先用自定义 CSS 通道贴一版 `--shadow-*` / `--radius-*` 的值试手感，满意后再落源码。

---

## 九、风险登记册

| # | 风险 | 概率 | 影响 | 缓解措施 |
| --- | --- | --- | --- | --- |
| R1 | Step 4 圆角/阴影收敛后观感变差 | 中 | 中 | 单独 commit，可整体 revert；先在自定义 CSS 通道试色 |
| R2 | Step 5 移除 `motion: false` 后 antd 组件卡顿 | 低 | 中 | 改用 `motion: {motionDurationFast/Mid}` 缩短时长而非关闭 |
| R3 | iTerm 主题下新变量表现异常 | 低 | 低 | 派生方案已覆盖；用 3 个 iTerm 主题（含浅色）实测 |
| R4 | `color-mix` 在压缩产物中被改写 | 极低 | 高 | Step 1 强制 grep 产物验证；有降级方案 |
| R5 | `!important` 清理改变层叠导致样式失效 | 中 | 低 | 逐处目视；保留 15 处确实需要的 |
| R6 | 间距 token 替换改变数值导致布局位移 | **中** | 中 | **已修正方案**：现有 padding 一律不改（§5.1） |
| R7 | 主题编辑器保存被破坏 | 极低 | 高 | **已由派生方案规避**（§2.5） |
| R8 | 未提交的 `tabs.styl` 改动与 Step 4 冲突 | 中 | 低 | Step 0 先提交存档 |
| R9 | e2e 无法运行导致回归盲区 | 高 | 低 | 安全边界（不改类名/DOM/尺寸）+ 手工清单兜底 |
| R10 | 浅色主题既有缺陷（`--success` 1.61:1）被误认为本次引入 | 中 | 低 | 在文档 §5.4 明确标注为**既有缺陷**，单独提 issue |

---

## 十、执行边界（红线）

以下行为**绝对禁止**，任何一条都会破坏 e2e 或引入不可控问题：

1. ❌ 重命名任何 CSS 类名
2. ❌ 增删/移动任何 DOM 节点
3. ❌ 修改 `36px` / `340px` / `280px` / `600px` 等布局骨架的**数值**
4. ❌ 修改主题校验相关代码（`requiredThemeProps`、`validThemeProps`、`convertTheme*`）
5. ❌ 修改 `.is-mobile` 判断逻辑或 `mobileBreakpoint`
6. ❌ 修改 `css-overwrite.jsx`（终端背景图生成逻辑）
7. ❌ 修改 `bg/shapes.js`（马赛克背景生成）
8. ❌ 为 5 个零 styl 目录（`text-editor`/`widgets`/`shortcuts`/`batch-op`/`bg`）新建 `.styl`
9. ❌ 在 `tokens.styl` 重复定义 `--main-darker` / `--main-lighter`
10. ❌ 修改既有 padding/margin 的**数值**（只允许对新代码使用 `--sp-*`）