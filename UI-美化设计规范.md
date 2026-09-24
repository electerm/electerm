# electerm UI 美化设计规范 · v3（已按 5.5.26 修订）

> ✅ **前置条件已满足**：代码已升级到上游 **5.5.26**（HEAD `c9029f9c`），lint / compile / 450 单测 / 应用启动全部通过。
> 本文档的**全部行号均按合并后的实际代码复核**（2026-09-23），可直接作为施工依据。
> 环境要求（Node 22、`--legacy-peer-deps`、产物文件名）见 → [上游5.5.26升级与样式差异审计.md](./上游5.5.26升级与样式差异审计.md) §十三。

> 目标：在不改动布局结构、不重命名任何类名、不增删任何 DOM 节点的前提下，为全部页面建立统一的「色阶 / 圆角 / 阴影 / 动效 / 焦点」五套体系。
> 适用范围：`src/client` 下全部 **67 个 `.styl` 文件** + 4 个 js 文件（`store.js`、`ui-theme.jsx`，其余只读）。
> 原则：先打地基（token）→ 再统一（清账 + 收敛）→ 最后逐区域精修。每一步都可独立验证、可回滚。

---

## 修订记录

| 版本 | 变更 |
| --- | --- |
| v1 | 初版：现状分析、3 层方案、11 区域精修、落地顺序 |
| v2 | 深度复核后修订，含 3 处方案级修正（token 派生、焦点环、单测层） |
| **v3** | **按 5.5.26 实测代码全面校准**：17 项修订（见下） |
| **v4** | **深度设计定案（2026-09-24 用户确认）**：新增「Tinted Console」品牌浸染层 —— 浸染色阶 4 级 / --accent-glow 光晕 / 状态色底芯片 / 渐变强调线 / 等宽点缀。全部 color-mix 派生，红线不变（新增属性仅 transform）。见 §2.8；预览草图：美化效果预览草图-v4深度版.html |

### v3 的 17 项修订（来源：审计文档 §十）

| # | 修订 | 类型 |
| --- | --- | --- |
| 1 | 撤销自造 `--h-bar` / `--w-sidebar`，**改为这些 36px 保持原数值不替换** | 🔴 方案级 |
| 2 | 撤销自造 `--focus-ring`，改用上游 `item-filter` 的**描边式焦点环** | 🔴 方案级 |
| 3 | 撤销 `--mask` 对 `--main-darker` 的依赖，改静态 `rgba(0,0,0,.45)`（与现值一致） | 🔴 方案级 |
| 4 | `.main-footer` 补边框改用 `box-shadow inset`（原 `border-top` 会外扩 1px = 布局位移） | 🔴 方案级 |
| 5 | 全部行号按合并后代码重算（6 必算 + 10 抽验，含 `tabs.styl` 321 行） | 校准 |
| 6 | §4.13 作用对象迁到 `common/remote-session-shell.styl` | 校准 |
| 7 | §4.3 的 `.vnc-scroll-wrapper` 条目迁到 `vnc.styl` | 校准 |
| 8 | §4.7 断点 1100px → **800px** | 校准 |
| 9 | 新增 §4.16 / §4.17 两个精修区域（9 个上游新文件） | 补全 |
| 10 | §1.3 文件清单 58 → **67** | 补全 |
| 11 | §1.4 / §7 测试现状更新（`src/test/`、30 unit-ci / 450 test、54 e2e、playwright 1.49.1） | 补全 |
| 12 | §7.4 删除"e2e 不可用"警告 → 改为"可用，建议抽查放行" | 补全 |
| 13 | §6.9 单测落点 `test/unit-ci/` → **`src/test/unit-ci/`** | 校准 |
| 14 | §5.4 对比度重新实测（新增 4 组新 UI 组合） | 补全 |
| 15 | §5.5 `!important` 目标 ≤16 → **≤20**（实测 46 处） | 校准 |
| 16 | 新增 §3.9 `darker()` 非法颜色缺陷的最小修复 | 🔴 新发现 |
| 17 | 更正 5 处 `outline` 的语义误读（`tree-list` 等**不是**焦点指示） | 更正 |

### v2 的三处关键修正（仍然有效）

| 修正 | 原因 |
| --- | --- |
| **token 从「扩展」改为「派生」** | v1 提议给主题加 20+ 个新 key，但 `requiredThemeProps` 是**必填白名单**，会导致主题编辑器保存失败、310 个 iTerm 主题与新变量脱节。改为从既有 12 个颜色**派生**，零侵入。 |
| **补 `focus-visible` 层** | 全库仅 2 个新组件局部实现，无全局焦点环。这是键盘用户的硬伤，v1 遗漏。 |
| **补单测层** | v1 只给 grep 命令。v2 新增 4 个可直接纳入 `npm run test-unit-ci` 的单测，把「变量未定义」这类问题变成**回归可拦截**。 |

---

## 一、现状分析

### 1.1 样式体系结构

样式变量目前是「三层 + 一个旁路」：

| 层 | 位置 | 说明 |
| --- | --- | --- |
| 变量静态默认值 | `src/client/css/includes/theme.styl` L1-16 | 15 个 CSS 变量，仅深色值 |
| 运行时覆盖 | `src/client/components/main/ui-theme.jsx` L31-50 | 把主题配置写成 `<style id="theme-css">:root{…}`；key 为 `main` 时自动派生 `--main-darker` / `--main-lighter` |
| antd 桥接 | `src/client/store/store.js` L266-283 | `uiThemeConfig` getter → `ConfigProvider theme` |
| 用户旁路 | `src/client/components/bg/custom-css.jsx` L9-23 | 把 `config.customCss` 注入 `<style id="custom-css">` |

> `<style id="theme-css">` 容器在 `src/client/views/index.pug` L40/L44 声明，产物中位于 `<link rel=stylesheet>` **之后** → 运行时注入值**优先于** `theme.styl` 的静态兜底。

变量消费频率（`src/client` 全量 grep，含 jsx）：

```
--text 58   --primary 54   --main 48   --main-darker 29   --main-lighter 26
--success 24  --text-light 23  --text-dark 23  --main-dark 12  --error 12
--main-light 11  --primary-contrast 9  --text-disabled 7  --warn 5  --info 1
--shortcut-bar-h 9  --shortcut-bar-kb-offset 9  --left-side-bar-width 6  --footer-stack-height 5   ← 上游 5.5.26 自造
--border 3  --text-color-2 2  --text-color-secondary 1  --hover-bg 1                                ← 未定义（见 §1.2）
```

即：**原有 15 个变量全是颜色**，没有任何「分隔线、悬浮底色、遮罩、阴影、圆角、间距、字号、动效时长、焦点环」变量。

### 1.2 问题清单

严重度：🔴 阻断/明显缺陷　🟠 体验问题　🟡 整洁度问题

| # | 严重度 | 问题 | 证据（行号为 5.5.26 实测） |
| --- | --- | --- | --- |
| 1 | 🟠 | 设计 token 太薄 | `theme.styl` 16 行，15 个变量全是颜色 |
| 2 | 🟠 | 圆角不成体系 | 全库 `border-radius` 出现 **12 种值 / 45 处**：2/3/4/5/6/8/10/14/15/20/28/30px |
| 3 | 🟠 | 阴影不成体系 | **22 种** `box-shadow` 写法，含 `inset 0 0 5px var(--main-darker)`、`0 0 3px 3px var(--main-lighter)` 这类「用背景色假装阴影」 |
| 4 | 🔴 | **4 个变量被引用但从未定义（静默失效）** | `--border`（`sidebar.styl:57` + 2 处 jsx 带兜底）、`--text-color-2`（`ai.styl:157,236`）、`--text-color-secondary`（`cmd-history.styl:65`）、`--hover-bg`（`tree-list.styl:136`，带兜底） |
| 5 | 🔴 | **`darker()` 产生非法颜色 → 29 处声明整条失效** | `ui-theme.jsx` L11-29 缺上界钳制。`darker('#121214',0.3)='#0'`、`darker('#ededed',-0.3)='#1393939'`。注入的 `#theme-css` 覆盖了 `theme.styl:15-16` 的合法兜底值 |
| 6 | 🟠 | 默认主题有 3 份副本且值不一致 | `theme.styl:2` = `#141314`；`common/theme-defaults.js:31` = `#121214`；`common/ui-theme.js:6` = `#141314`。**Step 2 已对齐前两处**；第三处经实测确认为**死代码**（见 §3.1），处置决策见 §6.3 |
| 7 | 🟠 | antd 桥接不完整 | `store.js:271` 硬编码 `borderRadius: 3`；`store.js:280` `motion: false` 关闭全部 antd 动效；`basic.styl:7` 全局 12px 与 antd 默认 14px 冲突 |
| 8 | 🟠 | 几乎零动效 | 67 个 `.styl` 中 `transition` 仅 **8 个文件**有 |
| 9 | 🟠 | 硬编码颜色残留 | **33 处**：`ai.styl`9、`sys-menu.styl`6、`tabs.styl`6、`tree-list.styl`3、`term-search.styl`2、`color-picker.styl`2、`terminal.styl`/`info.styl`/`remote-float-control.styl`/`drag-handle.styl`/`login.styl` 各 1；另有 `cmd-history.styl:32,85` 的 `red`/`blue` 命名色 |
| 10 | 🟡 | 层叠失控 | **46 处** `!important`：`term-fullscreen.styl`(19)、`mobile.styl`(8)、`spice.styl`(7)、`sftp.styl`(3)、`terminal.styl`(3)、其余 6 文件各 1 |
| 11 | 🟡 | 内联样式散布 | 多个 `.jsx` 含 `style={{}}`（`--ai-watermark`、`var(--border,#333)` 等） |
| 12 | 🔴 | 浅色主题对比度不达标 | 实测 `--success #06D6A0` 在 `#ededed` 上仅 **1.61:1**，见 §5.4 |
| 13 | 🔴 | 无全局键盘焦点可视化 | 仅 `item-filter.styl`(3) 与 `remote-monitor-bar.styl`(4) 两个新组件局部实现 |
| 14 | 🟡 | 无中文字体回退 | `basic.styl:9` 字体栈无 CJK 字体，中日文 locale 会串字体 |
| 15 | 🟡 | 无 `prefers-reduced-motion` 全局兜底 | 全库仅 3 处：`bookmark-form.styl:62`、`monitor-details.styl:85`、`remote-monitor-bar.styl:104` |

### 1.3 视图区域完整清单（67 个 `.styl`）

**已覆盖（36）**：`tabs/{tabs,add-btn,no-session}`、`sidebar/{sidebar,info,transfer,transfer-history}`、`session/{session,session-control}`、`terminal/{terminal,term-search}`、`sftp/{sftp,code-compare,file-compare-modal,transfer-tag,address-bookmark}`、`footer/{footer,cmd-history}`、`side-panel-r/right-side-panel`、`ai/ai`、`terminal-info/terminal-info`、`setting-panel/{setting,setting-wrap,list}`、`theme/{theme-form,terminal-theme-list}`、`bookmark-form/bookmark-form`、`tree-list/tree-list`、`common/{modal,drawer,message,notification}`、`rdp/rdp`、`vnc/vnc`、`spice/spice`、`css/mobile.styl`

**v1 遗漏、v2 已补（22）**：

| 文件 | 负责的 UI | 优先级 |
| --- | --- | --- |
| `sys-menu/sys-menu.styl` | 全部右键/上下文菜单（宽 280/380px，L3/L64） | 🔴 最高频交互 |
| `quick-commands/qm.styl` | 快捷命令弹层（105 行） | 🔴 高频 |
| `file-transfer/transfer.styl` | 右侧传输进度列表（50 行） | 🟠 |
| `auth/login.styl` | 登录页 —— **硬编码白底 `#fff`（L7），暗色主题下刺眼** | 🟠 |
| `layout/layout.styl` | 布局容器与 `drag-over` 指示（6 行） | 🟠 |
| `main/{wrapper,upgrade,term-fullscreen}.styl` | 升级提示、终端全屏（`term-fullscreen` 含 19 处 `!important`） | 🟠 |
| `ssh-config/ssh-config.styl` | SSH 配置导入列表（**仅 3 行**） | 🟠 |
| `css/includes/{theme,box,text,font-size,index}.styl` | 变量定义 + 工具类（`.pd*/.mg*/.elli/.font*`） | 🔴 token 落点 |
| `css/basic.styl` | 全局根/字体/滚动条/拖拽指示（62 行） | 🔴 token 落点 |
| `icons/ai-icon.styl` | AI 图标（5 行） | 🟡 |
| `common/{drag-handle,input-confirm-common,logo,highlight,remote-float-control}.styl` | 拖拽把手、确认输入、Logo、高亮、远端浮控 | 🟠 |
| `bookmark-form/common/color-picker.styl` | 颜色选择器（硬编码 `#ccc`/`#fff`） | 🟠 |

**★ 5.5.26 新增的 9 个 `.styl`（v2 未覆盖，v3 纳入 §4.16/§4.17）**：

| 文件 | 行数 | 性质 |
| --- | --- | --- |
| `terminal/shortcut-bar.styl` | 214 | **全新区域**：终端底部快捷键条 |
| `remote-monitor/remote-monitor-bar.styl` | 106 | **全新功能**：远程资源监控条 |
| `remote-monitor/monitor-details.styl` | 87 | **全新功能**：监控详情面板 |
| `common/remote-session-shell.styl` | 80 | **重构抽离**：RDP/VNC/SPICE 公共外壳 |
| `common/item-filter.styl` | 54 | 新通用组件：列表过滤/搜索框 |
| `common/responsive-tabs.styl` | 34 | 新通用组件：响应式标签容器 |
| `ai/ai-history.styl` | 23 | AI 历史面板 |
| `quick-commands/quick-command-ai-editor.styl` | 13 | 快捷命令 AI 编辑器 |
| `common/switch.styl` | 7 | 新通用组件：开关 |

**另有一个结构性盲区**：`text-editor/`、`widgets/`、`shortcuts/`、`batch-op/`、`bg/` **5 个目录零 `.styl`**，UI 完全复用全局类。这意味着：

- 对这些区域的样式调整**只能改全局类**，爆炸半径会外溢到其他区域 → 必须放在最后做。
- `widgets` 已有 Beta 入口，未来会独立成模块，现阶段不要为它单独建 `.styl`。

### 1.4 测试与构建现状（决定验证策略）

| 项 | 5.5.26 现状 | 对方案的影响 |
| --- | --- | --- |
| `src/test/unit-ci` | **30 个 spec / 450 个 test**，`node --test` 运行，**CommonJS** | ✅ **450/450 通过**，可扩展为 CSS 契约测试（见 §6.9） |
| `src/test/e2e` | **54 个 spec**，Playwright 驱动 Electron | 见下方「关键结论」 |
| `src/test/integration` | 2 个 spec，需活体 MCP server，否则自 skip | 与样式无关 |
| **样式断言** | **全库 0 处**：`getComputedStyle`/`toHaveCSS`/`toHaveClass`/`border-radius`/`box-shadow`/`toHaveScreenshot` 均无命中 | **纯样式改动不会打破任何断言** |
| 可见性断言 | 8 个文件用 `toBeVisible()`/`toBeHidden()` | **唯一的雷区**：不得让元素 `display:none` 或移除 DOM |
| e2e 定位方式 | **全部 CSS 类选择器**，无 `data-testid`/`getByRole`。高频：`.session-current`(31)、`.ant-dropdown`(31)、`.tabs`(22)、`.sftp-item`(10)、`.term-wrap`(9)、`.tab`(9) | **不得重命名类名、不得调整 DOM 层级** |
| Playwright | **1.49.1（已升级，可安装）** | ✅ e2e 具备可用条件，可作抽查放行（§7.4） |
| lint | `standard --verbose`，**只扫 JS，不检查 `.styl`** | 样式错误没有静态拦截 → 需新增单测补位 |
| stylelint / prettier / postcss | **全部不存在** | `color-mix()` 不会被降级（见 §2.4） |
| CI 测试门禁 | 仅 `mac-test-1/2/3.yml`，特定分支 push 触发，**无 `pull_request` 触发** | 无 PR 级自动拦截，靠本地验证 |

**关键结论**：安全边界 = **不改类名、不删/隐藏 DOM 节点、不改布局尺寸**。在此边界内，纯样式改动不会打破任何测试。

**构建链路**（环境要求见审计文档 §十三：**Node 22 + `--legacy-peer-deps`**）：

