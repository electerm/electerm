# Electerm Terminal · Mac 原生版

本 fork 只维护 SwiftUI、AppKit 和 SwiftTerm 的 Mac 原生版，面向 macOS 14 及以上的 Apple Silicon（含 M5）。
不依赖 Electron，也不读取旧版 `.runtime`、书签数据库或界面设置。

## 在 Mac 构建

下载 GitHub Actions 的 `Electerm-Terminal-mac-arm64` 成品无需安装开发工具。
自行构建需要 Swift 6.2 或更新的 Apple 工具链和 Git，在仓库根目录执行：

```sh
sh build-mac.sh
```

脚本先运行 XCTest，再生成 ARM64 release、检查架构、对 `.app` 做本地 ad-hoc 签名，
从成品启动内置终端引擎自检，最后输出 `dist/Electerm-Terminal-mac-arm64.zip`。
解压后打开 `Electerm Terminal.app`。本机调试先执行 `sh prepare-swiftterm.sh`，再用 `swift run` 或 Xcode 打开 `Package.swift`。
首次构建需要联网。依赖源码和脚本指定的 SwiftPM 缓存位于项目的 `.build/`；系统工具链及其系统缓存不在其中。
不使用 CocoaPods、Homebrew、npm 或 Windows 工程。ad-hoc 签名不是 Apple 公证。

## 页面与终端

- 顶部 36 pt 工具栏；左栏顶部快速连接，右侧终端顶部 28 pt 标签行；28 pt 图标栏，24 pt 状态栏。
- 本地默认显示书签，单击选中、双击连接；SSH 默认显示 SFTP，支持收起、拖宽、路径输入、上传和下载。
  侧栏宽度跨标签记忆。支持单个普通文件的 Finder 拖入/拖出；上传同名文件会拒绝覆盖。
- 13 pt 等宽字、R7 的 16 色、普通文本关键词着色与深浅色窗口。终端色不随窗口主题切换。
  终端保留 3000 行滚动缓冲；会话结束后在终端按 `r` / `R` 在原标签重连，不恢复旧进程。
- SSH 使用系统 OpenSSH；快速连接支持 `user@host:port`、`ssh://user@host:port` 和 SSH 配置别名。
  私钥、跳板和认证代理使用系统 SSH 配置；不在书签中存密码。
- SFTP 与 shell 复用同一个认证通道。目录跟随识别 OSC 7/633；对于没有提示符集成的普通 Linux shell，
  启动时记录登录 shell PID，在输入命令后通过 SFTP 解析 `/proc/<pid>/cwd`。不猜提示符，不改远程配置文件。
  不支持 `/proc` 且没有 OSC 的主机可手动浏览。受限 SSH 设备或配置了 `RemoteCommand` 的主机，
  可以在设置里关闭“探测远程 shell 目录”再连接，保留其原始登录方式。
- 左栏书签与文件图标可切换或收起，单击目录进入，双击普通文件下载。开启跟随会切回远程文件栏。
  目录浏览和 `/proc` 探测复用一个 SFTP 子系统，传输不占用浏览通道。
- 设置按终端、SSH 与文件、远程监控分组，支持历史行数、默认换行、默认跟随、隐藏文件和采样间隔。
- 监控默认关闭，开启后采样 CPU 和内存，详情按钮按需读取系统、负载、交换区、根盘、接口流量累计、登录用户与进程。
  详细指标针对 Linux，缺少相应工具或权限时并非每项都有数据。

## 实现与验收

SwiftUI 绘制窗口和工具栏；每个标签拥有一个 SwiftTerm AppKit 视图，使用 Core Graphics 绘制。
终端输入、解析、搜索和滚动缓冲不经过 JavaScriptCore、WebView 或 Electron。PTY 和 SSH 仍用原系统实现。
`prepare-swiftterm.sh` 检出官方 SwiftTerm `v1.99.3` 并校验提交，`Integration/` 的小补丁只用于 Mac：
给普通文字绘制关键词颜色、识别目录、处理断线并限制非文本协议。补丁不改磁盘上的全局 SwiftPM 包。
OSC 剪贴板读写、链接、通知及内联图片不启用；Cmd+C / Cmd+V 仍是用户操作。
第三方许可证随 `.app` 分发，构建工具的间接包固定于 `Package.resolved`。

`swift test` 覆盖原生终端、分包目录通知、断线历史、关闭释放、真实 PTY、SSH 地址和本机 OpenSSH SFTP 文件往返。
独立仓库内附 macOS CI 工作流，但仅在配置了托管运行器并实际运行时才有结果。

**验收边界：** 这是原生第一版，不是旧 Mac ZIP 的换壳或已验收的完整替代品。
尚无 M5 实机截图、输入法/VoiceOver、Finder 拖放、高吞吐滚屏、长连接、睡眠恢复、启动或内存测试结果。
原生控件与 R7 不保证逐像素相同。当前不迁移旧书签库，不包含完整 R7 设置、ZMODEM/trzsz 或高级多窗格布局。
切换日常使用前应在 Mac 逐项对照本地 shell、真实 SSH 服务器、文件往返和断线重连后的历史记录。
