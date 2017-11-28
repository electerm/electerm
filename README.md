<h1 align="center">
    <a href="http://jade-press.org">
        <img src="https://raw.githubusercontent.com/electerm/electerm/master/app/static/images/electerm.png", alt="" />
    </a>
</h1>

# electerm
- terminal/ssh/sftp client(mac, win, linux) based on electron/node-pty/xterm and more, I hope it works as a combination of `guake` and `xshell`
- it is still on its early stage, more features will be added.

<div align="center">
  <img src="https://github.com/electerm/electerm-resource/raw/master/static/images/electerm.gif", alt="" />
</div>

## dowload
https://github.com/electerm/electerm/releases


## feature
- work as a terminal or ssh/sftp client(similar to xshell)
- hotkey to bring window back to front(simliar to guake)
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

## build
```bash
# in ubutnu 16.04 need rpm and Wine 1.6 or later to be installed
# see https://github.com/electron-userland/electron-packager
npm run dist
# visit dist/
```

## License
MIT