| 命令 | 作用 | 耗时量级 |
| --- | --- | --- |
| `npm run compile` | 仅 vite 编译 → `work/app/assets/` | 秒级 |
| `npm run t` | 直接 `electron work/app/app.js` 启动 | 秒级 |
| `npm run bdebfast` | 自增号 → 删旧 assets → compile → prepare → asar → `fakeroot dpkg-deb` → `dist/electerm-5.5.26-test.N-linux-amd64.deb` | 数十秒 |
| `npm run test-unit-ci` | `node --test src/test/unit-ci/*.spec.js` | 秒级 |

**产物文件名（所有 grep 验证都用它）**：`work/app/assets/css/style-5.5.26.css`

> ⚠️ 目录里另有旧产物 `style-5.0.6.css`，**是升级前遗留，不要拿它验证**。
> ⚠️ 编译有一条**既有无害告警**：`cp: .../@electerm/electerm-resource/tray-icons/*`（该包 2.2.1 起无此目录），不是本次引入。

**开发快循环**：`npm run compile && npm run t` —— 改 `.styl` 后无需打 deb。

### 1.5 主题系统的三个硬约束 ★

这是 v2 最重要的补充。**决定了新 token 必须怎么设计**。（5.5.26 实测：三个约束**全部未变化**）

#### 约束 A：主题 key 是「必填白名单」，不能扩展

`src/client/common/terminal-theme.js` L13-47：

```js
export const requiredThemeProps = [
  'main', 'main-dark', 'main-light', 'text', 'text-light', 'text-dark',
  'text-disabled', 'primary', 'info', 'success', 'error', 'warn',
  'terminal:foreground', /* … 共 20 个 terminal: 前缀 key */
]   // 合计 33 个 key
export const validThemeProps = [...requiredThemeProps, 'name']   // L48-51
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

## 二、Layer 1 · token 体系

### 2.1 设计原则：派生 > 扩展 ★

由 §1.5 三个约束推出**唯一可行的架构**：

```
既有 12 个主题色（用户可编辑，白名单锁定）
     │
     ├─ 直接复用：--surface-0/1/2  ←  var(--main-dark) / var(--main) / var(--main-light)
     │
     └─ 派生：--border / --hover-bg / --active-bg  ←  color-mix(in srgb, var(--text) N%, transparent)

其余（圆角 / 阴影 / 遮罩 / 间距 / 字号 / 动效）→ 纯静态常量，与主题无关
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

**收益**：新增 18 个变量，而**用户可编辑的主题字段仍是 12 个**——能力变强，界面不变。

**★ v3 补充的第三条理由：`darker()` 已损坏，不能作为派生源。**

`ui-theme.jsx` L11-29 的 `darker()` 缺上界钳制，实测：

| 输入 | 输出 | 合法？ |
| --- | --- | --- |
| `darker('#121214', 0.3)`（默认深色主题） | `#0` | ❌ 2 字符 |
| `darker('#ededed', -0.3)`（浅色主题） | `#1393939` | ❌ 8 字符 |
| `darker('#ffffff', -0.3)` | `#14b4b4b` | ❌ 8 字符 |
| `darker('#121214', -0.3)` | `#5e5e60` | ✅ |

后果：**默认深色主题下 29 处 `var(--main-darker)` 的整条声明失效**（边框/阴影直接不渲染）。
因此新 token **一律不得引用 `--main-darker` / `--main-lighter`**（旧引用按 §4 逐区域替换掉）。

### 2.2 变量清单

> ⚙️ **v4 调整说明**：本节 v3 数值中，`--border` 14%→**12%**、`--hover-bg` 8%→**7%**、`--active-bg` 18%→**16%**、
> 圆角 sm 6→**8** / 基准 8→**10** / lg 12→**14**、阴影三档略加深；`--surface-0/1` 从直接引用改为 **primary 浸染**（§2.8）。
> 下表保留 v3 记录，**以 §2.3 / §2.8 的 v4 值为准**。

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

#### B. 静态变量（与主题无关，纯常量）

| 变量 | 值 | 变量 | 值 |
| --- | --- | --- | --- |
| `--radius-xs` | `4px` | `--shadow-1` | `0 1px 2px rgba(0,0,0,.30)` |
| `--radius-sm` | `6px` | `--shadow-2` | `0 4px 12px rgba(0,0,0,.34)` |
| `--radius` | `8px` | `--shadow-3` | `0 16px 40px rgba(0,0,0,.45)` |
| `--radius-lg` | `12px` | `--mask` | `rgba(0,0,0,.45)` |
| `--radius-pill` | `999px` | `--dur-1` / `--dur-2` | `120ms` / `180ms` |
| `--sp-1` … `--sp-5` | `4/8/12/16/24px` | `--ease` | `cubic-bezier(.4,0,.2,1)` |
| `--fs-xs` … `--fs-lg` | `11/12/13/16px` | | |

> **`--mask` 为何取静态 `rgba(0,0,0,.45)`**：与 `modal.styl:16` / `drawer.styl:14` 的现值**完全一致 → 零视觉变化**；
> 且规避对 `--main-darker`（§2.1 已证实非法）的依赖。
>
> **阴影为何静态**：浅色主题需要更弱的阴影（`rgba(0,0,0,.06)` vs 深色 `.34`），但约束 A 不允许新增主题 key。折中取中间值（`.30/.34/.45`），深色下略弱、浅色下略强，**均为可接受的观感差异，不构成缺陷**。若需精确分档，见 §2.6 方案 B。

#### C. ❌ 已撤销的自造变量（v3 变更，**务必不要创建**）

| 原变量 | 撤销原因 |
| --- | --- |
| `--h-bar 36px` | 想收纳的 5 处 36px（tabs 高 / `.main-footer` 高 / `.session-wrap` padding-top / `.right-side-panel` top / `.sidebar-panel` top）**语义各不相同**，且**没有一处等于上游的 `--footer-stack-height`**（后者是 footer + 远端监控条的**动态**合计高度）。→ **一律保持原数值 `36px`，不做 token 化。** |
| `--w-sidebar 36px` | `.sidebar{width:36px}` 是图标栏宽度，而上游 `--left-side-bar-width` 实测为 **43px**（`constants.js:40`）且随用户拖拽变化。替换会把 36px 变成 43px → **布局位移 7px**。→ **保持原数值。** |
| `--focus-ring` | 上游已有两种焦点写法（§3.6），自造第三种会造成"焦点语言不统一"。→ **改用上游描边式，不新增变量。** |

**上游自造变量的正确用法**：**只保持上游已写好的消费点不动**（`--left-side-bar-width` 6 处、`--footer-stack-height` 5 处、`--shortcut-bar-h` / `--shortcut-bar-kb-offset` 各 9 处），**不要把它们推广到新的地方**。

### 2.3 `tokens.styl` 内容

新建 `src/client/css/includes/tokens.styl`，在 `css/includes/index.styl` **首行** `@require './tokens'`（这样它在 `box/text/font-size/theme` 之前展开）。

> 🔴 **必须注意（实测踩坑）**：`color-mix(in srgb, …)` **不能用裸写法**。
> Stylus 的 `in` 是运算符，直接写会报 `ParseError: illegal unary "in", missing left-hand operand`，**编译直接失败**。
> 必须用 `unquote('…')` 包裹（Stylus 官方推荐的"输出原始 CSS 函数"写法），产物中不会被改写。
> 实测：`unquote()` 包裹后，产物里 `color-mix(in srgb, var(--text) 14%, transparent)` 原样保留（已验证）。

```stylus
// src/client/css/includes/tokens.styl（v4「Tinted Console」定稿，66 行）
// 全部新增 token。派生变量跟随 --text/--main/--primary 自动适配任意主题（含 310 个 iTerm 主题）。
// ⚠️ 禁止在此引用 --main-darker / --main-lighter（见规范 §2.1：darker() 会产出非法颜色）
// ⚠️ 含 `in` 的 color-mix(...) 必须用 unquote() 包裹：Stylus 的 `in` 是运算符
:root
  // ---- v4 派生：品牌浸染表面色阶（4 级，色相跟随主题）----
  --surface-0 unquote('color-mix(in srgb, var(--primary) 4%, var(--main-dark))')
  --surface-1 unquote('color-mix(in srgb, var(--primary) 2%, var(--main))')
  --surface-2 var(--main-light)
  --surface-3 unquote('color-mix(in srgb, var(--text) 6%, var(--main))')

  // ---- 派生：分隔、边框、交互态 ----
  --border unquote('color-mix(in srgb, var(--text) 12%, transparent)')
  --border-strong unquote('color-mix(in srgb, var(--text) 22%, transparent)')
  --hover-bg unquote('color-mix(in srgb, var(--text) 7%, transparent)')
  --active-bg unquote('color-mix(in srgb, var(--primary) 16%, transparent)')
  --accent-wash unquote('color-mix(in srgb, var(--primary) 10%, var(--main))')

  // ---- v4 派生：光晕激活态（激活/选中/按下共用；焦点环保持描边式）----
  --accent-glow unquote('0 0 0 1px color-mix(in srgb, var(--primary) 45%, transparent), 0 2px 16px color-mix(in srgb, var(--primary) 30%, transparent)')

  // ---- v4 派生：状态色底芯片（14% 色底 + 同色彩字）----
  --success-bg unquote('color-mix(in srgb, var(--success) 14%, var(--main))')
  --error-bg unquote('color-mix(in srgb, var(--error) 14%, var(--main))')
  --warn-bg unquote('color-mix(in srgb, var(--warn) 14%, var(--main))')
  --info-bg unquote('color-mix(in srgb, var(--info) 14%, var(--main))')

  // ---- 静态：圆角（v4：整体上调一档）----
  --radius-xs 4px
  --radius-sm 8px
  --radius 10px
  --radius-lg 14px
  --radius-pill 999px

  // ---- 静态：阴影与遮罩（v4：略加深）----
  --shadow-1 0 1px 2px rgba(0, 0, 0, .32)
  --shadow-2 0 4px 14px rgba(0, 0, 0, .36)
  --shadow-3 0 18px 48px rgba(0, 0, 0, .5)
  --mask rgba(0, 0, 0, .45)

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

  // ---- 静态：动效 ----
  --dur-1 120ms
  --dur-2 180ms
  --ease cubic-bezier(.4, 0, .2, 1)

  // ---- v4 静态：等宽点缀（仅用于新增声明：路径/大小/次数/版本号）----
  --font-mono ui-monospace, 'SF Mono', Menlo, Consolas, 'Noto Sans Mono CJK SC', monospace
```

> ⚠️ **不要**在 `tokens.styl` 里重复定义 `--main-darker` / `--main-lighter`（由 `ui-theme.jsx` 运行时派生，重复定义会争抢优先级）。

### 2.4 `color-mix()` 技术前提（已验证）

| 检查项 | 结果 | 结论 |
| --- | --- | --- |
| Electron 版本 | `42.8.1`（`package.json`） | Chromium ≥ 140，`color-mix()` 需 Chrome 111+ → ✅ 支持 |
| vite `build.target` | `'esnext'`（`build/vite/conf.js:62`） | ✅ 不会被降级 |
| **Stylus 能否解析裸 `color-mix(in srgb, …)`** | ❌ **不能**：`in` 是 Stylus 运算符 → `ParseError: illegal unary "in"` | 🔴 **必须用 `unquote('…')` 包裹**（§2.3） |
| 现有 `color-mix` 使用 | **0 处** | 首次引入，无冲突 |
| CSS 压缩 | esbuild 生产默认，无 postcss/autoprefixer | ✅ esbuild **不改写** `color-mix`（Step 1 实测：4 处原样保留） |

**Step 1 实测验收值**（2026-09-24）：

| 指标 | 结果 |
| --- | --- |
| `grep -c color-mix style-5.5.26.css` | **4**（4 个派生变量各 1 处） |
| 18 个新 token 是否全部进入产物 | ✅ 全部存在，且**每个只定义 1 次**（无重复） |
| CSS 体积 | 78,359 → **79,056 字节**（+697 B，+0.9%） |
| `npm run test-unit-ci` | ✅ **450/450 通过** |
| 视觉变化 | ✅ **零**（本步只新增变量定义，无任何选择器消费它们） |

**必须验证**（Step 1 的验收条件之一）：

```bash
grep -c "color-mix" work/app/assets/css/style-5.5.26.css   # 期望 > 0
```

若某天目标环境不支持，降级方案：把 4 个派生变量改回硬编码值（深色 `rgba(221,221,221,.14)` 等）+ 接受浅色主题下边框偏灰（不影响功能）。

### 2.5 明确不要做的事 ★

| 不要做 | 原因 |
| --- | --- |
| ❌ 不要把新 token 加进 `requiredThemeProps` | §1.5 约束 A：破坏主题保存 + 310 主题脱节 |
| ❌ 不要改 `convertThemeToText` / `convertTheme` | 主题文本格式是外部契约（iTerm 主题分发） |
| ❌ 不要在 `tokens.styl` 定义 `--main-darker` / `--main-lighter` | 由 `ui-theme.jsx` 运行时派生，重复定义会争抢优先级 |
| ❌ 不要引用 `--main-darker` / `--main-lighter` | §2.1：`darker()` 产出非法颜色，引用会整条声明失效 |
| ❌ 不要改 `36px` / `340px` / `280px` / `600px` 等布局骨架的**数值** | 违反安全边界，会打破 e2e 的可见性断言 |
| ❌ 不要自造 `--h-bar` / `--w-sidebar` / `--focus-ring` | v3 已撤销（§2.2 C） |
| ❌ 不要把 `--footer-stack-height` / `--left-side-bar-width` 用到上游之外的地方 | 二者是动态值，会引入布局位移 |
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
grep -c "color-mix" work/app/assets/css/style-5.5.26.css
```

### 2.8 v4 深度设计层「Tinted Console」★（2026-09-24 用户定案）

v3 解决「散值收敛」，观感含蓄；v4 在**同一安全边界内**增加品牌个性层。四要素：

| 要素 | token / 手法 | 应用位置 |
| --- | --- | --- |
| **品牌浸染色阶** | `--surface-0/1/3` 改为 `color-mix(primary 2-6%, 底色)`（色相跟随主题） | 标签栏/图标栏(s0)、内容区/弹窗/列表容器(s1)、更高浮起/输入底(s3)；`--accent-wash`(10%) 用于表头洗染 |
| **光晕激活态** | `--accent-glow`（1px 主色环 + 16px 柔光）+ 渐变强调线（`background-image: linear-gradient(90deg, var(--primary), transparent)`） | 激活标签顶部、快捷键条按下态、首页 Logo/背景光晕、主按钮 hover 投影；**焦点环保持描边式**（§3.6，光晕静音版 = outline + act 底） |
| **状态色底芯片** | `--success-bg / --error-bg / --warn-bg / --info-bg`（14% 色底）+ 同色彩字 + 左 3px 色条（inset） | 消息/通知、传输队列状态、监控详情、批量操作结果 |
| **等宽点缀** | `--font-mono`（**仅用于新增声明**） | 文件大小、命令次数、版本号、路径 |

**配套值调整（v4 定案，覆盖 v3 同名值）**：`--border` 12%、`--hover-bg` 7%、`--active-bg` 16%、
圆角 xs4 / sm8 / 10 / lg14（**整体上调一档**，§3.3 映射表目标值同步）、阴影三档加深（.32/.36/.5）。
**新增允许属性**：`transform: translateY(-1px)`（主按钮/快捷键条 hover 上浮；合成器处理，**零布局位移**）。

**安全性声明**：全部 color-mix 从既有 12 个主题 key 派生 → 约束 A 零触碰、310 个 iTerm 主题自动适配；
零类名改动、零 DOM 变更；视觉前后对照见 `美化效果预览草图-v4深度版.html`（含浅色主题切换）。

---

## 三、Layer 2 · 统一层

### 3.1 合并 3 份默认主题副本

原现状：`theme.styl:1-16`、`common/ui-theme.js:5-18`（`defaultUiThemeStylus`）、`common/theme-defaults.js:18-33` 各存一份，且 `main` 值不一致。

处理（**Step 2 已执行，含一处基于实测的方案调整**）：

1. 以 `theme-defaults.js` 为**唯一来源**。
2. ~~`common/ui-theme.js` 的 `defaultUiThemeStylus` 改为由 `theme-defaults.js` 生成~~ → **实测发现该文件是死代码，用户决策：本步不动、仅记录**（见下方证据）。
3. ✅ `theme.styl` 的 `:root` 只保留「配置加载前的兜底值」，`--main` 已从 `#141314` 改为与 `theme-defaults.js` 一致的 `#121214`。
4. 浅色主题的 12 个 key **保持不动**（约束 A 禁止扩展）。

