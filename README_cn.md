<h1 align="center" style="padding-top: 60px;padding-bottom: 40px;">
    <a href="https://electerm.org">
        <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.png", alt="" />
    </a>
</h1>

[![GitHub version](https://badgers.space/github/release/electerm/electerm?corner_radius=m)](https://github.com/electerm/electerm/releases)
[![Build Status](https://github.com/electerm/electerm/actions/workflows/mac-test-1.yml/badge.svg)](https://github.com/electerm/electerm/actions)
[![license](https://img.shields.io/github/license/electerm/electerm)](https://github.com/electerm/electerm/blob/master/LICENSE)
[![Get it from the Snap Store](https://img.shields.io/badge/Snap-Store-green)](https://snapcraft.io/electerm)
[![Get it from the Microsoft Store](https://img.shields.io/badge/Microsoft-Store-blue)](https://www.microsoft.com/store/apps/9NCN7272GTFF)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/electerm?label=Sponsors)](https://github.com/sponsors/electerm)
[![star](https://atomgit.com/electerm/electerm/star/badge.svg)](https://atomgit.com/electerm/electerm)

[![English](https://img.shields.io/badge/English-EN-blue)](README.md) [![中文](https://img.shields.io/badge/中文-Chinese-blue)](README_cn.md)


开源终端/ssh/telnet/serialport/RDP/VNC/Spice/sftp/ftp客户端(linux, mac, win)。

- [electerm.org](https://electerm.org): 主页，下载，视频等
- [electerm-web](https://github.com/electerm/electerm-web): 运行于浏览器(支持移动设备)的web app版本
- [electerm-web-docker](https://github.com/electerm/electerm-web-docker): electerm-web的docker镜像
- [electerm online](https://cloud.electerm.org): 公共免费在线electerm应用
- [electerm demo](https://demo.electerm.org): 在线演示
- [electerm deb repo](https://repos.electerm.org/deb): Debian repo of electerm
- [electerm rpm repo](https://repos.electerm.org/rpm): RPM repo of electerm

## Atlas Cloud

<div align="center">
  <a href="https://www.atlascloud.ai/?utm_source=github&utm_medium=link&utm_campaign=electerm">
    <img src="https://github.com/electerm/electerm-resource/blob/master/static/images/atlas-cloud.png?raw=true" alt="Atlas Cloud" width="200" />
  </a>
</div>

[Atlas Cloud](https://www.atlascloud.ai/?utm_source=github&utm_medium=link&utm_campaign=electerm) 提供与 OpenAI 兼容的 AI API 和模型访问，用于在 electerm 中实现 AI 驱动的工作流程。

[![DigitalOcean Referral Badge](https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%202.svg)](https://www.digitalocean.com/?refcode=c10bcb28b846&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge)

[![Vercel OSS Program](https://github.com/electerm/electerm-resource/blob/master/static/images/vercel-oss-2005.png?raw=true)](https://oss-directory.vercel.app)

<div align="center">
  <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.gif", alt="" />
</div>

## 功能特性

- 支持ssh,telnet,serialport,RDP,VNC,Spice,本地和远程文件管理，sftp/ftp文件传输，以及作为本地终端使用
- 支持Window 7+(X64/ARM64), Mac OS 10.15+(x64/arm64), Linux(x64/arm64/Loong64), 以及Linux with glibc 2.17+ like UOS/Kylin/Ubuntu 18.04 etc
- 全局快捷键切换隐藏显示窗口(类似guake, 默认快捷键`ctrl + 2`)
- 多平台支持(linux, mac, win)
- 🇺🇸 🇨🇳 🇧🇷 🇷🇺 🇪🇸 🇫🇷 🇹🇷 🇭🇰 🇯🇵 🇸🇦 🇩🇪 🇰🇷 🇮🇩 🇵🇱 多国语言支持([electerm-locales](https://github.com/electerm/electerm-locales), 欢迎提交代码)
- 双击直接编辑远程文件.
- 支持密码或者密匙登录.
- 支持Zmodem(rz, sz).
- 支持ssh隧道
- 支持[Trzsz](https://github.com/trzsz/trzsz)(trz/tsz), 类似rz/sz, 兼容tmux.
- 支持透明窗口(Mac, win).
- 支持设置终端背景图片.
- 支持代理服务器.
- 支持预设快捷命令
- 支持主题
- 支持同步书签等数据到github/gitee私人gist, webdav/custom server/electerm cloud
- 支持快速输入命令到一个或者多个终端
- AI助手集成（支持[DeepSeek](https://www.deepseek.com)、OpenAI等AI API），协助命令建议、脚本编写、以及解释所选终端内容, 创建书签
- MCP (Model Context Protocol) 组件，用于AI助手和外部工具集成 - 详见 [MCP Widget Usage Guide](https://github.com/electerm/electerm/wiki/MCP-Widget-Usage-Guide)
- 支持命令行使用: 请参阅[wiki](https://github.com/electerm/electerm/wiki/Command-line-usage)
- 深度链接支持: 使用 `telnet://192.168.2.31:34554` 或 `ssh://user@host:22` 等URL打开连接 - 详见 [深度链接支持 wiki](https://github.com/electerm/electerm/wiki/Deep-link-support)


## 安装

- Mac OS用户: `brew install --cask electerm`
- Snap: `sudo snap install electerm --classic`
- 一些Linux发行版的内置软件商店(Ubuntu, Deepin, Mint...).
- 不支持`rpm`, `deb`, or `snap` 的Linux发行版可以尝试 `tar.gz`版本.
- Windows用户可以从[windows store](https://www.microsoft.com/store/apps/9NCN7272GTFF), 命令行安装工具 [winget](https://github.com/microsoft/winget-cli)，以及[scoop](https://github.com/lukesampson/scoop) :

```powershell
# winget https://github.com/microsoft/winget-cli
winget install electerm.electerm

# scoop https://github.com/lukesampson/scoop
scoop bucket add dorado https://github.com/chawyehsu/dorado
scoop install dorado/electerm
```

- 从Debian软件源安装 (适用于Debian/Ubuntu系统) 使用 `apt` 命令

查看 [https://repos.electerm.org/deb](https://repos.electerm.org/deb)

- 从npm安装

```bash
npm i -g electerm
```

## 升级

- 自动升级: 点击新版本的升级按钮.
- 下载: 重新下载最新版安装.
- Npm: 如果是从npm安装 再次运行`npm i -g electerm` 即可.
- 如果从Linux发行版软件商店或者Snap安装，可能有自动升级机制.

## 已知问题

[https://github.com/electerm/electerm/wiki/Know-issues](https://github.com/electerm/electerm/wiki/Know-issues)

## 疑难解答

[https://github.com/electerm/electerm/wiki/Troubleshoot](https://github.com/electerm/electerm/wiki/Troubleshoot)

## 讨论区

[![Discord](https://img.shields.io/badge/Discord-Join-blue?logo=discord)](https://discord.gg/855W7g8EVd)

[Discussion board](https://github.com/electerm/electerm/discussions)

![electerm-wechat-group-qr.jpg](https://electerm.org/electerm-wechat-group-qr.jpg)

## 支持

欢迎[提交问题/建议](https://github.com/electerm/electerm/issues), [展开讨论](https://github.com/electerm/electerm/discussions/new), [修复或者创建语言文件](https://github.com/electerm/electerm-locales)或者贡献代码。

## 赞助项目

github sponsor

[https://github.com/sponsors/electerm](https://github.com/sponsors/electerm)

kofi

[https://ko-fi.com/zhaoxudong](https://ko-fi.com/zhaoxudong)

微信赞赏码

[![wechat donate](https://electerm.org/electerm-wechat-donate.png)](https://github.com/electerm)

TRON TRN20

[![TRN20 donate](https://github.com/electerm/electerm-resource/blob/master/static/images/trn20.png?raw=true)]

地址: TXk3pQNmQu1vihH76RaEFnK9wg13x4LLCZ

## 开发

```bash
# May only works in Linux
# needs nodejs/npm, suggest using nvm to install nodejs/npm
# with nodejs 24.x

git clone git@github.com:electerm/electerm.git
cd electerm
npm config set legacy-peer-deps true
npm i

# start vite dev server, requires port 5570
npm start

# in a separate terminal session run app
npm run app

# code format check
npm run lint

# code format fix
npm run fix
```

## 测试

```bash
npm run b
npm run prepare-test
cp .sample.env .env

# edit .env, fill your test host/username/password, may only works in mac OS
npm run test
```

## 测试构建

```bash
# May only works in Linux
# Install yarn first(to do yarn autoclean)
# See https://yarnpkg.com/en/docs/install

# Build linux only with -l
npm i
npm run b
npm run pb
./node_modules/.bin/electron-builder --linux tar.gz
# or replace tar.gz to rpm/deb/AppImage
# check dist/ folder

# build for linux arm/
./node_modules/.bin/electron-builder --linux --arm64
```

## 使用视频

- [https://electerm.org/videos](https://electerm.org/videos)

## 变更历史

Visit [Releases](https://github.com/electerm/electerm/releases).

## 联系作者

[zxdong@gmail.com](mailto:zxdong@gmail.com)

## 许可证

MIT

## 收藏历史

<p>
 <a href="https://www.star-history.com/electerm/electerm"><img src="https://api.star-history.com/badge?repo=electerm/electerm" alt="Star History Rank" /></a>
</p>

<a href="https://www.star-history.com/?repos=electerm%2Felecterm&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=electerm/electerm&type=date&legend=top-left&sealed_token=DvPlttPaLtq6RPIWRANYX08-8ZJyrJalhombrkDcg1IwWOMPMIplgi85q0FiwrbhE3lRIi_yxvOWdell731CGQvzlfJMt2Sa6VfCvQ80BwEtQ6RpPchEiw" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=electerm/electerm&type=date&legend=top-left&sealed_token=DvPlttPaLtq6RPIWRANYX08-8ZJyrJalhombrkDcg1IwWOMPMIplgi85q0FiwrbhE3lRIi_yxvOWdell731CGQvzlfJMt2Sa6VfCvQ80BwEtQ6RpPchEiw" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=electerm/electerm&type=date&legend=top-left&sealed_token=DvPlttPaLtq6RPIWRANYX08-8ZJyrJalhombrkDcg1IwWOMPMIplgi85q0FiwrbhE3lRIi_yxvOWdell731CGQvzlfJMt2Sa6VfCvQ80BwEtQ6RpPchEiw" />
 </picture>
</a>
