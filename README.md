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


- terminal/ssh/sftp client(linux, mac, win) based on electron/node-pty/xterm/antd and other libs.

<div align="center">
  <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.gif", alt="" />
</div>

## dowload
- https://electerm.html5beta.com
- or from release: https://github.com/electerm/electerm/releases

## or install from npm
```
npm i -g electerm

# after install it will open at once for windows and linux,
# for mac, will open the drag to install panel

```

## upgrade

- if you downloaded it, then just download the latest edition, reinstall.
- if you install from npm, just run `npm i -g electerm` again.

## features
- work as a terminal/file manager or ssh/sftp client(similar to xshell)
- global hotkey to toggle window visibility (simliar to guake, default is `ctrl + 2`)
- support multi platform(linux, mac, win)
- support multi-language(https://github.com/electerm/electerm-locales, contribute welcome)

## issues/todo/roadmap/tell me what you think
https://github.com/electerm/electerm/issues

## dev
```bash
# tested in ubuntu16.04/mac os 10.13 only
# need nodejs/npm, suggest using nvm to install nodejs/npm
# https://github.com/creationix/nvm
# with node 8.6+

git clone git@github.com:electerm/electerm.git
cd electerm
npm i

# server
npm run s

# client
npm run c

# app
npm run dev
```

## test
```bash
npm run pre-test
npm run test
```

## test build
```bash
# tested only in ubuntu 16.04 x64
# install yarn first(to do yarn autoclean)
# see https://yarnpkg.com/en/docs/install

# build linux only with -l
npm i
npm run pre-test
npm run release -l
# visit dist/
```

## use
- [set autorun when login to os](https://github.com/electerm/electerm/wiki/autorun-electerm-when-login-to-os)

## changelog
visit https://github.com/electerm/electerm/releases

## license
MIT