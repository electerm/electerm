
const {rm} = require('shelljs')

rm('-rf', [
  'app/assets/js',
  'app/assets/css',
  'app/assets/images',
  'app/assets/index.html'
])
