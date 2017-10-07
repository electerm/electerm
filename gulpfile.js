const gulp = require('gulp')
const pug = require('gulp-pug')
let version = ''
try {
  version = require('fs').readFileSync('./version').toString()
} catch(e) {
  console.log('no version file created')
}

gulp.task('pug', function() {
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
})

gulp.task('default', ['pug'])
