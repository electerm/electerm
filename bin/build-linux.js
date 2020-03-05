const { exec } = require('shelljs')

const cmd = 'rm -rf dist && ' +
'echo "tar.gz" > work/app/install-src.txt && ' +
'./node_modules/.bin/electron-builder --linux tar.gz && ' +
'rm -rf dist && ' +
'echo "deb" > work/app/install-src.txt && ' +
'./node_modules/.bin/electron-builder --linux deb && ' +
'rm -rf dist && ' +
'echo "rpm" > work/app/install-src.txt && ' +
'./node_modules/.bin/electron-builder --linux rpm &&' +
'echo "snap" > work/app/install-src.txt && ' +
'./node_modules/.bin/electron-builder --linux snap -p always'
exec(cmd)
