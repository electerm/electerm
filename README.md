<h1 align="center" style="padding-top: 60px;padding-bottom: 40px;">
    <a href="https://electerm.html5beta.com">
        <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.png", alt="" />
    </a>
</h1>

[中文](README_cn.md)

# electerm [![Tweet](https://img.shields.io/twitter/url/http/shields.io.svg?style=social)](https://twitter.com/intent/tweet?text=Open%20sourced%20terminal%2Fssh%2Fsftp%20client(linux%2C%20mac%2C%20win)&url=https%3A%2F%2Fgithub.com%2Felecterm%2Felecterm&hashtags=electerm,ssh,terminal,sftp)

[![GitHub version](https://img.shields.io/github/release/electerm/electerm/all.svg)](https://github.com/electerm/electerm/releases)
[![Build Status](https://github.com/electerm/electerm/actions/workflows/mac-test-1.yml/badge.svg)](https://github.com/electerm/electerm/actions)
[![license](https://img.shields.io/github/license/electerm/electerm.svg)](https://github.com/electerm/electerm/blob/master/LICENSE)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Get it from the Snap Store](https://img.shields.io/badge/Snap-Store-green)](https://snapcraft.io/electerm)
[![Get it from the Microsoft Store](https://img.shields.io/badge/Microsoft-Store-blue)](https://www.microsoft.com/store/apps/9NCN7272GTFF)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/electerm?label=Sponsors)](https://github.com/sponsors/electerm)

Open-sourced terminal/ssh/telnet/serialport/RDP/VNC/sftp client(linux, mac, win).

Powered by [manate](https://github.com/tylerlong/manate)

For experienced developers, you may try the web app version running in browser(including mobile device): [electerm-web](https://github.com/electerm/electerm-web) or [docker image for electerm-web](https://github.com/electerm/electerm-web-docker)

Online demo: [https://electerm-demo.html5beta.com](https://electerm-demo.html5beta.com)

<div align="center">
  <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.gif", alt="" />
</div>

## Features

- Works as a terminal/file manager or ssh/telnet/serialport/RDP/VNC/sftp client
- Global hotkey to toggle window visibility (similar to guake, default is `ctrl + 2`)
- Multi platform(linux, mac, win)
- 🇺🇸 🇨🇳 🇧🇷 🇷🇺 🇪🇸 🇫🇷 🇹🇷 🇭🇰 🇯🇵 🇸🇦 🇩🇪 🇰🇷 Multi-language support([electerm-locales](https://github.com/electerm/electerm-locales), contributions/fixes welcome)
- Double click to directly edit (small) remote files.
- Auth with publicKey + password.
- Support Zmodem(rz, sz).
- Support ssh tunnel.
- Support [Trzsz](https://github.com/trzsz/trzsz)(trz/tsz), similar to rz/sz, and compatible with tmux.
- Transparent window(Mac, win).
- Terminal background image.
- Global/session proxy.
- Quick commands
- UI/terminal theme
- Sync bookmarks/themes/quick commands to github/gitee secret gist
- Quick input to one or all terminals.
- AI assistant integration (supporting [DeepSeek](https://www.deepseek.com), OpenAI, and other AI APIs) to help with command suggestions, script writing, and explaining selected terminal content
- Command line usage: check [wiki](https://github.com/electerm/electerm/wiki/Command-line-usage)
- Deep link support: check [wiki](https://github.com/electerm/electerm/wiki/Deep-link-support)

## Download

- [Homepage](https://electerm.html5beta.com)
- [sourceforge](https://sourceforge.net/projects/electerm.mirror/files/)
- [github releases](https://github.com/electerm/electerm/releases)

## Install

- For Mac user: `brew install --cask electerm`
- With snap: `sudo snap install electerm --classic`
- For some Linux distribution, you can find it from OS default App store(Ubuntu, Deepin, Mint...).
- For some linux OS, the `rpm`, `deb`, or `snap` release may not work, you can try the `tar.gz` release.
- For Windows users, you can install it from [windows store](https://www.microsoft.com/store/apps/9NCN7272GTFF), command-line installer [winget](https://github.com/microsoft/winget-cli) and [scoop](https://github.com/lukesampson/scoop) is also recommended:

```powershell
# winget https://github.com/microsoft/winget-cli
winget install electerm

# scoop https://github.com/lukesampson/scoop
scoop bucket add dorado https://github.com/chawyehsu/dorado
scoop install dorado/electerm
```

- Install from npm

```bash
npm i -g electerm

# After installation, it will immediately open for windows and linux,
# For macOS, it will open the drag to install panel

```

## Upgrade

- Auto upgrade: When a new version is released, you will get an upgrade notification after you start electerm again. You can then click the upgrade button to upgrade.
- Download: Just download the latest edition, reinstall.
- Npm: If you install from npm, just run `npm i -g electerm` again.
- If use Snap or some other distribution system, these systems may provide upgrades.

## Themes

- https://github.com/mbadolato/iTerm2-Color-Schemes/tree/master/electerm
- https://github.com/Hope-IT-Works/electerm-theme-termius

## Known issues

[https://github.com/electerm/electerm/wiki/Know-issues](https://github.com/electerm/electerm/wiki/Know-issues)

## Troubleshoot

[https://github.com/electerm/electerm/wiki/Troubleshoot](https://github.com/electerm/electerm/wiki/Troubleshoot)

## Discussion

[Discussion board](https://github.com/electerm/electerm/discussions)

![electerm-wechat-group-qr.jpg](https://electerm.html5beta.com/electerm-wechat-group-qr.jpg)

## Support

Would love to hear from you, please tell me what you think, [submit an issue](https://github.com/electerm/electerm/issues), [Start a new discussion](https://github.com/electerm/electerm/discussions/new), [create/fix language files](https://github.com/electerm/electerm-locales) or create pull requests, all welcome.

## Sponsor this project

github sponsor

[https://github.com/sponsors/electerm](https://github.com/sponsors/electerm)

kofi

[https://ko-fi.com/zhaoxudong](https://ko-fi.com/zhaoxudong)

wechat donate

[![wechat donate](https://electerm.html5beta.com/electerm-wechat-donate.png)](https://github.com/electerm)

## Dev

```bash
# tested in ubuntu16.04+/mac os 10.13+ only
# needs nodejs/npm, suggest using nvm to install nodejs/npm
# https://github.com/creationix/nvm
# with nodejs 18.x

git clone git@github.com:electerm/electerm.git
cd electerm
npm i

# start webpack dev server, requires port 5570
npm start

# in a separate terminal session run app
npm run app

# code format check
npm run lint

# code format fix
npm run fix
```

## Test

```bash
npm run prepare-build
npm run prepare-test
cp .sample.env .env

# edit .env, fill your test host/username/password, may only works in mac OS
npm run test
```

## Test build

```bash
# Tested only in ubuntu 16.04 x64+
# Install yarn first(to do yarn autoclean)
# See https://yarnpkg.com/en/docs/install

# Build linux only with -l
npm i
npm run prepare-build
./node_modules/.bin/electron-builder --linux tar.gz
# or replace tar.gz to rpm/deb/AppImage
# check dist/ folder

# build for linux arm/
./node_modules/.bin/electron-builder --linux --arm64
```

## Use

- [Set autorun when login to os](https://github.com/electerm/electerm/wiki/Autorun-electerm-when-login-to-os)

## Change log

Visit [Releases](https://github.com/electerm/electerm/releases).

## License

MIT
