<h1 align="center">
    <a href="https://electerm.github.io/electerm">
        <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.png", alt="" />
    </a>
</h1>

# electerm [![Tweet](https://img.shields.io/twitter/url/http/shields.io.svg?style=social)](https://twitter.com/intent/tweet?text=Open%20sourced%20terminal%2Fssh%2Fsftp%20client(linux%2C%20mac%2C%20win)&url=https%3A%2F%2Fgithub.com%2Felecterm%2Felecterm&hashtags=electerm,ssh,terminal,sftp)

[![GitHub version](https://img.shields.io/github/release/electerm/electerm/all.svg)](https://github.com/electerm/electerm/releases)
[![GitHub Actions](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fatrox%2Fsync-dotenv%2Fbadge)](https://github.com/electerm/electerm/actions)
[![license](https://img.shields.io/github/license/electerm/electerm.svg)](https://github.com/electerm/electerm/blob/master/LICENSE)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Get it from the Snap Store](https://img.shields.io/badge/Snap-Store-green)](https://snapcraft.io/electerm)
[![Get it from the Microsoft Store](https://img.shields.io/badge/Microsoft-Store-blue)](https://www.microsoft.com/store/apps/9NCN7272GTFF)


Terminal/ssh/sftp client(linux, mac, win) based on electron/ssh2/node-pty/xterm/antd/[subx](https://github.com/tylerlong/subx) and other libs.

<div align="center">
  <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.gif", alt="" />
</div>

## Features

- Works as a terminal/file manager or ssh/sftp client(similar to xshell)
- Global hotkey to toggle window visibility (similar to guake, default is `ctrl + 2`)
- Multi platform(linux, mac, win)
- 🇺🇸 🇨🇳 🇧🇷 🇷🇺 🇪🇸 🇫🇷 🇹🇷 🇭🇰 🇯🇵 🇸🇦 Multi-language support([electerm-locales](https://github.com/electerm/electerm-locales), contributions/fixes welcome)
- Double click to directly edit (small) remote files.
- Edit (small) local files with built-in editor.
- Auth with publicKey + password.
- Support Zmodem(rz, sz).
- Support [Trzsz](https://github.com/trzsz/trzsz)(trz/tsz), similar to rz/sz, and compatible with tmux.
- Transparent window(Mac, win).
- Terminal background image.
- Global/session proxy.
- Quick commands
- Sync bookmarks/themes/quick commands to github/gitee secret gist
- Support serial Port(version > 1.21.8)
- Quick input to one or all terminals.
- Command line usage: check [wiki](https://github.com/electerm/electerm/wiki/Command-line-usage)

## Download/install

- [https://electerm.github.io/electerm](https://electerm.github.io/electerm)
- From release: [https://github.com/electerm/electerm/releases](https://github.com/electerm/electerm/releases)
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

# after installation, it will immediately open for windows and linux,
# for macOS, it will open the drag to install panel

```

## Upgrade

- Auto upgrade: When a new version is released, you will get an upgrade notification after you start electerm again. You can then click the upgrade button to upgrade.
- Download: Just download the latest edition, reinstall.
- Npm: If you install from npm, just run `npm i -g electerm` again.
- If use Snap or some other distribution system, these systems may provide upgrades.

## Known issues

[https://github.com/electerm/electerm/wiki/Know-issues](https://github.com/electerm/electerm/wiki/Know-issues)

## Troubleshoot

[https://github.com/electerm/electerm/wiki/Troubleshoot](https://github.com/electerm/electerm/wiki/Troubleshoot)

## Discussion

[Discussion board](https://github.com/electerm/electerm/discussions)

## Support

Without user feedback/suggestions/pull requests/language files, this project would not get this far.I would love to hear from you, please tell me what you think, [submit an issue](https://github.com/electerm/electerm/issues), [send me an email](mailto:zxdong@gmail.com), [create/fix language files](https://github.com/electerm/electerm-locales) or create pull requests, all are welcome.

## Dev

```bash
# tested in ubuntu16.04+/mac os 10.13+ only
# needs nodejs/npm, suggest using nvm to install nodejs/npm
# https://github.com/creationix/nvm
# with node 8.6+

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

If you encounter some errors when running ```npm run app``` like ```libatk1.0.so.0: cannot open shared object file``` or ```libgtk-3.so.0: cannot open shared object file``` you need to install some required libraries (example for Ubuntu in WSL 2) :

```
sudo apt install libatk1.0-0 libatk1.0-dev libatk-bridge2.0-0 libatk-bridge2.0-dev libgtk-3-0 libgtk-3-dev
```

## Test

```bash
npm run pre-test
cp .sample.env .env

# install playwright
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D playwright@1.20.2 --no-save

# then edit .env, fill your test host/username/password, may only works in mac OS
npm run test
```

## Test build

```bash
# Tested only in ubuntu 16.04 x64+
# Install yarn first(to do yarn autoclean)
# See https://yarnpkg.com/en/docs/install

# Build linux only with -l
npm i
npm run pre-test
npm run release -l
# check dist/ folder
```

## Use

- [Set autorun when login to os](https://github.com/electerm/electerm/wiki/Autorun-electerm-when-login-to-os)

## Change log

Visit [Releases](https://github.com/electerm/electerm/releases).

## License

MIT
