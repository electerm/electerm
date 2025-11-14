<h1 align="center" style="padding-top: 60px;padding-bottom: 40px;">
    <a href="https://electerm.github.io/electerm">
        <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.png", alt="" />
    </a>
</h1>

[English](README.md)

# electerm [![Tweet](https://badgers.space/badge/Tweet/Tweet/social)](https://twitter.com/intent/tweet?text=Open%20sourced%20terminal%2Fssh%2Fsftp%20client(linux%2C%20mac%2C%20win)&url=https%3A%2F%2Fgithub.com%2Felecterm%2Felecterm&hashtags=electerm,ssh,terminal,sftp)

[![GitHub version](https://img.shields.io/github/v/release/electerm/electerm)](https://github.com/electerm/electerm/releases)
[![Build Status](https://github.com/electerm/electerm/actions/workflows/mac-test-1.yml/badge.svg)](https://github.com/electerm/electerm/actions)
[![license](https://img.shields.io/github/license/electerm/electerm)](https://github.com/electerm/electerm/blob/master/LICENSE)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Get it from the Snap Store](https://img.shields.io/badge/Snap-Store-green)](https://snapcraft.io/electerm)
[![Get it from the Microsoft Store](https://img.shields.io/badge/Microsoft-Store-blue)](https://www.microsoft.com/store/apps/9NCN7272GTFF)
[![Debian Repository](https://img.shields.io/badge/Debian-Repository-red)](https://electerm-repos.html5beta.com/deb)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/electerm?label=Sponsors)](https://github.com/sponsors/electerm)

[![DigitalOcean Referral Badge](https://web-platforms.sfo2.cdn.digitaloceanspaces.com/WWW/Badge%202.svg)](https://www.digitalocean.com/?refcode=c10bcb28b846&utm_campaign=Referral_Invite&utm_medium=Referral_Program&utm_source=badge)

[![Vercel OSS Program](https://vercel.com/oss/program-badge.svg)](https://vercel.com/oss)

开源终端/ssh/telnet/serialport/RDP/VNC/sftp/ftp客户端(linux, mac, win)。

Powered by [manate](https://github.com/tylerlong/manate)

有经验的开发者也可以尝试运行于浏览器(支持移动设备)的web app版本: [electerm-web](https://github.com/electerm/electerm-web) 或者 [docker image for electerm-web](https://github.com/electerm/electerm-web-docker)

在线演示: [https://electerm-demo.html5beta.com](https://electerm-demo.html5beta.com)

<div align="center">
  <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.gif", alt="" />
</div>

## 功能特性

- 支持ssh,telnet,serialport,RDP,VNC,本地和远程文件管理，sftp/ftp文件传输，以及作为本地终端使用
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
- 支持同步书签等数据到github/gitee私人gist
- 支持快速输入命令到一个或者多个终端
- AI助手集成（支持[DeepSeek](https://www.deepseek.com)、OpenAI等AI API），协助命令建议、脚本编写、以及解释所选终端内容
- 支持命令行使用: 请参阅[wiki](https://github.com/electerm/electerm/wiki/Command-line-usage)
- 深度链接支持: 请参阅[wiki](https://github.com/electerm/electerm/wiki/Deep-link-support)

## 下载

- [主页](https://electerm.html5beta.com)
- [sourceforge](https://sourceforge.net/projects/electerm.mirror/files/)
- [github releases](https://github.com/electerm/electerm/releases)

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

查看 [https://electerm-repos.html5beta.com/deb](https://electerm-repos.html5beta.com/deb)

- 从npm安装

```bash
npm i -g electerm

# after installation, it will immediately open for windows and linux,
# for macOS, it will open the drag to install panel

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

[Discussion board](https://github.com/electerm/electerm/discussions)

![electerm-wechat-group-qr.jpg](https://electerm.html5beta.com/electerm-wechat-group-qr.jpg)

## 支持

欢迎[提交问题/建议](https://github.com/electerm/electerm/issues), [展开讨论](https://github.com/electerm/electerm/discussions/new), [修复或者创建语言文件](https://github.com/electerm/electerm-locales)或者贡献代码。

## 赞助项目

github sponsor

[https://github.com/sponsors/electerm](https://github.com/sponsors/electerm)

kofi

[https://ko-fi.com/zhaoxudong](https://ko-fi.com/zhaoxudong)

微信赞赏码

[![wechat donate](https://electerm.html5beta.com/electerm-wechat-donate.png)](https://github.com/electerm)

## 开发

```bash
# tested in ubuntu20.04+/mac os 10.13+ only
# needs nodejs/npm, suggest using fnm to install nodejs/npm
# with nodejs 22.x

git clone git@github.com:electerm/electerm.git
cd electerm
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
# Tested only in ubuntu 20.04+ x64
# Install yarn first(to do yarn autoclean)
# See https://yarnpkg.com/en/docs/install

# Build linux only with -l
npm i
npm run b
./node_modules/.bin/electron-builder --linux tar.gz
# or replace tar.gz to rpm/deb/AppImage
# check dist/ folder

# build for linux arm/
./node_modules/.bin/electron-builder --linux --arm64
```

## 使用视频

- [bilibili](https://space.bilibili.com/14001525/channel/series?sid=5461229&spm_id_from=333.788.0.0)


## 变更历史

Visit [Releases](https://github.com/electerm/electerm/releases).

## 许可证

MIT

## 收藏历史

[![Star History Chart](https://api.star-history.com/svg?repos=electerm/electerm&type=Date)](https://www.star-history.com/#electerm/electerm&Date)