> 🔎 **死代码实锤（2026-09-24 实测，四重证据）**：`common/ui-theme.js`（导出 `getUiThemeConfig` / `convertTheme`）
> ① `src/**` 全库 grep：**零 import**（theme-form/theme-ai-editor/store 用的 `convertTheme` 全部来自 `common/terminal-theme.js`）；
> ② `src/test/**` 零引用；③ `build/vite/conf.js` alias 无映射；④ **打包产物** `work/app/assets/js/electerm-5.5.26.js` 中无 `defaultUiThemeStylus` 字符串（bundler 按引用打包，未进入产物 = 编译期也确认无引用）。
> 该文件是 `11fc3c25`（"new UI theme control method that use css vars"）重构后被 `terminal-theme.js` 取代的历史遗留，**上游同样未引用**。
> **影响**：其中 `--main #141314` 的不一致是**纯纸面问题**（不参与运行时），因此"值不一致"随第 3 条落地已无实际影响。
> **后续建议**（独立小 commit，不混入美化）：直接删除该文件；或提 issue 请上游删除。风险提示：若上游将来修改此文件，merge 会出现 modify/delete 冲突（易识别易解决）。

### 3.2 补齐死变量 / 清理 antd 残留名

| 位置（5.5.26 实测） | 现状 | 改为 |
| --- | --- | --- |
| `sidebar/sidebar.styl:57` | `border-bottom 1px solid var(--border)` | 变量在 §2 补齐后自动生效（**修复一处隐形缺陷**） |
| `ai/ai.styl:157` | `color var(--text-color-2)` | `color var(--text-dark)` |
| `ai/ai.styl:236` | `color var(--text-color-2)` | `color var(--text-dark)` |
| `footer/cmd-history.styl:65` | `color var(--text-color-secondary)` | `color var(--text-dark)` |
| `tree-list/tree-list.styl:136` | `background var(--hover-bg, rgba(0,0,0,.04))` | token 定义后 fallback 不再生效；**本步只需目视确认**（浅色主题下 8% 灰仍可见） |

（`--border` 与 `--hover-bg` 已在 Step 1 定义，其余引用处无需改动。）

### 3.3 收敛圆角与阴影（影响面最大）

**圆角只允许 5 个值**（v4：整体上调一档）：`--radius-xs`(4) / `--radius-sm`(8) / `--radius`(10) / `--radius-lg`(14) / `--radius-pill`(999)。

**收敛映射表**（按 5.5.26 实测的 12 种写法）：

| 现状值 | 出现处（实测行号） | 目标 |
| --- | --- | --- |
| `2px` | `tree-list.styl:80`、`ai.styl:179`、`transfer-tag.styl:2` | `--radius-xs` |
| `3px` | `tabs.styl:45`、`sftp.styl:38`、`tree-list.styl:15,131`、`ai.styl:26,250` | `--radius-xs` |
| `4px` | `modal.styl:62,89`、`message.styl:13`、`notification.styl:10`、`add-btn.styl:7`、`tabs.styl:253,267,293`、`tree-list.styl:114`、`footer.styl:64`、`ai.styl:128,196`、`code-compare.styl:8`、`setting.styl:23`、`responsive-tabs.styl:18`、`setting-wrap.styl:156` | `--radius-sm` |
| `5px` | `color-picker.styl:7`、`upgrade.styl:7` | `--radius-sm` |
| `6px` | `shortcut-bar.styl:62,123,138,175` | `--radius-sm` |
| `8px` | `modal.styl:30` | `--radius` |
| `10px` | `tabs.styl:237`（`10px 2px 2px 10px`） | `--radius-pill` |
| `14px` | `ai.styl:327` | `--radius-lg` |
| `15px` | `tabs.styl:61` | `--radius-pill` |
| `20px` | `transfer.styl:44` | `--radius-pill` |
| `28px` | `logo.styl:5` | `--radius-pill`（已是 pill 语义） |
| `30px` | `sys-menu.styl:70` | `--radius-pill` |
| `100%` | `tabs.styl:132` | **保留**（几何正圆，不是设计圆角） |

**阴影只允许 3 个值 + `--mask`**：`--shadow-1` / `--shadow-2` / `--shadow-3`。

| 现状写法（实测） | 位置 | 目标 |
| --- | --- | --- |
| `0px 0px 1px 1px var(--main-darker)` | `session.styl:56` | `--shadow-1` |
| `0 0 8px 2px var(--primary)` / `0 0 0 0 var(--primary)` | `bookmark-form.styl:56,59` | **保留**（状态光晕，非阴影） |
| `0px 0px 3px 3px var(--main-lighter)` | `sftp.styl:42`、`terminal.styl:154` | `--shadow-2` |
| `0px 0px 3px 3px var(--main-darker)` | `sys-menu.styl:45` | `--shadow-2` |
| `0px 3px 3px 0px var(--main-lighter)` | `terminal.styl:124` | `--shadow-2` |
| `0px -3px 3px 0px var(--main)` | `terminal.styl:143` | `--shadow-2` |
| `inset 0 0 5px var(--main-darker)` | `remote-session-shell.styl:56`、`vnc.styl:21` | `--shadow-1` + 背景 `--surface-0` |
| `0 6px 16px 0 rgba(0,0,0,.08), 0 3px 6px -4px rgba(0,0,0,.12), 0 9px 28px 8px rgba(0,0,0,.05)` | `modal.styl:31`（antd 抄来的） | `--shadow-3` |
| `0 4px 12px rgba(0,0,0,.15)` | `notification.styl:13`、`message.styl:16` | `--shadow-2` |
| `2px 0 8px rgba(0,0,0,.15)` | `drawer.styl:21` | `--shadow-2` |
| `0 2px 8px rgba(0,0,0,.15)` | `tabs.styl:254` | `--shadow-2` |
| `0 2px 8px rgba(0,0,0,.1)` | `tree-list.styl:117` | `--shadow-2` |
| `0 -2px 8px rgba(0,0,0,.2)` | `footer.styl:63`、`mobile.styl:124` | `--shadow-2` |
| `0 4px 12px rgba(0,0,0,.3), 0 0 0 1px var(--main-darker)` | `add-btn.styl:8` | `--shadow-2` |
| `inset 0 2px 0 0 var(--primary)` 系（×4） | `basic.styl:50,52,55,57`（`.dnd-*` 拖拽指示） | **保留**（功能指示条） |
| `inset 0 0 0 1px var(--primary)` | `remote-monitor-bar.styl:46,93`（焦点态） | **保留**（§3.6 焦点语言） |
| `0 4px 22px 0 rgba(0,0,0,.18)` 等新值 | 见 §4.16/§4.17 逐条 | 按表收敛 |

> ⚠️ 收敛**只改写法不改视觉层级**：`--shadow-1/2/3` 的强度是"同一档"的近似值，`Step 5` 必须逐页对照目视。

### 3.4 修复 antd 桥接

`src/client/store/store.js` **L266-283** 改为：

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

关键变化：`borderRadius` 3 → 8（L271）；**删除 `motion: false`**（L280，恢复 antd 动效）；新增 `fontSize: 13` 与 body 对齐；补 `colorBorder` / `colorBgContainer` / `colorBgElevated` / `controlHeight`。

> `themeConf['main-light']` 在 iTerm 主题下已定义（约束 B 已实测），安全。
> 若发现个别页面卡顿，不要重新全局关闭，改为 `motion: { motionDurationFast: '0.12s', motionDurationMid: '0.18s' }`。

### 3.5 动效基线

对全部可交互元素统一补：

```stylus
transition background var(--dur-1) var(--ease), color var(--dur-1) var(--ease), border-color var(--dur-1) var(--ease)
```

优先覆盖（`:hover` 出现频率最高的元素）：`.tab` / `.tab-close` / `.window-control-box` / `.control-icon` / `.sftp-item` / `.item-list-unit` / `.layout-menu-item` / `.workspace-item` / `.custom-modal-close` / `.sys-menu` 菜单项 / `.shortcut-bar-btn` / antd 按钮与下拉项。

`sidebar.styl:2-3`、`right-side-panel.styl:46-47` 的 `.animate-fast { animation-duration .2s }` → `var(--dur-2)`。

> 现状：67 个 `.styl` 中仅 **8 个文件**已有 `transition`（`tabs.styl`、`sidebar.styl`、`right-side-panel.styl`、`modal.styl`、`info.styl`、`rdp.styl`、`spice.styl`、`vnc.styl` 等）。

### 3.6 焦点可见性基线 ★（v3 改为对齐上游）

现状（实测）：

- `:focus-visible` **仅 2 个文件**：`common/item-filter.styl`(3 处)、`remote-monitor/remote-monitor-bar.styl`(4 处)。
- 全库**唯一**真正抑制焦点轮廓的是 `common/modal.styl:68-69`（`&:focus { outline none }`，关闭按钮）。
- ⚠️ **v2 的误读已更正**：下列 `outline` **都不是焦点相关**，不要按"焦点被移除"处理：

  | 位置 | 真实语义 |
  | --- | --- |
  | `tree-list.styl:25` | `.tree-item.search-selected` 的**搜索命中高亮**（`outline 1px dashed`） |
  | `basic.styl:26` | `::-webkit-scrollbar-thumb { outline none }`（滚动条） |
  | `modal.styl:8` | `.custom-modal-wrap { outline 0 }`（容器） |
  | `rdp.styl:15` | `.rdp-canvas { outline none }`（画布） |
  | `terminal.styl:106` | `.terminal-select-text-area`（textarea 自身轮廓） |
  | `ai.styl:109` | `.ai-attachment-dragover` 的**拖放命中指示** |

**上游已有的两种焦点写法**（实测）：

| 写法 | 出处 | 形式 |
| --- | --- | --- |
| **描边式**（列表/容器类） | `item-filter.styl:16-18`、`:38-40` | `outline 1px solid var(--primary)` + `outline-offset 1px`（另一处 `-1px`） |
| 内阴影式（行内小控件） | `remote-monitor-bar.styl:43-46`、`:83-93` | `box-shadow inset 0 0 0 1px var(--primary)` |

**本方案采用「描边式」作为全局基线**（与通用列表组件一致，且不动用 `box-shadow`，避免与其他阴影冲突）：

```stylus
// css/basic.styl 末尾追加
:focus-visible
  outline 1px solid var(--primary)
  outline-offset 1px
```

仅用 `:focus-visible`（而非 `:focus`），保证**鼠标点击不出现焦点环**，不干扰现有视觉。

**已知副作用与处置**：

1. 全局规则也会命中 antd 的原生控件（`input`/`textarea`/`button`）→ 可能与 antd 自带焦点态叠加。
   **处置**：先按全局规则实施，若目视发现"双重焦点环"，改为在 `basic.styl` 中排除 antd：`:focus-visible:not(.ant-input):not(.ant-btn):not(.ant-select-selector)`（**不给 antd 组件改样式**）。
2. `outline-offset 1px` 在紧贴容器边缘的元素上可能溢出 1px → 属视觉细节，不改变布局（outline 不参与布局计算），可接受。

**不要**回退 `modal.styl:68-69` 的 `outline none`（关闭按钮已有 hover 反馈，且它是 antd 风格保留项）。

### 3.7 `prefers-reduced-motion` 全局兜底 ★

全库仅 3 处（`bookmark-form.styl:62`、`monitor-details.styl:85`、`remote-monitor-bar.styl:104`），而 §3.5 会新增大量 `transition`。追加：

```stylus
@media (prefers-reduced-motion: reduce)
  *
    animation-duration .01ms !important
    animation-iteration-count 1 !important
    transition-duration .01ms !important
```

> 这是**唯一允许使用 `!important` 的新增场景**（无障碍覆盖优先级需要）。

### 3.8 字体回退（CJK）★

`basic.styl:9` 字体栈无中文/日文字体，中日文 locale 下会串字体（数字/英文用一种、汉字回落到系统默认）。追加 CJK 字体（**插在 `'Noto Sans'` 之后、`sans-serif` 之前**）：

```stylus
font-family -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Noto Sans CJK SC', 'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'
```

### 3.9 `darker()` 非法颜色缺陷的最小修复 ★（v3 新增）

**问题**：`src/client/components/main/ui-theme.jsx` L11-29 的 `darker()` 只钳制下界、不钳制上界，也不补零：

```js
let r = (num >> 16) - Math.round(255 * amount)
if (r < 0) r = 0            // ← 只有下界
…
return (usePound ? '#' : '') + (g | (b << 8) | (r << 16)).toString(16)
//                                ↑ 小值不补零 → '#0'；大值溢出 → '#1393939'
```

**修复**（3 处改动，保持函数签名与调用点不变）：

```js
function darker (color, amount = 0.1) {
  let usePound = false
  if (color[0] === '#') { color = color.slice(1); usePound = true }
  const num = parseInt(color, 16)
  const clamp = (v) => Math.min(255, Math.max(0, v))       // ← 新增：上下界钳制
  const r = clamp((num >> 16) - Math.round(255 * amount))
  const b = clamp(((num >> 8) & 0x00FF) - Math.round(255 * amount))
  const g = clamp((num & 0x0000FF) - Math.round(255 * amount))
  const hex = (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0')   // ← 新增：补零
  return (usePound ? '#' : '') + hex
}
```

**视觉影响评估**（默认深色主题 `main=#121214`）：

| 变量 | 修复前 | 修复后 | 观感变化 |
| --- | --- | --- | --- |
| `--main-darker` | `#0`（非法 → 29 处声明整条失效） | `#000000` | 深色下"黑色边框/阴影"出现，但在 `#121214` 上**对比度极低（≈1.05:1）**，几乎看不出 |
| `--main-lighter` | `#5e5e60`（本来就合法） | `#5e5e60` | **无变化** |

**执行位置建议**：**放在 Step 4**（区域精修之前）。理由：不修的话，区域精修时的"改动前基线"是失真的（29 处边框/阴影根本没渲染），会误判观感。
**风险**：🟢 低（默认主题下视觉变化接近不可见）；**必须独立提交**，便于单独回退。

**验证**：

```bash
node -e "
const f=(c,a=0.1)=>{let p=false;if(c[0]==='#'){c=c.slice(1);p=true}const n=parseInt(c,16);
const cl=v=>Math.min(255,Math.max(0,v));
const r=cl((n>>16)-Math.round(255*a)),b=cl(((n>>8)&255)-Math.round(255*a)),g=cl((n&255)-Math.round(255*a));
return (p?'#':'')+(g|(b<<8)|(r<<16)).toString(16).padStart(6,'0')};
console.log(f('#121214',0.3), f('#ededed',-0.3), f('#121214',-0.3))"
# 期望：#000000 #ffffff #5e5e60 —— 全部为合法 6 位色
```

---

## 四、Layer 3 · 页面精修（17 个区域）

统一视觉约定：

- 区域之间靠**色阶**分隔（`--surface-0/1/2`），不靠粗边框。
- 选中态一律：**主色描边**，或**左侧 2px 主色色条**。
- 悬浮态一律：`--hover-bg`，**禁止整行主色实心**（当前多处 `--primary` + `--primary-contrast` 对比度仅 3.89:1，见 §5.4）。
- 圆角只用 `--radius`(8) 和 `--radius-lg`(12) 两档（小控件可 `--radius-sm`/`--radius-xs`）。
- **所有布局数值（`36px`/`340px`/`padding` 等）保持原值不动**。

### 4.1 ① 标签栏 / 标题栏

