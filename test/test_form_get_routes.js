/*eslint-disable no-console, no-unused-vars */
/*global context, describe, it, __dirname, before, beforeEach, afterEach */

const express = require('express')
const bodyParser = require('body-parser')
const supertest = require('supertest')

const path = require('path')

const combineErrors = require('combine-errors')

const jsdom = require('jsdom')
const { JSDOM } = jsdom

const form_get_routes = require('../form_get_routes.js')

const chai = require('chai')
chai.use(require('chai-diff'))
chai.use(require('chai-as-promised'))
chai.use(require('chai-string'))
const { expect } = chai

const MockXMLHttpRequest = require('mock-xmlhttprequest')

const _ = require('lodash')

require('./unhandled.js')

const form_template_path = path.join(__dirname, 'form_test_templates/form_template_good.mustache')
const form_schema_path = path.join(__dirname, 'form_schemas/form_test_schema.js')
const form_schemas = require(form_schema_path)

function all_good(document, form_type) {
  form_schemas[form_type].forEach(({name, good}) => {
    if (good === undefined) throw new Error(`good must be defined for all objects in forms schema: ${form_type}`)
    document.querySelector(`input[name=${name}]`).value = good
  })
}


describe('Ensure form_template file contains required code', function() {
  it('form_html', function() {
    const template_path = path.join(
      __dirname,
      'form_test_templates/form_template_missing-form_html.mustache'
    )

    return expect(form_get_routes(template_path, form_schema_path))
      .to.be.rejectedWith('Form template missing: {{form_html}}')
  })

  it('form_type', function() {
    const template_path = path.join(
      __dirname,
      'form_test_templates/form_template_missing-form_type.mustache'
    )

    return expect(form_get_routes(template_path, form_schema_path))
      .to.be.rejectedWith('Form template missing: <script>var form_type = {{form_type}}</script>')
  })
})

describe('bad file paths throw error', function() {
  it('form_schema_path', function() {
    const bad_schema_path = 'this is not a file path'

    return expect(form_get_routes(form_template_path, bad_schema_path))
      .to.be.rejectedWith(`ENOENT: no such file or directory, access '${bad_schema_path}'`)
  })

  it('form_schema_path', function() {
    const bad_template_path = 'this is not a file path'

    return expect(form_get_routes(bad_template_path, form_schema_path))
      .to.be.rejectedWith(`ENOENT: no such file or directory, access '${bad_template_path}'`)
  })
})


context('run app', async function() {
  let request, unhandled_requests, route_errors
  before(async () => {
    // initalize app
    const app = express()

    app.use(bodyParser.json())
    app.use(bodyParser.urlencoded({ extended: false }))

    try {
      app.use('/', await form_get_routes(form_template_path, form_schema_path))
    } catch(err) {
      throw combineErrors([new Error('Problem creating app'), err])
    }

    app.use(function(req, res) {
      unhandled_requests = {req, res}
      res.status(500)
      res.send('was not caught by routes')
    })

    app.use(function(err, req, res) {
      // render the error page
      route_errors = err
      res.status(err.status || 500)
      res.send('error')
    })

    request = supertest(app)
  })

  afterEach(() => {
    if (unhandled_requests !== undefined) {
      const ur = unhandled_requests
      unhandled_requests = undefined
      throw new Error(`Recived uncaught request: ${ur}`)
    }
  })

  afterEach(() => {
    if (route_errors !== undefined) {
      const re = route_errors
      route_errors = undefined
      throw new re
    }
  })


  let virtualConsole, check_vc_error
  beforeEach(() => {
    virtualConsole = new jsdom.VirtualConsole()
    virtualConsole.on('log', console.log.bind(console)) //eslint-disable-line no-console

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

    check_vc_error = () => {
      if (vc_error !== undefined) {
        const err = vc_error
        vc_error = undefined
        throw err
      }
    }
  })

  afterEach(() => {check_vc_error()})

  afterEach(() => {
    MockXMLHttpRequest.onSend = undefined
    MockXMLHttpRequest.onCreate = undefined
  })

  async function load_page(form_type) {
    let page_html = (await request.get('/' + form_type)).text

    const run_if_loaded_for_test = 'run_if_loaded_for_test'
    const test_page_is_loaded = 'test_page_is_loaded'
    page_html += `
      <script>
        if (window.run_if_loaded_for_test !== undefined)
          window.${run_if_loaded_for_test}()
        else
          window.${test_page_is_loaded} = true
      </script>
    `

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
      if (window[test_page_is_loaded] === true) resolve()
      else {
        window[run_if_loaded_for_test] = resolve

        const timeout_error = new Error('Page load timed out')
        setTimeout(() => {
          try {
            check_vc_error()
            reject(timeout_error)
          } catch(err) {
            reject(err)
          }
        }, 1000)
      }
    })

    check_vc_error()

    return {
      dom,
      window,
      document: window.window.document,
      Event: window.Event,
    }
  }

  it('Page should load without error.', async function() {
    const form_type = 'form1'
    const { window } = await load_page(form_type)

    expect(window.form_type).to.equal(form_type)
    expect(window.apply_validation).to.be.a('function')
  })

  it('post request should be made on form submit', async function() {
    const form_type = 'form1'
    const { window, document, Event } = await load_page(form_type)
    const form = document.querySelector('form')

    all_good(document, form_type)

    window.XMLHttpRequest = MockXMLHttpRequest
    window.eval('XMLHttpRequest = window.XMLHttpRequest')

    const xhr = await new Promise((resolve, reject) => {
      MockXMLHttpRequest.onSend = resolve
      form.dispatchEvent(new Event('submit'))
      setTimeout(() => reject(new Error('timed out')), 50)
    })

    expect( xhr.method ).to.equalIgnoreCase('post')

    expect( xhr.body ).to.be.a('FormData')

    expect( _.fromPairs(Array.from(xhr.body.entries())) )
      .to.eql({
        input0: '1',
        input1: 'good input1',
        input2: 'GOOD INPUT2',
      })
  })

  it('page form_schema should not contain unneeded data')
})
