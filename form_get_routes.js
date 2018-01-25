/*globals __dirname */

const fs = require('then-fs')

const browserify = require('browserify')
const concat = require('concat-stream-promise')
const str = require('string-to-stream')

const express = require('express')
const { JSDOM } = require('jsdom')

const form_builder = require('./form_builder.js')

const apply_validation_entry = `
  window.apply_validation = require('./apply_validation.js')
  window.form_schemas = require('{{form_schema_path}}')
  window.on_validated_submit = require('./on_validated_submit.js')

  const form = apply_validation(
    document.querySelector('form'),
    form_schemas[form_type],
    {on_validated_submit}
  )

  if (window.run_if_loaded_for_test !== undefined) window.run_if_loaded_for_test()
  else window.loaded_for_test = true
`

const template_needs = Object.freeze({
  html_insert: '{{form_html}}',
  form_type_var: '<script>var form_type = {{form_type}}</script>',
})


async function form_get_routes(form_template_path, form_schema_path) {
  // checks
  await Promise.all([form_template_path, form_schema_path].map(p => fs.access(p)))

  const form_template = await fs.readFile(form_template_path, 'utf8')
  if (typeof form_template !== 'string')
    throw new Error('form_template must be a html string')

  const needs_indicies = {}
  for (const needs in template_needs) {
    if (template_needs.hasOwnProperty(needs)) {
      const needs_str = template_needs[needs],
            index = needs_str instanceof RegExp ? form_template.search(needs_str) : form_template.indexOf(needs_str)

      if (index < 0) throw new Error(`Form template missing: ${needs_str}`)

      needs_indicies[needs] = index
    }
  }

  // build html
  const entry = apply_validation_entry
    .replace('{{form_schema_path}}', form_schema_path)

  const bundle = (await new Promise((resolve, reject) => {
    try {
      browserify(str(entry), {basedir: __dirname})
        .bundle()
        .on('error', reject)
        .pipe(concat())
        .then(resolve)
    } catch(err) {reject(err)}
  })).toString('utf8')

  // create router
  const router = express.Router()
  const schemas = require(form_schema_path)
  const { document } = new JSDOM('<!DOCTYPE html><body></body>').window
  for (const route in schemas) {
    if (schemas.hasOwnProperty(route)) {
      const page_html = form_template
        .replace('{{form_html}}', form_builder(schemas[route], {document}).outerHTML)
        .replace('{{form_type}}', JSON.stringify(route))
        + `<script>${bundle}</script>\n`

      router.get('/' + route, (req, res) => {
        res.set('Content-Type', 'text/html')
        res.send(page_html)
      })

      router.post // define router post form handler here
    }
  }

  return router
}

Object.defineProperty(form_get_routes, 'document', {
  set(document) {form_builder.document = document},
})
try {
  form_get_routes.document = document
} catch(err) {
  form_get_routes.document = undefined
}

// describe('post request', function() {
//   it.only('is made', async function() {
//     const { form, input_0, input_1, input_2 } = elements
//     input_0.value = input_0_vals.good
//     input_1.value = input_1_vals.good
//     input_2.value = input_2_vals.good

//     const request = []
//     xhr.onCreate= xhr_obj => {request.push(xhr_obj)}

//     await while_monitoring(form).expect('valid').upon_event('submit')

//     request.should.have.lengthOf(1)

//     throw new Error('test not finished')
//   })

//   it('contains form data')

//   it('is not made with failed validation')

//   it('fails after timeout')

//   it('callback on form submit success')
//   it('callback on form submit failure')
// })

module.exports = form_get_routes
