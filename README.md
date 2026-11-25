# Electerm Terminal

面向 Apple Silicon Mac 的便携 SSH 终端。在同一个窗口中使用本地 shell、连接远程服务器、浏览 SFTP 文件和查看 Linux 主机状态。界面使用 SwiftUI 和 AppKit，终端使用 SwiftTerm，SSH 使用系统 OpenSSH；不依赖 Electron。

**运行要求：**macOS 14 或更高版本，Apple Silicon（M 系列芯片）。使用成品无需安装 Xcode 或其他开发工具。

## 安装

1. 登录 GitHub，打开 [main 分支的 macOS 构建](https://github.com/Jeeeshy/electerm/actions/workflows/native-mac.yml?query=branch%3Amain)，选择一次成功的运行。在 **Artifacts** 下下载 `Electerm-Terminal-mac-arm64`。
2. 解压下载的文件。如果里面还有 `Electerm-Terminal-mac-arm64.zip`，再解压一次，即可看到 **Electerm Terminal** 文件夹。
3. 把**整个文件夹**移到个人应用程序目录 `~/Applications/`，或保留在其他自己可写的位置。双击其中的 `Electerm Terminal.app` 即可启动。

直接双击与放进「应用程序」运行的是同一个程序。此版本使用本地 ad-hoc 签名，未经 Apple 公证。如果 macOS 阻止首次打开，请先核对下载来源；确认后可在「系统设置 → 隐私与安全性」中允许这一次打开。

### 更新、迁移与备份

**更新时只替换应用，搬家时移动整个文件夹。** 先退出程序，再把新版 `Electerm Terminal.app` 放入原文件夹，保留旁边的 `Electerm Data/`。只移动 `.app` 会让程序在新位置查找数据，原书签不会自动跟过去。首次使用不会导入旧版 Electron 或旧原生版的数据。

```text
Electerm Terminal/
├── Electerm Terminal.app
├── 使用与清理.md
└── Electerm Data/           # 运行时创建，不随下载包分发
    ├── settings.plist       # 书签与界面设置
    ├── known_hosts          # 接受过的 SSH 主机密钥
    ├── passwords.v1         # 选择保存密码时使用的加密库
    └── Temp/                # SSH 套接字与 Finder 拖出暂存
```

备份前退出程序，复制 `Electerm Data/` 即可保留应用数据；`Temp/` 无须备份。自选 SSH 私钥仍在原路径，需要单独保管。密码库使用 PBKDF2-SHA256 和 AES-GCM，主密码不落盘，忘记后无法恢复。

### 卸载与清理

- **卸载程序和数据：**退出应用，删除整个 `Electerm Terminal/` 文件夹。只删除 `.app` 会保留书签和密码库。无需卸载服务。
- **只清临时文件：**退出后清空 `Electerm Data/Temp/`。SFTP 下载会在所选目标旁暂存，取消或失败时清理；如果传输中退出或断电，只删除确认属于该次下载的隐藏项 `.electerm-<UUID>`。
- **可选的 macOS 清理：**系统可能单独记住窗口或文件面板偏好。退出后可运行 `defaults delete local.electerm.terminal.portable`；提示域不存在即无须清理。如存在，还可移除 `~/Library/Caches/local.electerm.terminal.portable` 和 `~/Library/Saved Application State/local.electerm.terminal.portable.savedState`。
- 下载的文件、自己的 SSH 配置、私钥和 shell 历史不会随卸载删除。不要为卸载本程序删除 `~/.ssh`。如果曾使用旧原生版，其偏好域 `local.electerm.terminal.native` 和钥匙串服务 `local.electerm.terminal.native.ssh` 独立于本版，仅在确认不再需要时自行清理。

## 功能

| 功能 | 使用方式 |
| --- | --- |
| 本地终端与 SSH | 支持系统 shell、SSH 配置别名、`user@host:port` 和 `ssh://user@host:port`。书签可指定私钥、跳板机并选择保存登录密码。断开后按 `R` 在原标签重连。 |
| 标签与分屏 | 左右拖动标签调整顺序。点「分屏」选择 1–4 个已打开的标签，每个窗格有独立标签栏；点「取消分屏」回到单窗格，已有连接保留。可向多个终端广播输入。 |
| 外观与终端设置 | 深色、浅色、跟随系统三种主题同步作用于标题栏、侧栏和终端。字体、字号、光标、换行和历史缓冲可即时调整。SSH 保活、连接超时和远程 shell 探测从下次连接起生效。 |
| SFTP 文件管理 | 侧栏可拖宽。单击选中，双击文件夹进入；支持路径输入、显示隐藏文件、新建文件或目录、重命名、删除文件或空目录，以及按需显示大小和修改日期。 |
| 服务器状态 | 监控默认关闭。开启后显示活动 SSH 主机的 CPU 占用和内存；展开详情可查看磁盘用量、当前登录用户及各自会话数、运行时间。容量自动按 KiB、MiB、GiB 换算。详细指标面向 Linux，受服务器工具和权限限制。 |

### SFTP 上传、下载与目录跟随

- **上传与下载：**用侧栏的托盘向上箭头上传文件，用托盘向下箭头下载选中的文件或文件夹，也可右键下载。Finder 拖入、拖出支持单个普通文件。传输卡显示当前文件、进度、速度，以及完成或失败原因；支持取消。
- **下载文件夹：**选中远程目录后点下载，再选择本地父目录。按目录顺序传输，保留隐藏文件和空目录，显示当前文件进度和累计字节数，不预扫整棵目录树。符号链接和特殊文件会跳过并报告数量；不会合并或覆盖本地同名目录。
- **同名与中断：**上传拒绝覆盖远程同名文件；上传中断时远端可能留有不完整文件。单文件下载成功后才替换已确认的目标。
- **跟随终端目录：**启用「SFTP 跟随终端目录」后，可通过 shell 的 OSC 7/633 通知或 Linux 的 `/proc` 探测同步目录。SFTP 浏览和传输复用现有 SSH 认证；也可关闭跟随，独立浏览目录。

## 从源码构建

需要 Apple Silicon Mac、Git 和带 Swift 6.2 或更高版本的 Apple 工具链。首次构建需要联网获取依赖。

```sh
git clone --branch main https://github.com/Jeeeshy/electerm.git
cd electerm
sh build-mac.sh
```

脚本校验 SwiftTerm 的固定提交并应用仓库内的补丁，运行测试，生成 ARM64 Release 应用，检查架构与签名，再从成品运行终端引擎自检。输出文件为 `dist/Electerm-Terminal-mac-arm64.zip`。本地调试可先执行 `sh prepare-swiftterm.sh`，再执行 `swift run`。项目内的依赖副本、模块缓存和编译中间产物集中在 `.build/`，构建结束后可删除。

## 许可证

本项目采用 [MIT 许可证](LICENSE)。终端组件 [SwiftTerm](https://github.com/migueldeicaza/SwiftTerm) 的[许可证](Integration/LICENSE-SwiftTerm)随应用一并分发。
