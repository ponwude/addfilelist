/*global describe, it, __dirname, before, after */
/*eslint-disable no-console */

const path = require('path')
const http = require('http')
const fs = require('then-fs')

const combineErrors = require('combine-errors')

/*eslint-disable no-global-assign */
const jsdom = require('jsdom')
const { JSDOM } = jsdom
const { window } = new JSDOM('<!DOCTYPE html><body></body>')
const { document } = window.window
Event = window.Event
/*eslint-enable no-global-assign */

const create_form_routes = require('../create_form_routes.js') // testing

const fb = require('../form_builder.js')
const form_builder =  (schema, options={}) => fb(schema, Object.assign({document}, options))

const chai = require('chai')
chai.use(require('chai-diff'))
// chai.use(require('chai-dom'))
// chai.should()
const { expect } = chai

const while_monitoring = require('./while_monitoring.js')
const { set_val } = require('./support_test_functions.js')


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

const template_path = './form_template.html'
const test_template =
`<!DOCTYPE html>
<html>
<head>
</head>
<body>
{{form_html}}
</body>
</html>
<script src="/apply_validation-bundle.js"></script>
<script>
var form_type = {{form_type}}
apply_validation(document.querySelector('form'), form_schemas[form_type])
</script>
<script>
if (window.run_if_loaded_for_test !== undefined)
  window.run_if_loaded_for_test()
</script>
`


describe('get request should return an html form.', function() {

  const form_html_insert = '{{form_html}}'
  const form_type_insert = '{{form_type}}'

  it('HTML template matches test HTML template.', async function() {
    const file_template = await fs.readFile(template_path, 'utf8')

    expect(file_template).to.equal(test_template)

    expect(file_template).to.contain(form_html_insert)
    expect(file_template).to.contain(form_type_insert)
  })

  it('Should return form page with form html validate schema (/form0).', function() {
    const url = '/form0'
    const schema = routes[url]

    const page_html = test_template
      .replace('{{form_html}}', form_builder(schema).outerHTML)
      .replace('{{form_type}}', JSON.stringify(url))

    return request
      .get(url)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200)
      .then(res => {expect(res.text).not.differentFrom(page_html)})
  })

  it('Should return form page with form html validate schema (/form1).', function() {
    const url = '/form1'
    const schema = routes[url]

    const page_html = test_template
      .replace('{{form_html}}', form_builder(schema).outerHTML)
      .replace('{{form_type}}', JSON.stringify(url))

    return request
      .get(url)
      .expect('Content-Type', 'text/html; charset=utf-8')
      .expect(200)
      .then(res => {expect(res.text).not.differentFrom(page_html)})
  })
})

describe('Client side should display input validation error messages.', function() {

  const hostname = '127.0.0.1'
  const port = 3000
  const local_url = `http://${hostname}:${port}`

  const file_paths = {
    '/apply_validation-bundle.js': '../apply_validation-bundle.js',
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

  before(done => {server.listen(port, hostname, undefined, done)})
  after(done => {server.close(done)})

  it('Page should load without error.', async function() {
    const url = '/form1'

    const page_html = (await request.get(url)).text

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
    if (jsdomError !== undefined) throw jsdomError

    try {
      await while_monitoring(document).expect('DOMContentLoaded').upon()
      expect(window.apply_validation).to.be.a('function')
    } catch(err) {throw err}
  })

  it('Validate without validation error.', async function() {
    expect(server.listening).to.be.true

    const url = '/form0',
          good_values = routes[url][0]['good_values']

    const page_html = (await request.get(url)).text

    const virtualConsole = new jsdom.VirtualConsole()
    virtualConsole.on('log', console.log.bind(console))
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
    })
    const check_vc_error = () => {
      if (vc_error !== undefined) {
        const err = vc_error
        vc_error = undefined
        throw err
      }
    }

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
      await new Promise(resolve => {
        console.log('await new Promise')
        window.run_if_loaded_for_test = resolve
      })
    } catch(err) {throw err}
    check_vc_error()

    const { document } = window.window

    const input = document.body.querySelector('input')

    try {
      // do not check on change until a blur event happens
      await while_monitoring(input)
        .do_not_expect(['valid', 'invalid'])
        .upon(() => input.dispatchEvent(new Event('change')))

      await set_val(input, good_values[0], 'blur', 'valid')

      await set_val(input, good_values[1], 'change', 'valid')

    } catch(err) {throw err}
  })
})
