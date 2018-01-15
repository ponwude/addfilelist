/*eslint-disable no-console, no-unused-vars */
/*globals __dirname, process */

const browserify = require('browserify')
const concat = require('concat-stream-promise')
const str = require('string-to-stream')

const apply_validation_entry =
`window.apply_validation = require('./apply_validation.js')
window.form_schemas = require('./test/form_schema_example.js')

apply_validation(document.querySelector('form'), form_schemas[form_type])

if (window.run_if_loaded_for_test !== undefined)
  window.run_if_loaded_for_test()
`

try {
  (async function build_it(schemas_path) {
    try {
      const bundle = (await new Promise((resolve, reject) => {
        browserify(str(apply_validation_entry), {basedir: __dirname})
          .bundle()
          .on('error', reject)
          .pipe(concat())
          .then(resolve)
      })).toString('utf8')

      console.log('bundle', bundle)
    } catch(err) {
      console.log(err.message)
    }

    console.log('finished')
  })()
} catch(err) {throw err}



