<h1 align="center">
    <a href="https://electerm.github.io/electerm">
        <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.png", alt="" />
    </a>
</h1>

# electerm

[![GitHub version](https://img.shields.io/github/release/electerm/electerm/all.svg)](https://github.com/electerm/electerm/releases)
[![GitHub Actions](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fatrox%2Fsync-dotenv%2Fbadge)](https://github.com/electerm/electerm/actions)
[![license](https://img.shields.io/github/license/electerm/electerm.svg)](https://github.com/electerm/electerm/blob/master/LICENSE)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Get it from the Snap Store](https://img.shields.io/badge/Snap-Store-green)](https://snapcraft.io/electerm)

Terminal/ssh/sftp client(linux, mac, win) based on electron/ssh2/node-pty/xterm/antd/[subx](https://github.com/tylerlong/subx) and other libs.

<div align="center">
  <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.gif", alt="" />
</div>

## Download/install

- [https://electerm.github.io/electerm](https://electerm.github.io/electerm)
- From release: [https://github.com/electerm/electerm/releases](https://github.com/electerm/electerm/releases)
- For some linux OS, rpm pack may not work, you can try the `.snap` release.
- For Mac user: `brew install --cask electerm`
- With snap: `sudo snap install electerm`
- For Deepin Linux user, you can find it from App store.
- For Windows users, command-line installer [scoop](https://github.com/lukesampson/scoop) is recommended:

```powershell
scoop bucket add dorado https://github.com/chawyehsu/dorado
scoop install dorado/electerm
```
- Install from npm

```bash
npm i -g electerm

# after install it will open at once for windows and linux,
# for mac, will open the drag to install panel

```

## Upgrade

- Auto upgrade: When new version released, you will get upgrade notification after you start electerm again, then you click the upgrade button to upgrade.
- Download: Just download the latest edition, reinstall.
- Npm: If you install from npm, just run `npm i -g electerm` again.

## Features

- Work as a terminal/file manager or ssh/sftp client(similar to xshell)
- Global hotkey to toggle window visibility (simliar to guake, default is `ctrl + 2`)
- Multi platform(linux, mac, win)
- 🇺🇸 🇨🇳 🇧🇷 🇷🇺 🇪🇸 🇫🇷 🇹🇷 🇭🇰 🇯🇵 Support multi-language([electerm-locales](https://github.com/electerm/electerm-locales), contribute/fix welcome)
- Double click to directly edit remote file(small ones).
- Edit local file with built-in editor(small ones).
- Auth with publickey + password.
- Zmodem(rz, sz).
- Transparent window(Mac, win).
- Terminal background image.
- Global/session proxy.
- Quick commands
- Sync bookmarks/themes/quick commands to github/gitee secret gist
- ~~Serial Port support~~(removed after version 1.10.14)
- Quick input to one or all terminal
- Command line usage: check [wiki](https://github.com/electerm/electerm/wiki/Command-line-usage)

## Known issues

[https://github.com/electerm/electerm/wiki/Know-issues](https://github.com/electerm/electerm/wiki/Know-issues)

## Troubleshoot

[https://github.com/electerm/electerm/wiki/Troubleshoot](https://github.com/electerm/electerm/wiki/Troubleshoot)

## Support

Without users's feedbacks/suggestions/pull requests/language files, this project would not get this far, would love to hear from you, please tell me what you think, [submit an issue](https://github.com/electerm/electerm/issues), [send me an email](mailto:zxdong@gmail.com), [create/fix language files](https://github.com/electerm/electerm-locales) or create a pull requests, all welcome.

## Dev

```bash
# tested in ubuntu16.04+/mac os 10.13+ only
# need nodejs/npm, suggest using nvm to install nodejs/npm
# https://github.com/creationix/nvm
# with node 8.6+

git clone git@github.com:electerm/electerm.git
cd electerm
npm i

# start webpack dev server, requires 5570 port
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
npm run pre-test
cp .sample.env .env
# then edit .env, fill your test host/username/password
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
# visit dist/
```

## Use

- [Set autorun when login to os](https://github.com/electerm/electerm/wiki/autorun-electerm-when-login-to-os)

## Change log

Visit [Releases](https://github.com/electerm/electerm/releases).

## License

MIT
