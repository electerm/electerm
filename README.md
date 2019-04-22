<h1 align="center">
    <a href="http://electerm.html5beta.com">
        <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.png", alt="" />
    </a>
</h1>

# electerm
[![Backers on Open Collective](https://opencollective.com/electerm/backers/badge.svg)](#backers) [![Sponsors on Open Collective](https://opencollective.com/electerm/sponsors/badge.svg)](#sponsors) [![GitHub version](https://img.shields.io/github/release/electerm/electerm/all.svg)](https://github.com/electerm/electerm/releases)
[![Build Status](https://travis-ci.org/electerm/electerm.svg?branch=release)](https://travis-ci.org/electerm/electerm)
[![Build status](https://ci.appveyor.com/api/projects/status/33ckbqln02utekxd/branch/release?svg=true)](https://ci.appveyor.com/project/zxdong262/electerm/branch/release)
<span class="badge-daviddm"><a href="https://david-dm.org/electerm/electerm" title="View the status of this project's dependencies on DavidDM"><img src="https://img.shields.io/david/electerm/electerm.svg" alt="Dependency Status" /></a></span>
<span class="badge-daviddmdev"><a href="https://david-dm.org/electerm/electerm#info=devDependencies" title="View the status of this project's development dependencies on DavidDM"><img src="https://img.shields.io/david/dev/electerm/electerm.svg" alt="Dev Dependency Status" /></a></span>
<span class="badge-githubstar">
[![license](https://img.shields.io/github/license/electerm/electerm.svg)](https://github.com/electerm/electerm/blob/master/LICENSE)
[![996.icu](https://img.shields.io/badge/link-996.icu-red.svg)](https://996.icu)

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
- Edit local file with built-in editor(small ones).
- Support auth with publickey + password.
- Support Zmodem.
- Support transparent window(Mac, win).

## Support

Without users's feebacks/suggestions, this project would not get this far, would love to hear from you, please tell me what you think, [submit an issue](https://github.com/electerm/electerm/issues), [send me an email](mailto:zxdong@gmail.com), or [create/fix language files](https://github.com/electerm/electerm-locales).

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

## Contributors

This project exists thanks to all the people who contribute. 
<a href="https://github.com/electerm/electerm/graphs/contributors"><img src="https://opencollective.com/electerm/contributors.svg?width=890&button=false" /></a>


## Backers

Thank you to all our backers! 🙏 [[Become a backer](https://opencollective.com/electerm#backer)]

<a href="https://opencollective.com/electerm#backers" target="_blank"><img src="https://opencollective.com/electerm/backers.svg?width=890"></a>


## Sponsors

Support this project by becoming a sponsor. Your logo will show up here with a link to your website. [[Become a sponsor](https://opencollective.com/electerm#sponsor)]

<a href="https://opencollective.com/electerm/sponsor/0/website" target="_blank"><img src="https://opencollective.com/electerm/sponsor/0/avatar.svg"></a>
<a href="https://opencollective.com/electerm/sponsor/1/website" target="_blank"><img src="https://opencollective.com/electerm/sponsor/1/avatar.svg"></a>
<a href="https://opencollective.com/electerm/sponsor/2/website" target="_blank"><img src="https://opencollective.com/electerm/sponsor/2/avatar.svg"></a>
<a href="https://opencollective.com/electerm/sponsor/3/website" target="_blank"><img src="https://opencollective.com/electerm/sponsor/3/avatar.svg"></a>
<a href="https://opencollective.com/electerm/sponsor/4/website" target="_blank"><img src="https://opencollective.com/electerm/sponsor/4/avatar.svg"></a>
<a href="https://opencollective.com/electerm/sponsor/5/website" target="_blank"><img src="https://opencollective.com/electerm/sponsor/5/avatar.svg"></a>
<a href="https://opencollective.com/electerm/sponsor/6/website" target="_blank"><img src="https://opencollective.com/electerm/sponsor/6/avatar.svg"></a>
<a href="https://opencollective.com/electerm/sponsor/7/website" target="_blank"><img src="https://opencollective.com/electerm/sponsor/7/avatar.svg"></a>
<a href="https://opencollective.com/electerm/sponsor/8/website" target="_blank"><img src="https://opencollective.com/electerm/sponsor/8/avatar.svg"></a>
<a href="https://opencollective.com/electerm/sponsor/9/website" target="_blank"><img src="https://opencollective.com/electerm/sponsor/9/avatar.svg"></a>



## License

MIT