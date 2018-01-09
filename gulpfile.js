const gulp = require('gulp')
const pug = require('gulp-pug')
let version = ''
try {
  version = require('fs').readFileSync('./version').toString()
} catch(e) {
  console.log('no version file created')
}

gulp.task('pug', gulp.series(function(done) {
  gulp.src([
    './views/*.pug'
  ])
    .pipe(pug({
      locals: {
        version,
        _global: {}
      }
    }))
    .pipe(gulp.dest('./app/assets'))
  done()
}))

gulp.task('default', gulp.series('pug'))
