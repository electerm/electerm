/**
 * 打包程序
 */

const {version, name} = require('../package.json')
const {mkdir, rm, exec, echo, cp} = require('shelljs')
const {readdirSync} = require('fs')
const dir = 'dist/v' + version
const bin = './node_modules/.bin'
const cwd = process.cwd()

echo('start build')

const timeStart = + new Date()

echo('clean')
exec('npm run clean')
exec('npm run ver')
exec('npm run gulp')
exec('npm run build')
rm('-rf', dir)
rm('-rf', 'dist/latest')
rm('-rf', 'work')

mkdir('-p', dir)
mkdir('-p', 'dist/latest')
mkdir('-p', 'work')
cp('-r', 'app', 'work/')
cp('-r', [
  'package.json',
  'node_modules',
  'version'
], 'work/app/')
rm('-rf',  'work/app/config.js')
rm('-rf',  'work/app/user-config.json')
rm('-rf',  'work/app/assets/js/common-css.bundle.js')

exec(`cd work/app && npm prune --production && \\
 ../../node_modules/.bin/n-prune && \\
 cd ${cwd}`)

mkdir('-p', dir + '/installers')

echo('building win32')
exec(`${bin}/electron-packager ./work/app --overwrite --platform=win32 --arch=ia32 --out=${dir} --icon=app/static/icons/icons.ico`)
//cp('app/config.sample.js', `${dir}/${name}-win32-ia32/`)

echo('building linux')
exec(`${bin}/electron-packager ./work/app --overwrite --platform=linux --arch=x64 --out=${dir}`)
//cp('app/config.sample.js', `${dir}/${name}-linux-x64/`)

// echo('building armv7l')
// exec(`${bin}/electron-builder --armv7l --dir --config electron-builder.json`)
// exec(`mv dist/linux-armv7l-unpacked ${dir}/${name}-armv7l`)
// exec(`chmod +x ${dir}/${name}-armv7l/${name}`)

echo('building mac')
exec(`${bin}/electron-packager ./work/app --overwrite --platform=darwin --arch=x64 --out=${dir} --icon=app/static/icons/icons.icns`)
//cp('app/config.sample.js', `${dir}/${name}-darwin-x64/electerm.app/`)

echo('building win32 installer')
exec(`cd ${dir} && tar czf installers/${name}-win32-${version}.tar.gz ${name}-win32-ia32 && cd ${cwd}`)

echo('building linux debian installer')
exec(`${bin}/electron-installer-debian --src ${dir}/${name}-linux-x64 --dest ${dir}/installers/ --arch amd64 --icon ${dir}/${name}-linux-x64/resources/app/static/images/electerm-round-128.png`)
exec(`mv ${dir}/installers/*.deb ${dir}/installers/${name}-${version}.deb`)

echo('building linux redhat installer')
exec(`${bin}/electron-installer-redhat --src ${dir}/${name}-linux-x64 --dest ${dir}/installers/ --arch amd64 --icon ${dir}/${name}-linux-x64/resources/app/static/images/electerm-round-128.png`)
exec(`mv ${dir}/installers/*.rpm ${dir}/installers/${name}-${version}.rpm`)

echo('building linux tar.gz')
exec(`cd ${dir} && tar czf installers/${name}-linux-x64-${version}.tar.gz ${name}-linux-x64 && cd ${cwd}`)

// echo('building armv7l tar.gz')
// exec(`cd ${dir} && tar czf installers/${name}-armv7l-${version}.tar.gz ${name}-armv7l && cd ${cwd}`)

echo('building mac tar.gz')
exec(`cd ${dir} && tar czf installers/${name}-darwin-x64-${version}.tar.gz ${name}-darwin-x64/${name}.app && cd ${cwd}`)

//copy to latest
echo('copy to latest')
let arr = readdirSync(`${dir}/installers`)
for (let f of arr) {
  let newf = f.replace(version, 'latest')
  cp('-f', `${dir}/installers/${f}`, `dist/latest/${newf}`)
}

const endTime = +new Date()
echo(`done in ${(endTime - timeStart)/1000} s`)
