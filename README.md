<h1 align="center">
    <a href="http://electerm.html5beta.com">
        <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.png", alt="" />
    </a>
</h1>

# electerm
[![GitHub version](https://img.shields.io/github/release/electerm/electerm/all.svg)](https://github.com/electerm/electerm/releases)
[![Build Status](https://travis-ci.org/electerm/electerm.svg?branch=release)](https://travis-ci.org/electerm/electerm)
[![Build status](https://ci.appveyor.com/api/projects/status/33ckbqln02utekxd/branch/release?svg=true)](https://ci.appveyor.com/project/zxdong262/electerm/branch/release)
<span class="badge-daviddm"><a href="https://david-dm.org/electerm/electerm" title="View the status of this project's dependencies on DavidDM"><img src="https://img.shields.io/david/electerm/electerm.svg" alt="Dependency Status" /></a></span>
<span class="badge-daviddmdev"><a href="https://david-dm.org/electerm/electerm#info=devDependencies" title="View the status of this project's development dependencies on DavidDM"><img src="https://img.shields.io/david/dev/electerm/electerm.svg" alt="Dev Dependency Status" /></a></span>
<span class="badge-githubstar">
[![license](https://img.shields.io/github/license/electerm/electerm.svg)](https://github.com/electerm/electerm/blob/master/LICENSE)

Terminal/ssh/sftp client(linux, mac, win) based on electron/ssh2/node-pty/xterm/antd and other libs.

<div align="center">
  <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.gif", alt="" />
</div>

## Download

- [https://electerm.html5beta.com](https://electerm.html5beta.com)
- From release: [https://github.com/electerm/electerm/releases](https://github.com/electerm/electerm/releases)
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
- Support multi platform(linux, mac, win)
- 🇺🇸 🇨🇳 🇧🇷 🇷🇺 🇪🇸 Support multi-language([electerm-locales](https://github.com/electerm/electerm-locales), contribute welcome)
- Double click to directly edit remote file(small ones).
- Support auth with publickey + password

## Support

Without users's feebacks/suggestions, this project would not get this far, would love to hear from you, please tell me what you think, [submit an issue](https://github.com/electerm/electerm/issues), [send me an email](mailto:zxdong@gmail.com), or [create a language file](https://github.com/electerm/electerm-locales).

## Dev

```bash
# tested in ubuntu16.04/mac os 10.13 only
# need nodejs/npm, suggest using nvm to install nodejs/npm
# https://github.com/creationix/nvm
# with node 8.6+

git clone git@github.com:electerm/electerm.git
cd electerm
npm i

# start webpack dev server
npm start

# in a separate terminal session run app
npm run app
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
# Tested only in ubuntu 16.04 x64
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

Visit [Releases](https://github.com/electerm/electerm/releases)

## License

MIT