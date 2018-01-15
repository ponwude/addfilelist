/*eslint-disable no-console, semi */
/*globals __dirname, process */

const browserify = require('browserify');
const str = require('string-to-stream');

const bad_code = '"this is not javascript"';

(function() {
  browserify(str(bad_code), {basedir: __dirname})
    .bundle()
    .pipe(process.stdout)

})();


