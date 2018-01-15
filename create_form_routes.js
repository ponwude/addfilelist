/*globals __dirname */
/*eslint-disable no-console */

const fs = require('then-fs')

const browserify = require('browserify')
const concat = require('concat-stream-promise')
const str = require('string-to-stream')

const express = require('express')
const { JSDOM } = require('jsdom')

const form_builder = require('./form_builder.js')
const { window } = new JSDOM('<!DOCTYPE html><body></body>')
const { document } = window.window


const apply_validation_entry =
`window.apply_validation = require('./apply_validation.js')
window.form_schemas = require('{{form_schema_path}}')

apply_validation(document.querySelector('form'), form_schemas[form_type])

if (window.run_if_loaded_for_test !== undefined) window.run_if_loaded_for_test()
else window.loaded_for_test = true
`

const template_needs = Object.freeze({
  html_insert: '{{form_html}}',
  form_type_var: '<script>var form_type = {{form_type}}</script>',
})


module.exports = async function(form_template, form_schema_path) {
  // check form_template
  const needs_indicies = {}
  for (const needs in template_needs) {
    if (template_needs.hasOwnProperty(needs)) {
      const needs_str = template_needs[needs],
            index = needs_str instanceof RegExp ? form_template.search(needs_str) : form_template.indexOf(needs_str)

      if (index < 0) throw new Error(`Form template missing: ${needs_str}`)

      needs_indicies[needs] = index
    }
  }

  // form_schema_path exists
  try {
    await fs.access(form_schema_path)
  }
  catch(err) {
    throw new Error(`Cannot find form_schema_path file '${form_schema_path}' from '${__dirname}'`)
  }

  try {
    // build html
    const entry = apply_validation_entry
      .replace('{{form_schema_path}}', form_schema_path)

    /*eslint-disable no-unused-vars */
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

    for (const route in schemas) {
      if (schemas.hasOwnProperty(route)) {
        const page_html = form_template
          .replace('{{form_html}}', form_builder(schemas[route], {document}).outerHTML)
          .replace('{{form_type}}', JSON.stringify(route))
          + `<script>${bundle}</script>\n`

        router.get(route, (req, res) => {
          res.set('Content-Type', 'text/html')
          res.send(page_html)
        })

        router.post // define router post form handler here
      }
    }

    return router

  } catch(err) {throw err}

}
