<h1 align="center">
    <a href="https://github.com/electerm/electerm">
        <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.png", alt="" />
    </a>
</h1>

# electerm
[![Build Status](https://travis-ci.org/electerm/electerm.svg?branch=release)](https://travis-ci.org/electerm/electerm)
[![Build status](https://ci.appveyor.com/api/projects/status/33ckbqln02utekxd/branch/release?svg=true)](https://ci.appveyor.com/project/zxdong262/electerm/branch/release)
[![GitHub version](https://badge.fury.io/gh/electerm%2Felecterm.svg)](https://badge.fury.io/gh/electerm%2Felecterm)

<span class="badge-daviddm"><a href="https://david-dm.org/electerm/electerm" title="View the status of this project's dependencies on DavidDM"><img src="https://img.shields.io/david/electerm/electerm.svg" alt="Dependency Status" /></a></span>
<span class="badge-daviddmdev"><a href="https://david-dm.org/electerm/electerm#info=devDependencies" title="View the status of this project's development dependencies on DavidDM"><img src="https://img.shields.io/david/dev/electerm/electerm.svg" alt="Dev Dependency Status" /></a></span>
<span class="badge-nodeico"><a href="https://www.npmjs.com/package/electerm" title="Nodei.co badge"><img src="https://nodei.co/npm/electerm.png" alt="Nodei.co badge" /></a></span>
<span class="badge-githubstar"><iframe src="https://ghbtns.com/github-btn.html?user=electerm&amp;repo=electerm&amp;type=watch&amp;count=true" allowtransparency="true" frameborder="0" scrolling="0" width="110" height="20"></iframe></span>

- terminal/ssh/sftp client(mac, win, linux) based on electron/node-pty/xterm and more, I hope it works as a combination of `guake` and `xshell`
- it is still on its early stage, more features will be added.

<div align="center">
  <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.gif", alt="" />
</div>

## dowload
https://github.com/electerm/electerm/releases

## feature
- work as a terminal or ssh/sftp client(similar to xshell)
- hotkey to bring window back to front(simliar to guake, default is `ctrl + 2`)
- support multi platform(mac, win, linux)

## issues/todo/roadmap
https://github.com/electerm/electerm/issues

## dev
```bash
# tested on ubuntu16.04 only
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

## test build
```bash
# tested only in ubuntu 16.04 x64
# install yarn first(to do yarn autoclean)
# see https://yarnpkg.com/en/docs/install

# build linux only with -l
npm run release -l
# visit dist/
```

## License
MIT