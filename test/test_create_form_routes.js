/*global describe, it, __dirname, before, beforeEach, afterEach */

const express = require('express')
const supertest = require('supertest')

const path = require('path')

const combineErrors = require('combine-errors')

const jsdom = require('jsdom')
const { JSDOM } = jsdom

const create_form_routes = require('../create_form_routes.js') // testing

const chai = require('chai')
chai.use(require('chai-diff'))
chai.use(require('chai-as-promised'))
const { expect } = chai

const form_schema_path = path.join(__dirname, './form_schema_example.js')


describe('Ensure html contains required code', function() {
  it('form_html', function() {
    const template = '<script>var form_type = {{form_type}}</script>'

    return expect(create_form_routes(template))
      .to.be.rejectedWith('Form template missing: {{form_html}}')
  })

  it('form_type', function() {
    const template = '<body>{{form_html}}</body>'

    return expect(create_form_routes(template))
      .to.be.rejectedWith('Form template missing: <script>var form_type = {{form_type}}</script>')
  })
})

describe('form_template', function() {
  it('is undefined', function() {
    return expect(create_form_routes(undefined, form_schema_path))
      .to.be.rejectedWith('form_template must be a html string')
  })
})

describe('form_schema_path', function() {
  const template = `
    <body>{{form_html}}</body>
    <script>var form_type = {{form_type}}</script>
    `

  it('bad path', function() {
    const bad_file_path = 'this is not a file path'

    return expect(create_form_routes(template, bad_file_path))
      .to.be.rejectedWith(`Cannot find form_schema_path file '${bad_file_path}' from '${path.resolve(__dirname, '..')}'`)
  })

  it('undefined path', function() {
    const bad_file_path = undefined

    return expect(create_form_routes(template, bad_file_path))
      .to.be.rejectedWith(`Cannot find form_schema_path file '${bad_file_path}' from '${path.resolve(__dirname, '..')}'`)
  })

  it('full path', function() {
    return create_form_routes(template, form_schema_path)
  })

})



const form_template =
`<!DOCTYPE html>
<html>
<head></head>
<body>
{{form_html}}
</body>
</html>

<script>var form_type = {{form_type}}</script>
`

describe('run app', async function() {
  let request
  before(async () => {
    // initalize app
    const app = express()
    try {
      app.use('/', await create_form_routes(form_template, form_schema_path))
    } catch(err) {
      throw combineErrors([new Error('Problem creating app'), err])
    }
    app.use(function(req, res) {
      res.status(500)
      res.send('was not caught by routes')
    })
    app.use(function(err, req, res) {
      // render the error page
      res.status(err.status || 500)
      res.send('error')
    })

    request = supertest(app)
  })

  describe('Client side should display input validation error messages.', function() {

    let virtualConsole, check_vc_error
    beforeEach(() => {
      virtualConsole = new jsdom.VirtualConsole()

      let vc_error = undefined
      virtualConsole.sendTo({
        error(_, err) {
          if (vc_error !== undefined)
            throw combineErrors([
              new Error('Unhandled virtualConsole error below'),
              vc_error,
              new Error('when below error was thrown'),
              err,
            ])

          vc_error = err
        },
        log(to_log) {
          if (vc_error !== undefined)
            throw combineErrors([
              new Error('Unhandled virtualConsole error below'),
              vc_error,
              new Error(`When virtualConsole received unexpected log: ${to_log}`),
            ])

          vc_error = new Error(`virtualConsole received unexpected log: ${to_log}`)
        },
      })

      check_vc_error = () => {
        if (vc_error !== undefined) {
          const err = vc_error
          vc_error = undefined
          throw err
        }
      }
    })

    afterEach(() => {check_vc_error()})

    const load_page = async page_html => {
      const dom = new JSDOM(
        page_html,
        {
          runScripts: 'dangerously',
          virtualConsole,
        }
      )
      const { window } = dom

      // wait for page load
      await new Promise((resolve, reject) => {
        if (window.loaded_for_test === true) resolve()
        else {
          window.run_if_loaded_for_test = resolve
          setTimeout(() => reject(new Error('Page load timed out')), 1000)
        }
      })

      check_vc_error()

      return {dom, window, document: window.window.document, Event: window.Event}
    }

    it('Page should load without error.', async function() {
      const url = '/form1'
      const page_html = (await request.get(url)).text
      const { window } = await load_page(page_html)

      expect(window.form_type).to.equal(url)
      expect(window.apply_validation).to.be.a('function')
    })
  })
})