文件：`components/tabs/tabs.styl`（**321 行**）、`add-btn.styl`（35）、`no-session.styl`（51）

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L2-8 `.tabs` | `background var(--main-dark)`(L6)；`border-bottom 1px solid var(--main-light)`(L7) | `background var(--surface-0)`；`border-bottom 1px solid var(--border)` |
| L35-49 `.tab` | `border-radius 3px 3px 0 0`(L45)；`background var(--main-dark)`(L46)；已有 `transition`(L49) | `border-radius var(--radius) var(--radius) 0 0`；`background var(--surface-0)` |
| L54-57 `&.active` | `color var(--text)`(L55)；`background var(--main)`(L56)；`box-shadow inset 0 2px 0 0 var(--primary)`(L57) | **保留主色高亮条**；底色改 `var(--surface-1)` |
| L58-62 `&.active-all .tab-count` | `border-radius 15px`(L61) | `var(--radius-pill)` |
| L63-65 `&:hover` | 仅显示 `.tab-close`，无底色反馈 | 补 `background var(--hover-bg)` |
| L82-88 `@keyframes blink` | 硬编码 `#e0e0e0`(L84,L88) / `#ffffff`(L86) | 改「主色 ↔ 透明」呼吸（消除 3 处硬编码） |
| L121 | `background-color transparent !important` | 用选择器层级替代（本文件唯一 `!important`） |
| L125-142 `.tab-close` | `background var(--main)`(L130)；`&:hover{background var(--error)}(L141)`；`color #fff`(L142) | `background var(--hover-bg)`；`color var(--primary-contrast)` |
| L145-147 `.is-touch-device` | **上游新增**（触屏常显关闭按钮） | **保持不动** |
| L227 | `color #fff`（窗口关闭钮 hover） | `var(--primary-contrast)` |
| L236-237 `.tab-count` | `border-radius 10px 2px 2px 10px` | `border-radius var(--radius-pill)` |
| L242-244 `.tab-pin` | **上游新增** | 纳入动效/圆角基线 |
| L251-256 `.layout-workspace-dropdown` | `border-radius 4px`(L253)；`box-shadow 0 2px 8px rgba(0,0,0,.15)`(L254) | `var(--radius-sm)`；`var(--shadow-2)` |
| L264-276 `.layout-menu-item` | `border-radius 4px`(L267)；hover `background var(--main-dark)`(L273)；`.active{background var(--primary);color #fff}`(L275-276) | `var(--radius-sm)`；`var(--hover-bg)`；`var(--active-bg)` + `var(--text)` |
| L290-306 `.workspace-item` | `border-radius 4px`(L293)；hover `var(--main-dark)`(L299) | 同上 |
| L314-321 | `-webkit-app-region no-drag` 组 | **不动** |
| `add-btn.styl` L2-13 `.add-menu-wrap` | `border 1px solid var(--main-lighter)`(L6)；`border-radius 6px`(L7)；`box-shadow 0 4px 12px rgba(0,0,0,.3), 0 0 0 1px var(--main-darker)`(L8) | `var(--border)`；`var(--radius-sm)`；`var(--shadow-2)` |
| `no-session.styl` L1-15 `.no-sessions` | — | 纳入 §3.5 动效基线 |

> ⚠️ **取向差异说明（须写进 commit message）**：上游 5.5.26 **主动删除**了 tab 的 `transition` 与 `active` 高亮。
> 本方案**有意恢复并强化**这两项（属"取向差异"，不是回归）。理由：标签栏是最高频交互，缺少过渡与激活态会明显降低可读性。

### 4.2 ② 侧边图标栏 + 书签/历史面板

