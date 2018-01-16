/*global describe, it, __dirname, before, beforeEach, after, afterEach */

const express = require('express')
const supertest = require('supertest')

const path = require('path')
const http = require('http')
const fs = require('then-fs')

const combineErrors = require('combine-errors')

const jsdom = require('jsdom')
const { JSDOM } = jsdom

const create_form_routes = require('../create_form_routes.js') // testing

const chai = require('chai')
chai.use(require('chai-diff'))
chai.use(require('chai-as-promised'))
const { expect } = chai

const while_monitoring = require('./while_monitoring.js')
const { set_val } = require('./support_test_functions.js')

const form_schema_path = path.join(__dirname, './form_schema_example.js')
const form_schemas = require(form_schema_path)


describe('Ensure html contains required code', function() {
  it('form_html', function() {
    const template = `
      <script>var form_type = {{form_type}}</script>
      <script src="/apply_validation-bundle.js"></script>
      `

    return expect(create_form_routes(template))
      .to.be.rejectedWith('Form template missing: {{form_html}}')
  })

  it('form_type', function() {
    const template = `
      <body>{{form_html}}</body>
      <script src="/apply_validation-bundle.js"></script>
      `

    return expect(create_form_routes(template))
      .to.be.rejectedWith('Form template missing: <script>var form_type = {{form_type}}</script>')
  })
})

describe('form_schema_path', function() {
  const template = `
    <body>{{form_html}}</body>
    <script>var form_type = {{form_type}}</script>
    <script src="/another_1/%/apply_validation-bundle.js"></script>
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

    const hostname = '127.0.0.1'
    const port = 3000
    const local_url = `http://${hostname}:${port}`

    const file_paths = {
      '/apply_validation-bundle.js': path.join(__dirname, '../apply_validation-bundle.js'),
    }

    let server
    before(done => {
      server = http.createServer(async (req, res) => {
        const system_file_path = file_paths[req.url]

        if (system_file_path === undefined) {
          res.statusCode = 400
          res.end(`File ${res.url} not found.`)
        }
        else {
          try {
            fs.access(system_file_path)
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/javascript')
            const file_content = await fs.readFile(system_file_path)
            res.end(file_content)
          }
          catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'text/text')
            res.end(String(err))
          }
        }
      })

      server.setTimeout(50)
      server.listen(port, hostname, undefined, done)
    })
    after(done => {server.close(done)})

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
          url: local_url,
          runScripts: 'dangerously',
          resources: 'usable',
          virtualConsole,
        }
      )
      const { window } = dom

      // wait for page load
      try {
        await new Promise((resolve, reject) => {
          if (window.loaded_for_test === true) resolve()
          else {
            window.run_if_loaded_for_test = resolve
            setTimeout(() => reject(new Error('Page load timed out')), 1000)
          }
        })
      } catch(err) {throw err}

      check_vc_error()

      return {dom, window, document: window.window.document, Event: window.Event}
    }

    it('Page should load without error.', async function() {
      const url = '/form1'

      const page_html = (await request.get(url)).text

      try {
        const { window } = await load_page(page_html)

        expect(window.form_type).to.equal(url)
        expect(window.apply_validation).to.be.a('function')
      } catch(err) {throw err}
    })

    it('validate with repeating blur -> change (repeat) -> submit cycle', async function() {
      expect(server.listening).to.be.true

      const url = '/form0'
      const { good_values, bad_values } = form_schemas[url][0]

      const page_html = (await request.get(url)).text

      const { document, Event } = await load_page(page_html)
      set_val.Event = Event

      const input = document.body.querySelector('input'),
            form = document.body.querySelector('form')

      try {
        // do not check on change until a blur event happens
        await while_monitoring(input)
          .do_not_expect(['valid', 'invalid'])
          .upon(() => input.dispatchEvent(new Event('change')))

        await set_val(input, good_values[0], {dispatch: 'blur', resolve_events: 'valid'})
        await set_val(input, good_values[1], {dispatch: 'change', resolve_events: 'valid'})
        await set_val(input, good_values[1], {dispatch: 'change', resolve_events: 'valid'})
        await while_monitoring(input).expect('valid').upon(() => {
          form.dispatchEvent(new Event('submit'))
        })

        await set_val(input, bad_values[0], {dispatch: 'blur', resolve_events: 'invalid'})
        await set_val(input, bad_values[1], {dispatch: 'change', resolve_events: 'invalid'})
        await set_val(input, bad_values[1], {dispatch: 'change', resolve_events: 'invalid'})
        await while_monitoring(input).expect('invalid').upon(() => {
          form.dispatchEvent(new Event('submit'))
        })

      } catch(err) {throw err}
    })
  })
})
