/* To bundle use the command
 * npx browserify -p tinyify try-entry.js > try-bundle-tinyify.js
 */

const apply_validation = require('./apply_validation.js')
const form_schemas = require('./try.js')


const form = document.querySelector('form')
apply_validation(form, form_schemas['/form0'])

form.dispatchEvent(new Event('validation_applied'))