文件：`components/sidebar/sidebar.styl`（**161 行**）、`transfer.styl`、`info.styl`、`transfer-history.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L2-3 `.animate-fast` | `animation-duration .2s` | `var(--dur-2)` |
| L4-15 `.sidebar-panel` | `background var(--main)`(L12)；`display none !important`(L15) | `background var(--surface-1)`；用选择器层级替代 |
| L16-17 | `top 36px` | **保持数值不动** |
| L18-27 `.sidebar` | `width 36px`(L22)；`background var(--main-dark)`(L25)；flex column(L26-27) | `background var(--surface-0)`；**宽度保持 36px（⚠️ 不要替换为 `--left-side-bar-width`，见 §2.2 C）** |
| L53-73 `.history-header` | `border-bottom 1px solid var(--border)`(L57)（**当前静默失效**） | §3.2 补齐后自动生效（本区域验收点） |
| L91-101 `.control-icon-wrap` | `padding 14px 0`(L92)；`&.active .control-icon{color var(--text-light)}`(L94-96) | 补 `border-radius var(--radius-sm)`；`&.active{background var(--active-bg)}` |
| L102-108 `.sidebar-list` | `left var(--left-side-bar-width,43px)`(L104) | **上游已用变量，保持不动** |
| L112-122 `.sidebar-bar` | **上游新增**（图标栏滚动容器） | 保持结构；纳入统一层 |
| L125-127 `.sidebar.collapsed` | **上游新增**（移动端隐藏图标栏） | **不动** |
| L141-151 `.btns` | `background var(--main-dark)`(L142) | `var(--surface-0)` |
| L159-160 `.logo-filter` | `filter invert(80%)` | **保留**（几何滤镜，非颜色 token） |
| `info.styl` L4 | `linear-gradient(45deg, #08c 0%, #09c 100%)` | `var(--primary)` 单色 |
| L64-101 各 `:hover` | 仅换色 | 补 §3.6 焦点环（全局规则已覆盖，**无需逐处添加**） |

### 4.3 ③ 终端会话区

文件：`components/session/session.styl`（**85 行**）、`session-control.styl`、`terminal/terminal.styl`（**244 行**）、`term-search.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| `session.styl` L6-13 `.type-tab-line` | `background var(--text-dark)`(L12) | `background var(--primary)` |
| `session.styl` L18-31 `.type-tab` | 无过渡（`:hover` L26-28、`&.active` L29-31） | §3.5 动效基线 |
| `session.styl` L33-38 `.is-transporting` | `animation: rotate 60s infinite linear`(L38) + 线性渐变 | **保留**（见 §5.5 无限动画清单） |
| `session.styl` L50-58 `.session-wrap` | `padding-top 36px`(L55)；`box-shadow 0px 0px 1px 1px var(--main-darker)`(L56) | padding **保持数值**；`var(--shadow-1)` |
| ~~`session.styl` L74-89 `.vnc-scroll-wrapper`~~ | **该块已从本文件删除** | ➜ 迁到 `vnc/vnc.styl:17-26`（见 §4.13） |
| `session.styl` L75-76 | `.not-split-view > .ant-splitter-bar .ant-splitter-bar-dragger{display none}` | **不动** |
| `session.styl` L62-71 `.web-session-wrap/-content` | **上游新增** | 纳入 |
| `terminal.styl` L27 / L30 | `border-top/left 1px solid var(--main-lighter)` | `var(--border)` |
| `terminal.styl` L36, L44, L54 | `background-color transparent !important`（×3） | 用选择器层级替代 |
| `terminal.styl` L106 | `outline none`（textarea） | **保留**（非焦点语义） |
| `terminal.styl` L110-111 | `font-family monospace` / `font-size 13px` | 保留结构，字号换 `var(--fs)` |
| `terminal.styl` L124 | `box-shadow 0px 3px 3px 0px var(--main-lighter)` | `var(--shadow-2)` |
| `terminal.styl` L143 | `box-shadow 0px -3px 3px 0px var(--main)` | `var(--shadow-2)` |
| `terminal.styl` L154 | `box-shadow 0px 0px 3px 3px var(--main-lighter)` | `var(--shadow-2)` |
| `terminal.styl` L158 | `border-radius 4px`（`.terminal-suggestions-wrap`） | `var(--radius)` |
| `terminal.styl` L160, L169 | `border-* 1px solid var(--main-lighter)` | `var(--border)` |
| `terminal.styl` L92, L144 | `background var(--main-lighter)` | `var(--surface-2)` |
| `terminal.styl` L184 | `&:hover{background-color var(--main-lighter)}` | `var(--hover-bg)` |
| `terminal.styl` L204 | `color var(--text-light, #888)` | 去掉可疑 fallback → `var(--text-light)` |
| `terminal.styl` L230 | `color rgba(255,255,255,0.55)` ← **浅色主题下不可见** | `var(--text-dark)` |
| `terminal.styl` L69-115 `.terminal-select-text*` | **上游新增**（触屏全屏选区） | 纳入 |
| `term-search.styl` L8-10 | `background #333` / `color #aaa` | `var(--surface-2)` / `var(--text-dark)` |

### 4.4 ④ SFTP 文件管理

文件：`components/sftp/sftp.styl`（201）、`address-bookmark.styl`、`code-compare.styl`、`file-compare-modal.styl`、`transfer-tag.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L16-18 | `&:nth-child(even) .sftp-file-prop{background var(--main)}`(L18) | `background var(--surface-2)` |
| L19-22 `&:hover` | `background-color var(--primary)`(L21) + `color var(--primary-contrast)`(L22)（**实测 3.89:1，不达标**） | `background-color var(--hover-bg)` + `box-shadow inset 2px 0 0 0 var(--primary)` |
| L23-26 `&.selected` | 同上（L25-26） | `background-color var(--active-bg)` + 左侧色条，文字 `var(--text)` |
| L33-34 | `box-shadow none` / `border none` | **保留** |
| L38 | `border-radius 3px` | `var(--radius)` |
| L41-42 `&.focused` | `border 1px solid var(--main-darker)`(L41)；`box-shadow 0px 0px 3px 3px var(--main-lighter)`(L42) | `var(--border-strong)`；`var(--shadow-2)` |
| L45-50 | `&:hover{background var(--primary);color var(--primary-contrast)}`(L49-50) | `var(--hover-bg)` + `var(--text)` |
| L47 | `border-bottom 1px solid var(--main-darker)` | `var(--border)` |
| L98-99, L118-119 | `background var(--main)` | `var(--surface-1)` |
| L128-134 | `background var(--primary) !important`(L134) | 用选择器层级替代 |
| L144 | `background var(--main-lighter)` | `var(--hover-bg)` |
| L178 | `border-top 1px solid var(--main-darker)` | `var(--border)` |
| `code-compare.styl` L7-8 | `border 1px solid var(--main-darker)`；`border-radius 4px` | `var(--border)`；`var(--radius-sm)` |
| `file-compare-modal.styl` L6 | `border 1px solid var(--main-darker)` | `var(--border)` |
| `transfer-tag.styl` L2 | `border-radius 2px` | `var(--radius-xs)` |

### 4.5 ⑤ 底部栏

文件：`components/footer/footer.styl`（**71 行**）、`cmd-history.styl`（**119 行**）

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| `footer.styl` L1-8 `.main-footer` | `background var(--main)`(L2)；`height 36px`(L3)；`left calc(var(--left-side-bar-width,43px) + 1px)`(L5)；**无上边框** | 补 `box-shadow inset 0 1px 0 0 var(--border)`（**⚠️ 不要用 `border-top`**，见下方说明）；`background var(--surface-1)` |
| `footer.styl` L12 | `.pinned .main-footer{left 343px}` | **保持数值** |
| `footer.styl` L46-65 `.bi-full` | `box-shadow 0 -2px 8px rgba(0,0,0,.2)`(L63)；`border-radius 4px 4px 0 0`(L64) | `var(--shadow-2)`；`var(--radius) var(--radius) 0 0` |
| `cmd-history.styl` L32 | `color red`（命名色） | `var(--error)` |
| `cmd-history.styl` L46-47 | `&:hover{background var(--main-lighter)}` | `var(--hover-bg)` |
| `cmd-history.styl` L51-54 | `&.menu-open{background var(--main-lighter)}` | `var(--active-bg)` |
| `cmd-history.styl` L65 | `color var(--text-color-secondary)`（未定义） | `var(--text-dark)` |
| `cmd-history.styl` L84-85 | `color blue`（命名色） | `var(--primary)` |
| `cmd-history.styl` L91-92 | `border-radius 4px`；`background var(--main-lighter)` | `var(--radius-sm)`；`var(--surface-2)` |
| `cmd-history.styl` L107 | `left 0px !important` | **保留**（窄屏定位必需，见 §5.3） |

> 🔴 **为什么不用 `border-top`**：`.main-footer` 是 `content-box`（全库未设 `box-sizing: border-box`），
> 且 `position:absolute; bottom:0; height:36px`。加 `border-top:1px` 会让**盒子总高变 37px 并整体上移 1px** → **违反"不改布局"红线**。
> 用 `box-shadow inset` 画出 1px 内描边，参与合成、**不参与布局**，视觉等价且零位移。

### 4.6 ⑥ 右侧面板（AI 对话 / 终端信息）

文件：`components/side-panel-r/right-side-panel.styl`（46）、`ai/ai.styl`（**336 行**）、`terminal-info/terminal-info.styl`（**14 行**）

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| `right-side-panel.styl` L4 | `top 36px` | **保持数值** |
| `right-side-panel.styl` L11 | `bottom 36px` | **保持数值** |
| `right-side-panel.styl` L15 | `border-left 1px solid var(--main-darker)` | `var(--border)` |
| `right-side-panel.styl` L28 | `border-bottom 1px solid var(--main-darker)` | `var(--border)` |
| `right-side-panel.styl` L19-21 | `&.right-side-panel-pinned{top 0;bottom 0}`（**上游新增**） | 保持 |
| `right-side-panel.styl` L43 | `top 55px` | **保持数值** |
| `right-side-panel.styl` L46-47 | `.animate-fast{animation-duration .2s}` | `var(--dur-2)` |
| `ai.styl` L26 / L128 / L179 / L196 / L250 | `border-radius 3px/4px/2px/4px/3px` | `--radius-xs`/`--radius-sm` 按 §3.3 表 |
| `ai.styl` L109-110 | `outline 2px dashed #1890ff`（拖放指示） | `outline 2px dashed var(--primary)` |
| `ai.styl` L132, L137 | `border-color #1890ff` | `var(--primary)` |
| `ai.styl` L157, L236 | `var(--text-color-2)`（未定义） | `var(--text-dark)` |
| `ai.styl` L213 | `color #1890ff` | `var(--primary)` |
| `ai.styl` L217 | `color #52c41a` | `var(--success)` |
| `ai.styl` L220 | `color #ff4d4f` | `var(--error)` |
| `ai.styl` L24, L127, L195, L224, L326 | `border * 1px * var(--main-darker)`（×5） | `var(--border)` |
| `ai.styl` L259, L262, L265 | `border-color #1890ff / #52c41a / #ff4d4f` | `var(--primary)` / `var(--success)` / `var(--error)` |
| `ai.styl` L214 | `animation spin 1s linear infinite` | **保留**（§5.5 清单） |
| `ai.styl` L297-298 | `mask-image var(--ai-watermark)` | **保留**（由 jsx 内联注入，非硬编码色） |
| `ai.styl` L327 | `border-radius 14px` | `var(--radius-lg)` |
| AI 气泡 | 圆角散值 | 统一 `var(--radius-lg)`，底色 `var(--surface-2)` |
| `terminal-info.styl`（**仅 14 行**） | L2 `color var(--text-dark)`；L7 `color var(--success)`；L10 `padding 10px 0` | 原行号全部失效；仅需补 §3.5 动效与焦点环 |

### 4.7 ⑦ 设置中心

文件：`components/setting-panel/{setting-wrap(168),list(71),setting(49)}.styl`、`components/theme/{theme-form(8),terminal-theme-list(6)}.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| `setting-wrap.styl` L26 | `padding 20px 0 20px 20px` | **保持数值不动**（§5.1 修正：`--sp-*` 与 20px 不等价） |
| `setting-wrap.styl` L40 | `padding 20px` | **保持数值不动** |
| `setting-wrap.styl` L66 | `padding 55px 20px 0 50px` | **保持数值不动** |
| `setting-wrap.styl` L70 | `@media (max-width: 800px)` | **断点已是 800px（上游已改），不要动** |
| `setting-wrap.styl` L75 | `left var(--left-side-bar-width, 43px)` | **保持不动** |
| `setting-wrap.styl` L137-169 `.setting-mobile-back*` | **上游新增**；L156 `border-radius 4px`；L158-160 `&:hover{background var(--primary);color var(--primary-contrast)}`（**3.89:1**） | `var(--radius-sm)`；hover 改 `var(--active-bg)` + `var(--text)` |
| `setting-wrap.styl` L144 | `border-bottom 1px solid var(--main-light)` | `var(--border)` |
| `list.styl` L31-32 | 选中态 `background var(--primary)` + `color var(--primary-contrast)`（**3.89:1，AA 不达标**） | `var(--active-bg)` + `var(--text)`，补 `var(--radius-sm)` |
| `list.styl` L35-37 | hover 同主色实心 | `var(--hover-bg)` + `var(--text)` |
| `list.styl` L45 | `.theme-item:hover` | 纳入统一层 |
| `setting.styl` L22-23 | `border 1px solid var(--main-light)`；`border-radius 6px` | `var(--border)`；`var(--radius-sm)` |
| 分节标题 | 字号不统一 | `var(--fs-xs)` + `letter-spacing .02em` + `--text-dark` |
| `theme-form.styl`（**8 行**） | **已被上游清空为纯注释**，原 4 处 `!important` 不存在 | **本文件无规则可改** |
| `terminal-theme-list.styl`（6 行） | — | 纳入统一层 |

> ⚠️ 本区域**不要触碰主题编辑表单的校验逻辑**（§1.5 约束 A）。

### 4.8 ⑧ 表单弹窗（书签 / 树列表）

文件：`components/bookmark-form/bookmark-form.styl`（64）、`common/color-picker.styl`（21）、`components/tree-list/tree-list.styl`（**202 行**）

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| `bookmark-form.styl` L6 | `width 80px !important` | 用选择器层级替代（本文件唯一 `!important`） |
| `bookmark-form.styl` L56, L59 | `box-shadow 0 0 0 0 / 0 0 8px 2px var(--primary)` | **保留**（状态光晕，非投影） |
| `color-picker.styl` L6 | `border 1px solid #ccc` | `var(--border)` |
| `color-picker.styl` L7 | `border-radius 5px` | `var(--radius-sm)` |
| `color-picker.styl` L9 | `background #fff` | `var(--surface-2)` |
| `tree-list.styl` L15 / L131 | `border-radius 3px` | `var(--radius-xs)` |
| `tree-list.styl` L24-25 | `&.search-selected{outline 1px dashed var(--primary)}` | **保留**（⚠️ 这是搜索命中高亮，**不是焦点环**，见 §3.6） |
| `tree-list.styl` L29-30 | `background #000` / `color #eee` | `var(--surface-0)` / `var(--text)` |
| `tree-list.styl` L80 | `border-radius 2px` | `var(--radius-xs)` |
| `tree-list.styl` L81 | `border 1px solid #1a1a1a` | `var(--border)` |
| `tree-list.styl` L114 / L117 | `border-radius 4px`；`box-shadow 0 2px 8px rgba(0,0,0,.1)` | `var(--radius-sm)`；`var(--shadow-2)` |
| `tree-list.styl` L136 | `background var(--hover-bg, rgba(0,0,0,.04))` | token 生效后 fallback 失效；目视确认浅色主题可读性 |
| `tree-list.styl` L190-202 `.is-touch-device` | **上游新增** | **不动** |

### 4.9 ⑨ 通用层（Modal / Drawer / Message / Notification）

文件：`components/common/{modal(100),drawer(34),message(56),notification(66)}.styl`

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| `modal.styl` L16 | `background rgba(0, 0, 0, 0.45)` | `var(--mask)`（值相同 → 零变化） |
| `modal.styl` L30 | `border-radius 8px` | `var(--radius-lg)` |
| `modal.styl` L31 | 长串 antd 阴影 | `var(--shadow-3)` |
| `modal.styl` L40 / L77 | `border-bottom` / `border-top 1px solid var(--main-darker)` | `var(--border)` |
| `modal.styl` L62 / L89 | `border-radius 4px` | `var(--radius-sm)` |
| `modal.styl` L67 | `:hover{background var(--main-darker)}` | `var(--hover-bg)` |
| `modal.styl` L8 | `outline 0`（容器） | **保留**（非焦点语义） |
| `modal.styl` L68-69 | `&:focus{outline none}` | **保留**，交由 §3.6 全局焦点环接管 |
| `drawer.styl` L14 | `background rgba(0, 0, 0, 0.45)` | `var(--mask)` |
| `drawer.styl` L21 | `box-shadow 2px 0 8px rgba(0,0,0,.15)` | `var(--shadow-2)` |
| `message.styl` L13-16 | `border-radius 4px`；`box-shadow 0 4px 12px rgba(0,0,0,.15)` | `var(--radius-sm)`；`var(--shadow-2)`；如需状态色条，用 `box-shadow: inset 3px 0 0 0 <状态色>, var(--shadow-2)`（**⚠️ 不要用 `border-left 3px`**，会把内容挤右 3px） |
| `notification.styl` L10, L13 | `border-radius 4px`；`box-shadow 0 4px 12px rgba(0,0,0,.15)` | 同上 |

### 4.10 ⑩ 右键菜单 ★（v2 新增，v1 最大遗漏）

文件：`components/sys-menu/sys-menu.styl`（**89 行**，宽 280/380px）

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L12-13 | `background #08c` / `color #eee` | `var(--active-bg)` / `var(--text)`（**不要用主色实心，3.89:1 不达标**） |
| L18-19 | `color #777` / `background #333`（disabled 态） | `var(--text-disabled)` / `var(--surface-2)` |
| L37 | `hr{border-bottom 1px solid var(--main-darker)}` | `var(--border)` |
| L45 | `box-shadow 0px 0px 3px 3px var(--main-darker)`（子菜单） | `var(--shadow-2)` |
| L61-62 | `background-color #08c` / `color #eee`（子菜单项） | `var(--active-bg)` / `var(--text)` |
| L70 | `border-radius 30px`（`.menu-control`） | `var(--radius-pill)` |
| L8-9, L22-23 | `height/line-height 28px`；`.zoom-item{36px}` | **保持数值** |
| 容器 `.context-menu` L1-3 | `width 280px`，无圆角/阴影/描边 | 补 `border-radius var(--radius)`；描边与阴影合并成一条：`box-shadow 0 0 0 1px var(--border), var(--shadow-2)`（**⚠️ 不要写 `border 1px`**，`width 280px` 是 content-box，加边框会变 282px） |

### 4.11 ⑪ 快捷命令弹层 ★

文件：`components/quick-commands/qm.styl`（**105 行**）

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| L8 | `left var(--left-side-bar-width, 43px)` | **上游已用变量，保持不动** |
| L13 | `bottom var(--footer-stack-height, 36px)` | **上游已用变量，保持不动** |
| L22 | `.qm-search-input{max-width 200px}` | 保留宽度，补 `text-overflow ellipsis` |
| L56, L69 | `border-top 1px solid rgba(255,255,255,0.15)` | `var(--border)`（**浅色主题下白色 15% 会完全不可见**） |
| L100 | `width 100% !important` | 用选择器层级替代 |
| L23-25, L74-82 | `@media 500px / 768px` | 保持断点，内部值换 token |
| L87-105 | `.is-mobile` 块 | **不动**（布局） |

### 4.12 ⑫ 文件传输 / SSH 配置 / 登录页 ★

| 文件 | 行号 | 现状 | 改为 |
| --- | --- | --- | --- |
| `file-transfer/transfer.styl` | L3-6 | `left 60px/top 3px/right 60px/height 36px` | **保持数值**；`height` 不 token 化 |
| `file-transfer/transfer.styl` | L27 | `border-bottom 1px solid var(--primary)` | `var(--border)` |
| `file-transfer/transfer.styl` | L41-44 | `&:hover{color var(--primary-contrast);background var(--primary);border-radius 20px}` | `var(--hover-bg)` + `var(--text)`；`var(--radius-pill)` |
| `ssh-config/ssh-config.styl` | 全 3 行 | 仅 `max-height 60vh` | 补列表项 `var(--hover-bg)` + 焦点环 |
| `auth/login.styl` | L7 | `background #fff`（**暗色主题下刺眼**） | `var(--surface-1)` |
| `main/wrapper.styl` | L3 | `.error-wrapper{background var(--main)}` | `var(--surface-1)` |
| `main/upgrade.styl` | L7-8 | `border-radius 5px`；`border 1px solid var(--main-darker)` | `var(--radius-sm)`；`var(--border)` |
| `main/upgrade.styl` | L10, L12-13 | `width 440px`；`left -600px / top 400px` | **保持尺寸** |
| `main/upgrade.styl` | L23 | `border-bottom 1px solid var(--main-darker)` | `var(--border)` |
| `main/term-fullscreen.styl` | 19 处 `!important` | 全屏适配确实需要 | **保留**，仅把背景/尺寸值换 token |
| `icons/ai-icon.styl` | 5 行 | 颜色 | 走 `currentColor` |
| `common/drag-handle.styl` | L13 | `background #08c` | `var(--primary)` |
| `common/remote-float-control.styl` | L19 | `color #fff` | `var(--primary-contrast)` |
| `common/{input-confirm-common,logo,highlight}.styl` | — | 散值 | 换 token；`logo.styl` L5 `border-radius 28px` → `var(--radius-pill)`；全库保留字断点 |

### 4.13 ⑬ RDP / VNC / SPICE 视图 ★（v3 作用对象已迁移）

**⚠️ 上游 5.5.26 把外壳规则抽到了新文件** `components/common/remote-session-shell.styl`（80 行）。实测类名：

| 类名 | 行号 | 职责 |
| --- | --- | --- |
| `.remote-session-wrap` | L3-9 | 外壳容器（含 `.fit` 修饰 L69-75） |
| `.remote-session-spin` | L13-16 | antd Spin 包装（含 `> .ant-spin-container`） |
| `.remote-session-control` | L20-29 | 工具栏（`-left` L31-37 / `-right` L39-40） |
| `.remote-session-viewport` | L42-64 | 视口（滚动条 L50-61） |
| `.remote-session-fill` | L78-80 | 铺满视口的内容层 |

**改动落点**：

| 位置 | 现状 | 改为 |
| --- | --- | --- |
| `remote-session-shell.styl` L53, L55, L56, L61 | `background var(--main-darker)` / `box-shadow inset 0 0 5px var(--main-darker)`（滚动条区） | `var(--surface-0)`；`var(--shadow-1)` |
| `remote-session-shell.styl` L59 | `border-radius 0` | **保留**（滚动条滑块直角是刻意的） |
| `remote-session-shell.styl` L9 | `background var(--main)` | `var(--surface-1)` |
| `remote-session-shell.styl` L27-28 | `row-gap 4px` / `padding 4px 8px` | **保持数值** |
| `vnc/vnc.styl` L17-26 | 原 `.vnc-scroll-wrapper`（**从 `session.styl` 迁入**）：`background var(--main-darker)`(L18,20,26)；`box-shadow inset 0 0 5px var(--main-darker)`(L21) | `var(--surface-0)`；`var(--shadow-1)` |
| `vnc.styl` / `spice.styl` / `rdp.styl` 的 `!important` | `spice.styl` 7 处、`vnc.styl` 1 处、`rdp.styl` 0 处（**已减少**） | **保留**（全屏适配需要） |
| `rdp.styl` L15 | `.rdp-canvas{outline none}` | **保留**（非焦点语义） |
| 工具栏按钮 | — | 统一 `32×32` + `var(--radius-sm)` + `:hover{background var(--hover-bg)}` |

### 4.14 ⑭ 窄屏适配

文件：`css/mobile.styl`（**257 行**，8 处 `!important`）

- 逐条用更高优先级选择器替代 `!important`（L57、L73、L76、L106、L134、L144 等）。
- L134 `font-size 14px !important` → `var(--fs-lg)`；L96 `font-size 20px`、L100 `font-size 14px` 纳入字号基线。
- 移动端命中态统一 `--active-bg`。
- L120 `bottom calc(var(--footer-stack-height,36px) + var(--shortcut-bar-h,0px) + var(--shortcut-bar-kb-offset,0px))` → **保持不动**（上游变量链）。
- L124 `box-shadow 0 -2px 8px rgba(0,0,0,.2)` → `var(--shadow-2)`。
- L246 `@media (pointer: coarse)` → **保持不动**。

> **注意**：移动端主逻辑是 `.is-mobile` 类 + `constants.js mobileBreakpoint=600`，**不是 media query**。
> 全库 `@media` 实测仅 9 处：`420px`(cmd-history)、`500px`(qm)、`768px`(qm)、`800px`(setting-wrap)、`pointer: coarse`×2、`prefers-reduced-motion`×3。
> 改断点等于改布局行为 → **只换值不改断点**。

### 4.15 ⑮ 剩余零散硬编码（一次性清理）

| 位置（实测） | 现状 | 改为 |
| --- | --- | --- |
| `tree-list/tree-list.styl:29,30,81` | `#000` / `#eee` / `#1a1a1a` | 见 §4.8 |
| `sys-menu/sys-menu.styl:12,13,18,19,61,62` | `#08c` / `#eee` / `#777` / `#333` | 见 §4.10 |
| `tabs/tabs.styl:84,86,88,142,227,276` | `#e0e0e0`×2 / `#ffffff` / `#fff`×3 | 见 §4.1 |
| `ai/ai.styl:109,132,137,213,217,220,259,262,265` | `#1890ff` / `#52c41a` / `#ff4d4f` | 见 §4.6 |
| `terminal/term-search.styl:9,10` | `#333` / `#aaa` | 见 §4.3 |
| `bookmark-form/common/color-picker.styl:6,9` | `#ccc` / `#fff` | 见 §4.8 |
| `auth/login.styl:7` | `#fff` | 见 §4.12 |
| `terminal/terminal.styl:204` | `#888`（作 fallback） | 见 §4.3 |
| `sidebar/info.styl:4` | 渐变 `#08c`/`#09c` | 见 §4.2 |
| `common/drag-handle.styl:13` | `#08c` | 见 §4.12 |
| `common/remote-float-control.styl:19` | `#fff` | 见 §4.12 |
| **`cmd-history.styl:32,85`** | **命名色 `red` / `blue`** ← hex 扫描扫不到 | 见 §4.5 |

### 4.16 ⑯ 终端快捷键条 + 远端监控条 ★（v3 新增区域）

文件：`components/terminal/shortcut-bar.styl`（**214 行**）、`remote-monitor/remote-monitor-bar.styl`（106）、`remote-monitor/monitor-details.styl`（87）

这是 5.5.26 的**全新功能**，且 `shortcut-bar.styl` 是**唯一含圆角散值的新文件**（5 处）。

| 行号 | 现状 | 改为 |
| --- | --- | --- |
| `shortcut-bar.styl` L11 | `height var(--shortcut-bar-h, 44px)` | **保持不动**（上游变量） |
| `shortcut-bar.styl` L14-19 `.shortcut-bar` | `background var(--main)`；`border-top 1px solid var(--main-lighter)` | `var(--surface-1)`；`var(--border)` |
| `shortcut-bar.styl` L20-24 `.shortcut-bar-fixed` | `border-right 1px solid var(--main-lighter)` | `var(--border)` |
| `shortcut-bar.styl` L26-39 `.shortcut-bar-icon-btn` | `:active{background var(--main-lighter)}`(L36-37)；`:hover{color var(--text-light)}`(L38-39) | `var(--hover-bg)`；`:hover` 保留 |
| `shortcut-bar.styl` L54-68 `.shortcut-bar-btn` | `height/min-width 32px`；`border-radius 6px`(L62)；`border 1px solid var(--main-lighter)`(L63)；`background var(--main-light)`(L64)；`font-size 13px`(L66) | 尺寸**保持**；`var(--radius-sm)`；`var(--border)`；`var(--surface-2)`；`var(--fs)` |
| `shortcut-bar.styl` L69-71 | `&:active{background var(--primary);color var(--primary-contrast)}`（**3.89:1**） | `var(--active-bg)` + `var(--text)` |
| `shortcut-bar.styl` L122-126 | `border 1px dashed var(--main-lighter)`；`border-radius 6px`；`background var(--main-dark)` | `var(--border-strong)`；`var(--radius-sm)`；`var(--surface-0)` |
| `shortcut-bar.styl` L138-141 | `border-radius 6px`；`background var(--main-light)`；`border 1px solid var(--main-lighter)` | `var(--radius-sm)`；`var(--surface-2)`；`var(--border)` |
| `shortcut-bar.styl` L153-159 | `border-radius 4px`；`:hover{color var(--error);background var(--main-lighter)}` | `var(--radius-xs)`；`var(--hover-bg)` |
| `shortcut-bar.styl` L175-184 | `border-radius 6px`；`background var(--main)`；`border 1px solid var(--main-lighter)`；`&:hover{background var(--main-lighter)}` | `var(--radius-sm)`；`var(--surface-1)`；`var(--border)`；`var(--hover-bg)` |
| `remote-monitor-bar.styl` L43-46, L83-93 | `&:focus-visible{box-shadow inset 0 0 0 1px var(--primary)}` | **保留**（上游焦点语言，§3.6） |
| `remote-monitor-bar.styl` L104 / `monitor-details.styl` L85 | `@media (prefers-reduced-motion: reduce)` | **保留** |
| `remote-monitor-bar.styl` | `box-shadow` 2 处（散值） | 按 §3.3 收敛到 `var(--shadow-1/2)` |

### 4.17 ⑰ 新增通用组件（item-filter / switch / ai-history / responsive-tabs / quick-command-ai-editor）★

| 文件 | 行数 | 现状 | 改为 |
| --- | --- | --- | --- |
| `common/item-filter.styl` | 54 | L16-18 / L38-40 已有 `outline 1px solid var(--primary)` + `outline-offset` | **作为 §3.6 的样板，不动**；检查其边框/底色是否可用 token |
| `common/switch.styl` | 7 | **完全没用 CSS 变量**（仅 `display/user-select`） | 逻辑样式，无颜色需改；**开关本体由 antd 渲染** → 由 §3.4 的 antd 桥接统一 |
| `ai/ai-history.styl` | 23 | **完全没用 CSS 变量**（仅 ellipsis 布局） | 无颜色需改；纳入 §3.5 动效基线 |
| `common/responsive-tabs.styl` | 34 | L17 `border 1px solid var(--main-light)`；L18 `border-radius 4px`；L21-23 `:hover{color,border-color var(--primary)}` | `var(--border)`；`var(--radius-sm)`；**焦点态由 §3.6 全局规则接管** |
| `quick-commands/quick-command-ai-editor.styl` | 13 | 仅预览区布局（`padding 12px`/`max-height 300px`） | **保持数值**；纳入 §3.5 |

> **结论**：这 5 个"完全没用变量"的文件里，**只有 `responsive-tabs.styl` 有真实颜色需要 token 化**，其余是纯逻辑样式。
> 不要为了"纳入了就说要改"而制造无意义 diff。

---

## 五、七维度审计

对**全部拟改动项**从 7 个维度逐项审计。审计方法：静态分析 + 实测数据 + 爆炸半径推演。

### 5.1 维度一：功能正确性

**审计对象**：选择器命中范围、布局尺寸、可见性、层叠顺序、`display`/`overflow`/`pointer-events`。

| 审计项 | 方法 | 发现 | 动作 |
| --- | --- | --- | --- |
| 类名是否被重命名 | 全库 diff 比对 class 名 | 方案**零类名改动** | ✅ 安全 |
| DOM 结构是否变更 | 方案只改 `.styl` + 2 个 js | 零 DOM 变更 | ✅ e2e 可见性断言 8 处不受影响 |
| 布局尺寸是否变化 | 检查 `width/height/left/top/padding` 改动 | `36px` 系**一律保留原值**；`--sp-*` 替换的 padding **全部取消**（见下） | ✅ 已修正 |
| 是否为元素新增 `display:none` | 检查新增规则 | 无 | ✅ |
| `!important` 清理是否改变层叠 | 逐处确认替代选择器优先级更高 | 46 处中 **26 处清理、19 处保留、1 处新增**（reduced-motion） | ⚠️ 清理处需逐一目视验证 |
| 用 `box-shadow inset` 代替 `border-*` | §4.5 `.main-footer` | `content-box` + `height:36px` → 加 `border-top` 会外扩 1px | ✅ **已改为 inset 阴影（v3 修正）** |

> ⚠️ **v2 发现并保留的方案缺陷**：§4.7 把 `padding 20px` 写成 `var(--sp-4)`(16px)，**改变了数值**，属布局变更。
> **结论（v3 沿用）**：间距 token **只用于新代码**，现有 `padding`/`margin` 一律保持原值不动。

### 5.2 维度二：主题兼容性

**审计对象**：5 类主题 × 新增 18 个变量。

| 主题 | 数量 | uiThemeConfig | 派生变量 | 静态变量 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 内置 default（暗） | 1 | 12 key | ✅ 正确 | ✅ | 通过 |
| 内置 defaultLight | 1 | 12 key | ✅ 正确 | ✅ | 通过 |
| iTerm 主题 | **310** | 12 key（实测样本） | ✅ 自动适配（含浅色主题） | ✅ | 通过 |
| 缺 `uiThemeConfig` | — | undefined → 回落默认 | ✅ | ✅ | 通过 |
| 空对象 `{}` | — | `''` → 全静态兜底 | ✅ 静态暗色 | ✅ | 通过 |
| 用户自建主题 | 不限 | 12 key | ✅ | ✅ | 通过 |

**关键审计结论**：因为采用**派生**而非**扩展**，**主题编辑器保存路径完全未被触碰** → §1.5 约束 A 的三类破坏（`Missing prop`、AI 提示词、主题文本格式）**全部不发生**。

**v3 新增结论**：新 token **完全不依赖 `--main-darker` / `--main-lighter`**，
因此**即使 `darker()` 未被修复**（或将来又被改坏），新 token 依然正确 —— 这是本方案相对 v2 的一处**稳健性提升**。

**残留风险**：`--active-bg` 派生自 `--primary`。若某 iTerm 主题的 `primary` 是浅色（如 `#FFD166`），`--active-bg`（18% 透明度）在浅色背景上可能过淡。**缓解**：`--active-bg` 用于选中底色，即使偏淡也仍可辨识（配合左侧色条）；不构成功能缺陷。

### 5.3 维度三：视觉一致性

**审计对象**：token 覆盖率、收敛度。

| 指标 | 改动前（5.5.26 实测） | 改动后目标 | 度量方式 |
| --- | --- | --- | --- |
| 圆角种类 | **12 种 / 45 处** | **5 种**（全部 token） | `grep -rhoE "border-radius [0-9]+px" --include=*.styl src/client` 应为空 |
| 阴影写法 | **22 种** | **3 种**（保留 `inset` 功能指示条除外） | `grep -rhoE "box-shadow [^;]*" --include=*.styl src/client \| sort -u` |
| 硬编码 hex | **33 处** | **0 处** | `grep -rEn "#[0-9a-fA-F]{3,8}" --include=*.styl src/client \| grep -v includes/` 应为空 |
| 命名色（`red`/`blue`） | 2 处 | **0 处** | 人工检查（hex 扫描扫不到） |
| 未定义变量引用 | 4 处 | **0 处** | §6.9 单测 1 拦截 |
| `transition` 覆盖 | 8 个文件 | 20+ 个文件 | `grep -rlc "transition" --include=*.styl src/client` |
| `!important` | **46 处** | **≤20 处**（保留 19 + reduced-motion 1） | `grep -rc "!important" --include=*.styl src/client` |

### 5.4 维度四：无障碍与对比度 ★ 实测

**方法**：用 WCAG 2.1 相对亮度公式实测算各前景/背景组合。

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

#### ★ v3 新增：5.5.26 新 UI / 新发现的对比度问题

| 位置（实测行号） | 组合 | 对比度 | 判定 |
| --- | --- | --- | --- |
| `shortcut-bar.styl:70-71` `&:active` | `--primary-contrast #fff` / `--primary #08c` | **3.89** | ⚠️ 本次整改为 `--active-bg`+`--text` |
| `setting-wrap.styl:158-160` `.setting-mobile-back-btn:hover` | 同上 | **3.89** | ⚠️ 本次整改 |
| `list.styl:31-32/35-37` 设置左列表选中/hover | 同上 | **3.89** | ⚠️ 本次整改 |
| `tabs.styl:275-276` `.layout-menu-item.active` | `#fff` / `--primary` | **3.89** | ⚠️ 本次整改 |
| `sftp.styl:21-22/25-26/49-50` hover/selected | 同上 | **3.89** | ⚠️ 本次整改（§4.4） |
| `transfer.styl:41-43` 传输项图标 hover | 同上 | **3.89** | ⚠️ 本次整改 |
| `terminal.styl:230` `.terminal-reconnect-overlay` | `rgba(255,255,255,.55)` 合成于 `#ededed` ≈ `#f7f7f7` | **≈1.1** | 🔴 **浅色主题下完全不可见** → 本次整改为 `var(--text-dark)` |
| `qm.styl:56,69` 分隔线 | `rgba(255,255,255,.15)` / `#ededed` | ≈1.05 | 🟡 装饰线，浅色下消失 → 本次整改为 `var(--border)` |
| `sys-menu.styl:12-13/61-62` 菜单选中 | `#eee` / `#08c` | ≈3.6 | ⚠️ 本次整改为 `--active-bg`+`--text` |

**结论与动作**：

| 发现 | 动作 |
| --- | --- |
| 🔴 浅色主题下 `--success` 仅 1.61:1，几乎不可见 | **不在本次美化范围内修改**（改颜色值＝改主题语义，且要同步 310 个 iTerm 主题）。**记录为已知缺陷**，单独提 issue |
| 🔴 **全库 9 处「主色实心 + 白字」均为 3.89:1（AA 不达标）** | **本次统一整改为 `--active-bg`/`--hover-bg` + `--text`**（§4.4/4.5/4.7/4.10/4.12/4.16）——这是本次**最大的一处对比度收益** |
| 🔴 浅色主题下 2 处「白色系」色值完全不可见（`terminal.styl:230`、`qm.styl:56,69`） | **本次修复** → `var(--text-dark)` / `var(--border)` |
| ⚠️ `--text-light` 在浅色主题语义反转 | 深色下 `#fff` 是"更亮=更醒目"，浅色下 `#777` 是"更浅=更淡"。`sidebar.styl` 等 `:hover{color var(--text-light)}` 在浅色主题下 hover **反而变淡**。**动作**：记录，不在本次修改 |
| ⚠️ `--text-disabled` 深浅两个主题都不达 AA | 该变量语义即"禁用"，不达 AA 属常见取舍。**动作**：不改，但新代码不要用它承载需读的文字 |
| 🔴 **无键盘焦点可视化** | **本次修复**（§3.6）—— 这是本次唯一"新增无障碍能力"的改动 |
| 🟡 无 `prefers-reduced-motion` 兜底 | **本次修复**（§3.7） |
| 🟡 无 CJK 字体回退 | **本次修复**（§3.8） |
| 🟡 滚动条仅 `::-webkit-scrollbar` | 记录：Electron 只跑 Chromium，无需 `scrollbar-color`。**不改** |

### 5.5 维度五：性能

**审计对象**：CSS 体积、`transition`/`animation` 数量、重绘与合成开销。

| 审计项 | 现状 | 改动后预估 | 评估 |
| --- | --- | --- | --- |
| CSS 文件体积 | 78,359 字节（单行压缩） | +约 2–3 KB（18 个变量 + transition 声明），约 +3% | ✅ 可忽略 |
| `transition` 数量 | 8 个文件 | 20+ 个文件 | ✅ 均只覆盖 `background`/`color`/`border-color`/`outline-color`（可合成或低开销属性），不影响布局 |
| 无限循环动画 | **6 处**：`session.styl:38`(60s)、`tabs.styl:111,122`(2s)、`ai.styl:214`(1s)、`rdp.styl:39`(1s)、`bookmark-form.styl:52`(1.1s) | 不变 | ⚠️ **不新增**。其中 `ai.styl:214` 与 `rdp.styl:39`(1s) 频率最高，若用户反馈耗电需单独优化 |
| 是否引入 `will-change` / `filter` / `backdrop-filter` | 方案未使用 | 0 | ✅ 避免过度合成 |
| 是否引入布局抖动 | `transition` 不含 `width/height/margin`；新增描边一律用 `box-shadow inset` | 0 | ✅ |
| `color-mix()` 运行时开销 | 新引入 4 个派生变量 | 仅在变量解析时计算一次（`:root` 级），元素消费的是已解析值 | ✅ 无逐帧开销 |
| antd `motion: false` → 恢复动效 | 当前全局关闭 | 恢复后 antd 组件带动画 | ⚠️ **本方案唯一有性能观感风险的改动**。缓解：若卡顿，改用 `motion: { motionDurationFast: '0.12s', motionDurationMid: '0.18s' }` 缩短时长而非关闭 |

**结论**：性能维度为**净中性偏好**（体积增长可忽略，`transition` 属性选择克制），唯一需观察的是 antd 动效恢复。

### 5.6 维度六：可维护性与可测试性

**审计对象**：token 单点定义、自动校验能力、命名一致性。

| 审计项 | 现状 | 改动后 | 评估 |
| --- | --- | --- | --- |
| 变量定义点 | 3 处副本（值不一致） | **1 处**（`theme-defaults.js` + `tokens.styl` 兜底） | ✅ |
| 是否存在静态检查 | 无（`standard` 只扫 JS，无 stylelint） | **新增 4 个单测**（§6.9） | ✅ 从"靠人眼"升级为"可回归拦截" |
| 命名一致性 | `--main-light`/`--main-lighter` 混用 | 新增 token 统一 `--<类别>-<变体>` 格式 | ✅ 老变量保持不动（避免大面积改引用） |
| 能否自动发现「用了没定义的变量」 | ❌ 当前已存在 4 处静默失效 | ✅ 单测 1 拦截 | ✅ **本方案的核心工程价值** |
| 能否自动发现硬编码颜色 | ❌ | ✅ 单测 3 拦截 | ✅ |
| 文档化 | 本文档 + `tokens.styl` 内注释 | ✅ | ✅ |

### 5.7 维度七：风险与可回滚性

| 步骤 | 爆炸半径 | 回滚成本 | 风险等级 |
| --- | --- | --- | --- |
| Step 1 新增 `tokens.styl` | 全局（纯新增） | **单文件删除** | 🟢 极低 |
| Step 2 合并 3 份默认主题 | 全局（仅 `--main` 差 `#141314`→`#121214`，肉眼不可辨） | 单文件 revert | 🟢 极低 |
| Step 3 补死变量 + 清 antd 残留名 | 3 个文件，4 处 | 单文件 revert | 🟢 极低 |
| **Step 4 修复 `darker()`** | **全局 29 处声明从"失效"变"生效"**（默认主题下为近黑色，视觉变化极小） | revert 1 个 commit | 🟡 低 |
| **Step 5 收敛圆角/阴影** | **全局，观感变化最明显** | revert 1-2 个 commit | 🟠 **中** |
| **Step 6 修 antd 桥接** | **全局 antd 组件**（弹窗/下拉/表格/按钮/开关） | revert 1 个 commit | 🟠 **中** |
| Step 7 动效基线 | 全局（新增声明） | revert | 🟢 低 |
| Step 8 焦点环 + reduced-motion + CJK 字体 | 全局（纯新增 3 段） | revert | 🟢 低 |
| Step 9 新增 4 个单测 | 无运行时影响 | 删除 4 个 spec | 🟢 极低 |
| Step 10–26 逐区域精修（17 个） | **单区域** | 单区域 revert | 🟢 低（§4.4 SFTP / §4.14 窄屏为 🟠） |
| Step 27 方案 B（theme-light class） | 全局阴影 | revert 3 行 + 删一块 | 🟢 低 |

**风险控制措施**：

1. **提交粒度**：每步一个 commit，commit message 带步骤号（如 `style(tokens): 新增设计 token，零视觉变化`），保证任意步骤可单独 revert。
2. **顺序不可换**：Step 1 是 Step 5-26 的前置；区域精修必须在 token 就绪后，否则会产生新的硬编码。
3. **每步前后各跑一次 `npm run test-unit-ci`**（Step 9 之后生效）。
4. **观感类改动（Step 5、6、27）单独做，不与其他步骤混提交。**
5. **不做"顺手优化"**：例如看到 `--main-light` 只用了 11 次就去合并它 —— 超出范围，增加风险。

### 5.8 审计结论汇总

| 维度 | 结论 | 阻断级问题 |
| --- | --- | --- |
| 一 功能正确性 | ✅ 安全，已修正 padding 数值不等价、`.main-footer` 边框外扩 2 处缺陷 | 无 |
| 二 主题兼容性 | ✅ 因改「派生」后完全兼容 310+ 主题；新 token 不依赖损坏的 `darker()` | 无 |
| 三 视觉一致性 | ✅ 圆角 12→5、阴影 22→3、硬编码 33→0、`!important` 46→≤20 | 无 |
| 四 无障碍对比度 | 🟠 修复 2 项 + **新增修复 9 处 3.89:1 主色实心**；**遗留 2 个既有缺陷（浅色 `--success` 1.61:1、`--text-light` 语义反转）建议单独提 issue** | 无（均在本次范围外） |
| 五 性能 | ✅ 净中性偏好；唯一观察点 = antd 动效恢复 | 无 |
| 六 可维护性 | ✅ 新增 4 个单测，把静默失效变为可拦截 | 无 |
| 七 风险回滚 | ✅ 8 个低风险 + 2 个中风险（各自独立可回滚） | 无 |

---

## 六、详细落地计划

### 6.0 总览

| 阶段 | 步骤 | 提交数 | 风险 | 状态 |
| --- | --- | --- | --- | --- |
| 准备 | Step 0 基线快照 | — | — | ✅ 已完成 |
| Layer 1 | Step 1 新增 tokens | 1 | 🟢 | ✅ **已完成** |
| Layer 2 | Step 2–8 统一层 | 7 | 🟢🟢🟢🟡🟠🟠🟢🟢 | **Step 2 ✅ 已完成**，Step 3–8 ⏳ 待执行 |
| 单测 | Step 9 新增 4 个 spec | 1 | 🟢 | ⏳ 待执行 |
| Layer 3 | Step 10–26 逐区域精修 | 17 | 🟢（2 个 🟠） | ⏳ 待执行 |
| 可选 | Step 27 方案 B | 1 | 🟢 | ⏳ 待执行 |

> **v4 定案（2026-09-24）**：区域精修（Step 10–26）一律按 **§2.8 四要素**执行（浸染底 / 光晕 / 状态芯片 / 渐变线 / 等宽点缀），
> 并在 **Step 14 增加「无会话首页 hero」**（`no-session.styl`：顶部品牌光晕 + 主色实心主按钮 + ghost 次按钮）。
> token 取值以 §2.3（v4 定稿）为准。

**每步通用验证模板**：

```bash
# 0) ⚠️ 环境：必须 Node 22（见审计文档 §十三）
export PATH="$HOME/.config/nvm/versions/node/v22.23.2/bin:$PATH"
# 1) 编译（必须无错误）
npm run compile
# 2) CSS 语法完整性：产物应存在且能 grep 到关键字
ls -l work/app/assets/css/style-5.5.26.css
# 3) 单测（Step 9 之后生效）
npm run test-unit-ci
# 4) 目视
npm run t
```

### 6.1 Step 0 · 基线快照

**改什么**：无代码改动。

**做什么**：

```bash
cd /media/dp25/DATA/deb/fcitx5-deb/github/electerm
git status --short     # ✅ 实测：当前为空（tabs 美化起步改动已随 5.5.26 合并提交）
git log --oneline -1   # 应显示 c9029f9c
# 记录基线指标
grep -rhoE "border-radius [0-9]+px" --include=*.styl src/client | sort | uniq -c | sort -rn
grep -rhoE "box-shadow [^;]*" --include=*.styl src/client | sort -u | wc -l
grep -rEn "#[0-9a-fA-F]{3,8}" --include=*.styl src/client | grep -v "includes/" | wc -l
grep -rho "!important" --include=*.styl src/client | wc -l
grep -rlc "transition" --include=*.styl src/client | wc -l
```

**基线期望值（5.5.26 实测，用于事后比对）**：圆角 **12 种 / 45 处**、阴影 **22 种**、hex **33 行**、`!important` **46**、`transition` **8 个文件**。

> ✅ **v2 里"历史包袱处理"（提交未提交的 `tabs.styl`）已不再需要** —— 升级合并时该改动已随冲突解决一并提交。

**单测**：无。

---

### 6.2 Step 1 · 新增 `tokens.styl`（零视觉变化）　✅ **已执行**

> **执行结果**：`color-mix` 4 处存活 · 18 个 token 全部入产物且无重复 · CSS +697 B（78,359 → 79,056）· 单测 450/450 · 视觉零变化。
> **过程中发现并已回写文档**：裸 `color-mix(in srgb, …)` 会让 Stylus 编译失败，必须 `unquote()` 包裹（§2.3 / §2.4）。

**改什么**：

| 文件 | 改动 |
| --- | --- |
| `src/client/css/includes/tokens.styl` | **新建**（v4 定稿 **66 行**，含浸染色阶/光晕/状态芯片/等宽 token，见 §2.3） |
| `src/client/css/includes/index.styl` | **首行**插入 `@require './tokens'`（原 3 行 → 4 行） |

> **顺序说明**：`includes/index.styl` 被 `basic.styl:1` 首先 `@require`，`includes/theme.styl` 在其后（`basic.styl:2`）。
> 把 `tokens` 放在 `index.styl` 首行 → 产物中 token 声明先于 `theme.styl` 的兜底值出现，可读性最好。
> （CSS 变量无"声明顺序依赖"，运行时解析，此处纯为产物整洁。）

**怎么验证**：

```bash
npm run compile
# ① color-mix 是否存活于压缩产物（§2.4 的关键验证）
grep -c "color-mix" work/app/assets/css/style-5.5.26.css          # 期望 > 0
# ② 新变量是否进入产物
grep -o "\-\-surface-1" work/app/assets/css/style-5.5.26.css | head -1   # 期望有输出
grep -o "\-\-radius-lg" work/app/assets/css/style-5.5.26.css | head -1   # 期望有输出
# ③ 目视：应用外观应与 Step 0 完全一致
npm run t
```

**目视检查点**：标签栏、侧栏、终端、SFTP、设置、弹窗各扫一眼，颜色/布局**不应有任何变化**。

**是否单测**：❌ 不需要（纯新增变量）。Step 9 会补覆盖它的测试。

**回滚方式**：删除 `tokens.styl` + revert `index.styl` 1 行。

**风险**：🟢 极低。

---

### 6.3 Step 2 · 合并 3 份默认主题副本　✅ **已执行**

> **执行结果**：`theme.styl:2` `--main` `#141314` → `#121214`（产物验证：CSS 中 `--main` 静态定义**恰好 1 处**且值已对齐；全库 styl 无其他 `--main` 定义点）。
> **方案调整（用户决策）**：原计划改写 `common/ui-theme.js` 的第三份副本，实测发现该文件为**死代码**（四重证据见 §3.1），
> 改写会给它加 import、造成"活代码"误导 → **本步不动、仅记录**，删除动作留作后续独立 commit。
> `npm run test-unit-ci` ✅ fail 0。视觉变化：`#141314` → `#121214` 差 2 个色阶，肉眼不可辨。

**改什么**：

| 文件 | 行号 | 改动 | 状态 |
| --- | --- | --- | --- |
| `src/client/css/includes/theme.styl` | L2 | `--main #141314` → `#121214`（与 `theme-defaults.js:31` 对齐） | ✅ 已执行 |
| ~~`src/client/common/ui-theme.js`~~ | ~~L5-18, L20~~ | ~~删除 `defaultUiThemeStylus`、改由 `theme-defaults.js` 生成~~ | ❌ **未执行**：实测为死代码（§3.1 四重证据），用户决策不动、仅记录 |

**怎么验证**：

```bash
npm run compile && npm run t
# 目视：默认主题下颜色应与改动前一致（--main 从 #141314 → #121214，肉眼不可辨）
# 打开 设置 → 主题，确认主题列表正常加载、切换正常
```

**是否单测**：⚠️ **建议加**（Step 9 单测 2 覆盖）—— 断言 `theme-defaults.js` 的 12 个 key 与 `theme.styl` 的静态兜底 key **集合一致**，防止再次分叉。

**回滚**：revert 本 commit。**风险**：🟢 极低。

---

### 6.4 Step 3 · 补死变量 + 清 antd 残留名

**改什么**：

| 文件 | 行号 | 改动 |
| --- | --- | --- |
| `src/client/components/ai/ai.styl` | L157 | `var(--text-color-2)` → `var(--text-dark)` |
| `src/client/components/ai/ai.styl` | L236 | 同上 |
| `src/client/components/footer/cmd-history.styl` | L65 | `var(--text-color-secondary)` → `var(--text-dark)` |

（`--border` 与 `--hover-bg` 已在 Step 1 定义，无需改引用处。）

**怎么验证**：

```bash
npm run compile && npm run t
# 目视：AI 面板的次要文字、命令历史面板的文字颜色应正常显示（改动前因变量未定义而继承父级色）
```

**是否单测**：✅ **必须加**（Step 9 单测 1）—— 「所有 `var(--x)` 引用必须有定义」正是拦截这 4 处的一劳永逸方案。

**回滚**：revert。**风险**：🟢 极低。

**附带收益**：`sidebar.styl:57` 的分隔线**从完全不显示变为正常显示** —— 修复了一个隐形缺陷，需在验收清单中确认。

---

### 6.5 Step 4 · 修复 `darker()`（🟡 低风险，但必须独立提交）

**改什么**：`src/client/components/main/ui-theme.jsx` L11-29，按 §3.9 的 3 处改动（上下界钳制 + `padStart(6,'0')`）。

**为什么放在区域精修之前**：不修的话，29 处 `var(--main-darker)` 的边框/阴影根本没渲染，**"改动前基线"是失真的**，会导致区域精修时误判观感。

**怎么验证**：

```bash
npm run lint        # 改了 js，必须跑
npm run compile && npm run t
# ① §3.9 的 node 断言脚本（期望 #000000 / #ffffff / #5e5e60）
# ② 目视：弹窗/右键菜单/右侧面板的边框应"出现"，但在深色背景上极不显眼
# ③ 切到浅色 iTerm 主题（如 3024 Day），确认 --main-lighter 边框不再异常
```

**目视检查点**：弹窗（`modal.styl:40,77`）、右键菜单（`sys-menu.styl:37,45`）、右侧面板（`right-side-panel.styl:15,28`）、SFTP（`sftp.styl:41,47,178`）、AI 面板（`ai.styl:24,127,195,224,326`）—— 这些位置在修复前**完全没有边框/阴影**，修复后应出现一条近黑色描边。

**是否单测**：⚠️ **建议加**（可选）—— 断言 `darker()` 输出恒匹配 `/^#[0-9a-f]{6}$/i`。价值中等，但成本极低。

**回滚**：revert 本 commit。**风险**：🟡 低（默认深色主题下 `#000` 在 `#121214` 上对比度仅 ≈1.05，视觉变化接近不可见）。

---

### 6.6 Step 5 · 收敛圆角与阴影（🟠 观感变化最大）

**改什么**：按 §3.3 的两张映射表逐文件替换。

**建议拆分**：

| 子步骤 | 范围 | 文件 |
| --- | --- | --- |
| 5a | 圆角收敛 | 全部含 `border-radius` 的文件（12 种 → 5 种，45 处） |
| 5b | 阴影收敛 | `session.styl`、`sftp.styl`、`terminal.styl`、`common/modal.styl`、`common/{message,notification,drawer}.styl`、`footer.styl`、`tabs.styl`、`sys-menu.styl`、`tree-list.styl`、`add-btn.styl`、`main/upgrade.styl`、`remote-session-shell.styl`、`vnc.styl`、`mobile.styl`、`shortcut-bar.styl` |

**怎么验证**：

```bash
npm run compile
# ① 圆角：源码层面应清零裸 px
grep -rEn "border-radius [0-9]+px" --include=*.styl src/client    # 期望：无输出
# ② 阴影：源码中只允许 token + 功能指示条
grep -rhoE "box-shadow [^;]*" --include=*.styl src/client | sort -u
npm run t
```

**目视检查点**（观感最明显的一步，必须逐页对照）：

- 标签栏：标签顶部圆角是否协调（3px → 8px）
- 弹窗：圆角 8 → 12px 是否过圆；阴影是否过重
- SFTP 列表行、侧栏列表项
- 浮层（下拉、命令提示、AI 气泡）
- 快捷键条按钮（6px → 6px 不变，4px → 4px 不变；仅收敛写法）
- 深色 / 浅色主题各看一遍

**是否单测**：✅ **建议加**（Step 9 单测 4）—— 断言 `.styl` 中 `border-radius` / `box-shadow` 只允许 token 引用。这样后续新增样式无法"偷偷"引入新值。

**回滚**：revert（5a/5b 各一个）。**风险**：🟠 中 —— **这是唯一"改完可能觉得不好看"的步骤**，务必单独提交。

---

### 6.7 Step 6 · 修复 antd 桥接（🟠 影响所有 antd 组件）

**改什么**：`src/client/store/store.js` L266-283，按 §3.4 替换整个 getter。

**怎么验证**：

```bash
npm run lint          # ⚠️ 唯二改 js 逻辑的步骤（另一处是 Step 4）
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
2. **`fontSize: 13`**：与 `basic.styl:7` 的全局 12px 组合后，antd 组件内文字是否与自制组件视觉一致。
3. **`colorBgElevated` / `colorBorder`**：SFTP 表格斑马纹、下拉面板背景是否正常（这两个是新引入的映射）。
4. **浅色主题**：切到浅色主题，确认 antd `algorithm` 正确切换（`isColorDark` 逻辑未改，但 `colorBgBase` 等新增映射需验证）。

**是否单测**：⚠️ **可加但价值有限**（`uiThemeConfig` 是 getter，测它需要 mock `window.store`）。**建议不加**，靠目视。

**回滚**：revert 本 commit。**注意**：此步与 Step 5 有观感叠加效应，若整体不满可两步一起回滚。**风险**：🟠 中。

---

### 6.8 Step 7 · 动效基线

**改什么**：按 §3.5，对主要交互元素补 `transition`。

**建议拆分**：按区域分 2-3 个 commit（tabs/sidebar/footer 一批，sftp/sys-menu/qm 一批，common + shortcut-bar 一批）。

**怎么验证**：

```bash
npm run compile && npm run t
grep -rlc "transition" --include=*.styl src/client    # 应从 8 个文件增至 20+ 个文件
```

**目视检查点**：hover 标签、hover 侧栏图标、hover SFTP 行、hover 右键菜单项、hover 快捷键条按钮 —— 应有**平滑过渡**而非瞬变；**过渡不应造成"闪烁"或"残影"**。

**是否单测**：❌ 不需要。**回滚**：revert。**风险**：🟢 低。

---

### 6.9 Step 8 · 焦点环 + reduced-motion + CJK 字体

**改什么**：

| 文件 | 改动 |
| --- | --- |
| `src/client/css/basic.styl` | 末尾追加 §3.6 的 `:focus-visible` 规则 + §3.7 的 `@media (prefers-reduced-motion)` |
| `src/client/css/basic.styl` | **L9** 字体栈插入 CJK 字体（§3.8） |

**怎么验证**：

```bash
npm run compile && npm run t
```

**目视/交互检查点**（必须用键盘实测）：

1. **Tab 键遍历**：从窗口顶部开始按 Tab，焦点环应出现在标签栏 → 侧栏图标 → 内容区的顺序上，且**清晰可见**。
2. **鼠标点击**：点击任意按钮/列表项，**不应**出现焦点环（验证 `:focus-visible` 而非 `:focus` 生效）。
3. **antd 双重焦点环**：Tab 进入 antd `Input`/`Select`，若出现"双层环"，按 §3.6 的处置方案加 `:not()` 排除。
4. **reduced-motion**：系统设置开启"减少动画"（或 DevTools 模拟 `prefers-reduced-motion: reduce`），确认动画/过渡基本停止。
5. **CJK 字体**：切换语言到中文/日文，确认汉字与英文/数字**字体一致**（不再混搭）。

**是否单测**：❌ 不需要。**回滚**：revert。**风险**：🟢 低。

> **注意**：这步是本次唯一"新增无障碍能力"的改动，也是**最容易被忽略验证**的一步。必须真按 Tab 键测一次。

---

### 6.10 Step 9 · 新增 4 个 CSS 契约单测 ★

**改什么**：新建 4 个 spec 到 **`src/test/unit-ci/`**。全部走 **CommonJS + `node:test`**（与现有 30 个 spec 一致，参考 `src/test/unit-ci/sanitize-filename.spec.js` 的 `require('node:test')` 写法），纯文本分析，**不依赖 DOM / 浏览器 / 构建产物**。

| # | 文件 | 断言 | 拦截的问题 |
| --- | --- | --- | --- |
| 1 | `src/test/unit-ci/css-tokens.spec.js` | 扫描 `src/client/**/*.styl` 中所有 `var(--x)`，必须存在于 `css/includes/{theme,tokens}.styl` 的定义集合 + 上游变量白名单（`--left-side-bar-width`/`--footer-stack-height`/`--shortcut-bar-h`/`--shortcut-bar-kb-offset`/`--ai-watermark`）中 | **`--border` 类静默失效**（当前 4 处） |
| 2 | `src/test/unit-ci/theme-props.spec.js` | (a) `requiredThemeProps` 的 12 个 ui key ⊆ `theme.styl` 静态兜底 key；(b) 抽样校验 `@electerm/electerm-themes` 主题文件包含全部 12 个 ui key | **主题 key 与静态兜底分叉**（§1.5 约束 A/B） |
| 3 | `src/test/unit-ci/css-hardcoded-colors.spec.js` | `src/client/**/*.styl` 中不得出现硬编码 hex（allowlist：`theme.styl` / `tokens.styl`）；**并额外断言无 `color red`/`color blue` 命名色** | **硬编码颜色回流**（当前 33 处 + 2 处命名色） |
| 4 | `src/test/unit-ci/css-radius-shadow.spec.js` | `border-radius` / `box-shadow` 只允许 `var(--radius*)` / `var(--shadow*)` 或白名单（`100%`、`border-radius 0`、`inset 0 2px 0 0 var(--primary)` 等功能指示条） | **圆角阴影重新发散**（当前 12 + 22 种） |

**实现要点**（保证可运行、不误报）：

- 用 `require('node:fs')` + `require('node:path')` 递归读文件，正则提取，`assert` 断言。
- 扫描范围限定 `src/client`，排除 `node_modules`。
- 单测 3 的 allowlist 要包含 `color-mix(in srgb, ...)` 里的颜色与 `tokens.styl` 内的 `rgba(0,0,0,.30)` 等。
- 单测 4 需容忍多值写法（如 `var(--radius) var(--radius) 0 0`）、`50%`/`100%`（几何用途）与 `border-radius 0`。
- 单测 1 需处理 `var(--x, fallback)` 形式（取逗号前的变量名），以及嵌套引用。

**怎么验证**：

```bash
npm run test-unit-ci        # 期望：新增 4 个 spec 全部通过，总数 34 spec / 450+
```

**⚠️ 必须做的反向验证**（证明测试真的有效，而不是恒真）：

```bash
# 故意在某个 .styl 里加一行 var(--nonexistent-xyz)，跑单测 1 → 应失败
# 故意加一行 color #abcdcb，跑单测 3 → 应失败
# 故意加一行 border-radius 7px，跑单测 4 → 应失败
# 验证后还原
```

**是否单测**：这步**本身就是单测**。**回滚**：删除 4 个 spec 文件。**风险**：🟢 极低。

**排序说明**：放在区域精修（Step 10+）**之前**，这样后续 17 个区域的改动都被自动看护。

---

### 6.11 Step 10–26 · 逐区域精修（17 个 commit）

按 §四 的顺序，**每个区域一个 commit**。顺序由「改动小、风险低」到「改动大、风险高」：

| 步骤 | 区域 | 文件数 | 风险 | 备注 |
| --- | --- | --- | --- | --- |
| Step 10 | ⑮ 零散硬编码清理（含 2 处命名色） | 12 | 🟢 | 先清干净，后续改动不再踩 |
| Step 11 | ⑨ 通用层（modal/drawer/message/notification） | 4 | 🟢 | 复用面最广，先做 |
| Step 12 | ⑩ 右键菜单 `sys-menu` | 1 | 🟢 | v1 遗漏项，高频组件 |
| Step 13 | ⑪ 快捷命令 `quick-commands` | 1 | 🟢 | v1 遗漏项 |
| Step 14 | ① 标签栏 | 3 | 🟢 | 含"取向差异"说明（§4.1） |
| Step 15 | ② 侧栏 | 4 | 🟢 | 含 `--border` 修复验证 |
| Step 16 | ⑤ 底栏 | 2 | 🟢 | `box-shadow inset` 方案 |
| Step 17 | ⑧ 表单弹窗 / 树列表 / 颜色选择器 | 3 | 🟢 | |
| Step 18 | ④ SFTP | 5 | 🟠 | hover 语义变更，重点目视 |
| Step 19 | ③ 终端会话区 | 4 | 🟠 | 涉及 xterm 容器，谨慎 |
| Step 20 | ⑥ 右侧面板 / AI | 3 | 🟠 | AI 气泡圆角变化；`ai.styl` 336 行 |
| Step 21 | ⑦ 设置中心 | 5 | 🟢 | **不碰主题校验逻辑**；`theme-form.styl` 无规则可改 |
| Step 22 | ⑫ 传输 / SSH 配置 / 登录页 | 10 | 🟢 | 含 `login.styl` 白底修复 |
| Step 23 | ⑬ RDP / VNC / SPICE（**已迁到 `remote-session-shell.styl`**） | 4 | 🟢 | `!important` 保留 |
| Step 24 | ⑯ 快捷键条 + 远端监控条 | 3 | 🟢 | **5.5.26 新区域** |
| Step 25 | ⑰ 新增通用组件（item-filter/switch/ai-history/responsive-tabs/quick-command-ai-editor） | 5 | 🟢 | 多半无需改（§4.17） |
| Step 26 | ⑭ 窄屏 `mobile.styl` | 1 | 🟠 | 需窄窗口实测 |

**每个区域的验证流程**（统一模板）：

```bash
export PATH="$HOME/.config/nvm/versions/node/v22.23.2/bin:$PATH"
npm run compile
npm run test-unit-ci          # 4 个新单测应始终通过
npm run t
```

**目视检查点**：该区域的 **hover / active / selected / focus / disabled** 五种状态 + 深色/浅色两个主题。

**是否单测**：❌ 不改（Step 9 的 4 个单测已提供全局看护，会自动覆盖每个区域的改动）。

**回滚**：单区域 revert。

> **若某区域改完不满意**：不要在该 commit 上继续叠加修改，直接 `git revert` 后重做。保持"一区域一 commit"的干净历史。

---

### 6.12 Step 27 ·（可选）方案 B：精确阴影分档

**改什么**：`src/client/components/main/ui-theme.jsx` 的 `applyTheme()`（L57-61）中追加 3 行（§2.6），`tokens.styl` 追加 `.theme-light` 块。

**怎么验证**：

```bash
npm run lint && npm run compile && npm run t
# 切换到浅色主题，确认阴影明显变浅
# 切换回深色主题，确认阴影正常
# 切到某个 iTerm 浅色主题（如 "3024 Day"），确认阴影也变浅
```

**是否单测**：❌ 不必要。**回滚**：revert 3 行 + 删除 `.theme-light` 块。**风险**：🟢 低。

---

### 6.13 最终验收清单

深色 / 浅色主题各走一遍，**逐项打勾**：

**结构类**
- [ ] 侧栏分隔线正常显示（Step 3 修复项）
- [ ] 弹窗/右键菜单/右侧面板边框正常显示（Step 4 修复项）
- [ ] 无元素错位/塌陷/溢出
- [ ] 窗口缩放（>800px / <800px / <600px 三档）布局正常
- [ ] 终端 xterm 渲染区域未被影响
- [ ] 快捷键条 / 远端监控条（新功能）显示正常

**主题类**
- [ ] 内置 default（暗）正常
- [ ] 内置 defaultLight（浅）正常
- [ ] 切到 3 个 iTerm 主题（含至少 1 个浅色如 "3024 Day"）正常
- [ ] **打开一个主题点保存 → 不报 `Missing prop`**（派生方案的关键验证）
- [ ] 主题编辑器字段数量仍为 12 个 ui key（未被扩展）

**交互类**
- [ ] 标签：新增/切换/关闭/拖拽排序/右键菜单
- [ ] 侧栏：图标 hover/激活；书签、历史、传输三面板；折叠态
- [ ] 终端：普通/分屏/全屏/搜索/批量输入/快捷键条
- [ ] SFTP：行 hover/selected/地址栏历史/文件对比/传输队列
- [ ] 底栏：命令历史/快捷命令/批量输入浮层
- [ ] 右侧面板：AI 对话（含工具调用卡片）/终端信息/远端监控
- [ ] 设置：6 个 tab（含 800px 以下的移动端双视图 + 面包屑）
- [ ] 弹窗：新增书签表单/树选择/颜色选择器/信息弹窗
- [ ] 通用：message/notification/drawer/右键菜单
- [ ] RDP/VNC/SPICE 视图（含新外壳）

**无障碍类（Step 8）**
- [ ] 按 Tab 键能看到清晰的焦点环，顺序合理
- [ ] 鼠标点击**不**出现焦点环
- [ ] antd 控件无"双重焦点环"
- [ ] 开启"减少动画"后过渡基本停止
- [ ] 中文/日文界面字体一致

**回归类**
- [ ] `npm run lint` 通过
- [ ] `npm run test-unit-ci` **34 个 spec 全部通过**
- [ ] `npm run compile` 无新增告警
- [ ] `grep -c "color-mix" work/app/assets/css/style-5.5.26.css` > 0

---

## 七、测试策略

### 7.1 能力边界（5.5.26 实测）

| 测试层 | 规模 | 能否验证样式 | 可用性 |
| --- | --- | --- | --- |
| `src/test/unit-ci` | **30 spec / 450 test** | ❌（当前）→ ✅（Step 9 后 +4） | ✅ 全通过，秒级 |
| `src/test/e2e` | **54 spec** | ⚠️ 仅可见性 | 🟡 playwright 1.49.1，**可运行**（见 §7.4） |
| `src/test/integration` | 2 spec | ❌ | 需活体 MCP server，自 skip |

### 7.2 能自动化的 vs 不能自动化的

| 类型 | 能否自动化 | 手段 |
| --- | --- | --- |
| 变量引用/定义一致性 | ✅ | Step 9 单测 1 |
| 主题 key 契约 | ✅ | Step 9 单测 2 |
| 无硬编码颜色 | ✅ | Step 9 单测 3 |
| 圆角/阴影收敛 | ✅ | Step 9 单测 4 |
| CSS 编译无错误 | ✅ | `npm run compile` |
| `color-mix` 存活 | ✅ | grep 产物 |
| JS 逻辑无 lint 错误 | ✅ | `npm run lint` |
| **观感是否变好** | ❌ | **只能人眼判断** |
| **对比度是否改善** | ⚠️ 半自动 | 可扩展单测，但需维护期望值表 |
| **交互是否流畅** | ❌ | 人眼 |
| **键盘焦点顺序** | ❌ | 人工按 Tab |

**诚实结论**：本次改动的核心价值（观感）**无法自动化验证**，自动化测试守住的是"不引入回归"的下限。因此 §6.13 的手工验收清单不可省略。

### 7.3 新增单测设计（Step 9 详情）

已见 §6.10。补充实现注意：

- **单测 1 的边界**：需处理 `var(--x, fallback)` 形式（取逗号前的变量名）、`tokens.styl` 里嵌套引用，以及**上游自造变量白名单**（`--left-side-bar-width` 等 4 个 + `--ai-watermark` 由 jsx 注入）。
- **单测 2 的边界**：`@electerm/electerm-themes` 在 `node_modules` 里，若未安装应 `skip` 而非 fail（参考 `src/test/integration` 的自 skip 模式）。
- **单测 4 的边界**：允许 `border-radius` 值为 `var(--radius) var(--radius) 0 0`（多值）、`50%`/`100%`（圆形几何），以及 `.dnd-*` / `remote-monitor-bar` 的 `inset 0 2px 0 0 var(--primary)` 功能指示条。

### 7.4 e2e 现状（**已从警告改为可用**）

✅ **5.5.26 把 playwright 从 1.28.1 升到了 1.49.1，e2e 具备可运行条件**（v2 的"e2e 跑不起来"警告作废）。

**仍有的限制**：

1. 全仓**没有 `playwright.config`**，依赖 `work/app` 已构建产物 → 跑之前必须先 `npm run compile`。
2. CI 的 e2e（`mac-test-1/2/3.yml`）只跑 **macOS** + 特定分支，与本地 Linux 环境不一致。
3. e2e 全部用 **CSS 类选择器**定位 → 再次印证"不得改类名"的红线。

**建议用法**：作为 **Step 5 / Step 6 / Step 18 / Step 19 / Step 24 的抽查放行条件**（这几步观感或结构风险最高）：

```bash
npm run compile
npx playwright test src/test/e2e/005.5.split-view.spec.js --workers=1
```

**但仍不应作为唯一门禁**：观感类改动最终仍需人眼确认（§6.13）。

---

## 八、试色通道（零构建成本）

改源码前可用这两个通道验证观感，**不用 `npm run compile`**：

1. **设置 → 通用 → 自定义 CSS**（`setting-common.jsx` → `bg/custom-css.jsx:9-23`）：把 §2.3 的 token 和几条覆盖规则贴进去，**即时生效**。
   - ⚠️ 注意 `custom-css.jsx:16` 会把 `@import` 替换掉，只贴纯 CSS。
2. **主题编辑器**（`components/theme/`）：改 12 个颜色值，经 `ui-theme.jsx` 实时写入 `:root`。
   - 可快速试 `--primary` 换色后 `--active-bg`（派生自 primary）的效果。

> **用途**：Step 5（圆角/阴影收敛）观感风险最高，建议先用自定义 CSS 通道贴一版 `--shadow-*` / `--radius-*` 的值试手感，满意后再落源码。

---

## 九、风险登记册

| # | 风险 | 概率 | 影响 | 缓解措施 |
| --- | --- | --- | --- | --- |
| R1 | Step 5 圆角/阴影收敛后观感变差 | 中 | 中 | 单独 commit，可整体 revert；先在自定义 CSS 通道试色 |
| R2 | Step 6 移除 `motion: false` 后 antd 组件卡顿 | 低 | 中 | 改用 `motion: {motionDurationFast/Mid}` 缩短时长而非关闭 |
| R3 | iTerm 主题下新变量表现异常 | 低 | 低 | 派生方案已覆盖；用 3 个 iTerm 主题（含浅色）实测 |
| R4 | `color-mix` 在压缩产物中被改写 | 极低 | 高 | Step 1 强制 grep 产物验证；有降级方案 |
| R5 | `!important` 清理改变层叠导致样式失效 | 中 | 低 | 逐处目视；保留 19 处确实需要的（`term-fullscreen` 19 / `cmd-history` 1 / `qm` 1 等） |
| R6 | 间距 token 替换改变数值导致布局位移 | **中** | 中 | **已修正**：现有 padding 一律不改（§5.1）；新增描边一律用 `box-shadow inset`（§4.5） |
| R7 | 主题编辑器保存被破坏 | 极低 | 高 | **已由派生方案规避**（§2.5） |
| R8 | **Step 4 修复 `darker()` 后出现"新边框"被误认为本次引入** | 中 | 低 | 在 commit message 与本清单中标注；默认主题下对比度≈1.05，视觉极弱 |
| R9 | **新 token 误用了 `--main-darker` 作派生源** | 低 | 中 | §2.3 注释 + Step 9 单测 4 可扩展断言；Code Review 检查 |
| R10 | 全局 `:focus-visible` 与 antd 自带焦点态叠加 | 中 | 低 | §3.6 已给 `:not()` 排除方案；Step 8 必须目视 antd 控件 |
| R11 | 浅色主题下 9 处"主色实心"未全部整改到位 | 中 | 低 | §5.4 已列 6 处具体行号，按表逐处核对 |
| R12 | e2e 运行失败被误判为样式回归 | 低 | 低 | §7.4 明确"仅作抽查"，且 e2e 无样式断言 |
| R13 | 浅色主题既有缺陷（`--success` 1.61:1）被误认为本次引入 | 中 | 低 | §5.4 明确标注为**既有缺陷**，单独提 issue |

---

## 十、执行边界（红线）

以下行为**绝对禁止**，任何一条都会破坏 e2e、引入布局位移或造成不可控问题：

1. ❌ 重命名任何 CSS 类名
2. ❌ 增删/移动任何 DOM 节点
3. ❌ 修改 `36px` / `340px` / `280px` / `600px` / `43px` / `padding` 等布局骨架的**数值**
4. ❌ 给**已有尺寸的元素**新增 `border-*` 描边（content-box 下会外扩）。**一律改用**：
   - 内侧描边 → `box-shadow: inset 0 1px 0 0 var(--border)`（§4.5 `.main-footer`）
   - 外圈描边 → `box-shadow: 0 0 0 1px var(--border), var(--shadow-2)`（§4.10 `.context-menu`）
   - 侧边色条 → `box-shadow: inset 3px 0 0 0 <色>`（§4.9 message/notification、§4.4 SFTP）
5. ❌ 修改主题校验相关代码（`requiredThemeProps`、`validThemeProps`、`convertTheme*`）
6. ❌ 修改 `.is-mobile` 判断逻辑或 `mobileBreakpoint`
7. ❌ 修改 `css-overwrite.jsx`（终端背景图生成逻辑）
8. ❌ 修改 `bg/shapes.js`（马赛克背景生成）
9. ❌ 为 5 个零 styl 目录（`text-editor`/`widgets`/`shortcuts`/`batch-op`/`bg`）新建 `.styl`
10. ❌ 在 `tokens.styl` 重复定义或**引用** `--main-darker` / `--main-lighter`
11. ❌ 自造 `--h-bar` / `--w-sidebar` / `--focus-ring`（v3 已撤销）
12. ❌ 把上游自造变量（`--footer-stack-height` / `--left-side-bar-width` / `--shortcut-bar-h*`）推广到上游之外的位置
13. ❌ 把新 token 加进 `requiredThemeProps`