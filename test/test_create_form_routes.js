/*global describe, it, __dirname, after */
/*eslint-disable no-console */

const path = require('path')
const http = require('http')
const fs = require('then-fs')

const jsdom = require('jsdom')
const { JSDOM } = jsdom
const { window } = new JSDOM('<!DOCTYPE html><body></body>')
const { document } = window.window
const Event = window.Event

const create_form_routes = require('../create_form_routes.js') // testing

const fb = require('../form_builder.js')
const form_builder =  (schema, options={}) => fb(schema, Object.assign({document}, options))

const chai = require('chai')
chai.use(require('chai-diff'))
// chai.use(require('chai-dom'))
// chai.should()
const { expect } = chai

const Promise = require('bluebird')


const all_events = require('../all_events.js')


const routes = {
  '/form0': [
    {
      name: 'input0',
      label: 'Input 0',
      attr: {type: 'text'},
      validate: 'Joi.string().alphanum().required()',
      good_values: ['1', 'a'],
      bad_values: ['#', '*'],
    },
  ],
  '/form1': [
    {
      name: 'input0',
      label: 'Input 0',
      attr: {type: 'number'},
      validate: 'Joi.number().integer().required()',
      good_values: ['1', 2],
      bad_values: [1.2, 'b'],
    },
    {
      name: 'input1',
      label: 'Input 1',
      attr: {type: 'text'},
      validate: 'Joi.string().lowercase()',
      good_values: ['a', 'b'],
      bad_values: ['A', 1],
    },
  ],
}

// initalize app
const app = require('express')()
app.use('/', create_form_routes(routes))
app.use(function(req, res) {
  res.status(500)
  res.send('was not caught by routes')
})
app.use(function(err, req, res) {
  // render the error page
  res.status(err.status || 500)
  res.send('error')
})
const request = require('supertest')(app)


const page_template =
`<!DOCTYPE html>
<html>
<head>
  <script src="/apply_validation-bundle.js"></script>
  <script src="/joi-browser.js"></script>
</head>
<body>
{{form_html}}
</body>
</html>
<script>
  var form = document.querySelector('form')
  var validate_schema = {{validate_schema}}
  apply_validation(form, validate_schema)
  form.dispatchEvent(new Event('validation_applied'))
</script>
`


describe('get request should return an html form.', function() {
  it('Should return form page with form html validate schema (/form0).', function() {
    const url = '/form0'
    const schema = routes[url]

    const page_html = page_template
      .replace('{{form_html}}', form_builder(schema).outerHTML)
      .replace('{{validate_schema}}', JSON.stringify(
        schema.map(x => ({name: x.name, validate: x.validate}))
      ))

    return request
      .get(url)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200)
      .then(res => {
        expect(res.text).not.differentFrom(page_html)
      })
  })

  it('Should return form page with form html validate schema (/form1).', function() {
    const url = '/form1'
    const schema = routes[url]

    const page_html = page_template
      .replace('{{form_html}}', form_builder(schema).outerHTML)
      .replace('{{validate_schema}}', JSON.stringify(
        schema.map(x => ({name: x.name, validate: x.validate}))
      ))

    return request
      .get(url)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200)
      .then(res => {
        expect(res.text).not.differentFrom(page_html)
      })
  })
})

describe('Client side should display input validation error messages.', function() {

  const hostname = '127.0.0.1'
  const port = 3000
  const local_url = `http://${hostname}:${port}`

  const file_paths = {
    '/apply_validation-bundle.js': '../apply_validation-bundle.js',
    '/joi-browser.js': '../node_modules/joi-browser/dist/joi-browser.min.js',
  }
  for (const file in file_paths) {
    if (file_paths.hasOwnProperty(file)) {
      file_paths[file] = path.join(__dirname, file_paths[file])
    }
  }

  const server = http.createServer(async (req, res) => {
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
  server.listen(port, hostname)

  after(done => {server.close(done)})

  it('Page should load without error.', async function() {
    const url = '/form1'

    let page_html_let
    try {
      page_html_let = (await request.get(url)).text
    }
    catch (err) {
      return Promise.reject(err)
    }
    const page_html = page_html_let
    page_html_let = undefined

    // const virtualConsole = undefined
    const virtualConsole = new jsdom.VirtualConsole()
    let jsdomError = undefined
    virtualConsole.on('jsdomError', err => {jsdomError = err})

    const dom = new JSDOM(page_html, {
      url: local_url,
      runScripts: 'dangerously',
      resources: 'usable',
      virtualConsole,
    })

    const { window } = dom
    const { document } = window.window

    try {
      await Promise.all([
        async_event(document, 'DOMContentLoaded'),
        async_event(document.body.getElementsByTagName('form')[0], 'validation_applied'),
      ])
    }
    catch (err) {
      return Promise.reject(err)
    }

    if (jsdomError !== undefined) return Promise.reject(jsdomError)
  })

  it('Validate without error.', done => {
    (async function() {
      const url = '/form0',
            good_values = routes[url][0]['good_values']

      let page_html_let
      try {
        page_html_let = (await request.get(url)).text

        const page_html = page_html_let
        page_html_let = undefined

        const dom = new JSDOM(page_html, {
          url: local_url,
          runScripts: 'dangerously',
          resources: 'usable',
        })

        const { window } = dom
        const { document } = window.window

        const form = document.body.getElementsByTagName('form')[0]
        await async_event(form, 'validation_applied')

        const input = document.body.querySelector('input')



        // console.log('1 input_event_queue', input_event_queue.map(event => event.type))
        // input.value = good_values[0]
        // input.dispatchEvent(new Event('change'))
        // console.log('2 input_event_queue', input_event_queue.map(event => event.type))
        // await async_event(input, 'change')
        // console.log('3 input_event_queue', input_event_queue.map(event => event.type))
        // window.eval("document.body.querySelector('input').dispatchEvent(new Event('click'))")
        // console.log('4 input_event_queue', input_event_queue.map(event => event.type))
        // await async_event(input, 'click')
        // console.log('5 input_event_queue', input_event_queue.map(event => event.type))
        // await async_no_event(input, input_events)

        // input.dispatchEvent(new Event('blur'))
        // console.log('6 input_event_queue', input_event_queue.map(event => event.type))
        // await async_event(input, 'valid', 100)

        await while_monitoring(input)
          .do_not_expect(['valid', 'invalid'])
          .upon(() => input.dispatchEvent(new Event('change')))

        await while_monitoring(input)
          .expect('valid')
          .upon()

        done()
      } catch (err) {
        done(err)
      }
    })()
  })
})
