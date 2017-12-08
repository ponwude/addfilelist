const express = require('express')
const fs = require('fs')
const { JSDOM } = require('jsdom')

const form_builder = require('./form_builder.js')
const { window } = new JSDOM('<!DOCTYPE html><body></body>')
const { document } = window.window

const form_template = fs.readFileSync('./form_template.html', 'utf8')


module.exports = function(form_schemas) {
  const router = express.Router()

  form_schemas.forEach((route, schema) => {

    const form_page_html = form_template
      .replace('{{form_html}}', form_builder(schema, {document}).outerHTML)
      .replace('{{form_type}}', route)

    router.get(route, (req, res) => {
      res.set('Content-Type', 'text/html')
      res.send(form_page_html)
    })

    router.post
  })

  return router
}

if (Object.forEach === undefined) {
  Object.prototype.forEach = function(func) {
    for (const key in this) {
      if (this.hasOwnProperty(key)) {
        func(key, this[key])
      }
    }
  }
}
