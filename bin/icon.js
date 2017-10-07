/**
 * 各系统图标生成程序
 */

const {resolve} = require('path')
const {mkdir, rm, exec, echo} = require('shelljs')
const dir = resolve('app/static/icons')
const src = resolve('app/static/images/electerm-white.png')
const bin = './node_modules/.bin'


echo('start build')

const timeStart = + new Date()

echo('clean')
rm('-rf', dir)


mkdir('-p', dir)


echo('building icons')
exec(`${bin}/png2icons ${src} ${dir}/icons -allp`)

const endTime = +new Date()
echo(`done in ${(endTime - timeStart)/1000} s`)
