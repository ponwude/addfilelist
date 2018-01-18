/*global describe, it, beforeEach */

Joi = require('joi-browser') //eslint-disable-line no-global-assign, no-undef

const { JSDOM } = require('jsdom')

const apply_validation = require('../apply_validation.js') // testing

const form_builder = require('../form_builder.js')

const chai = require('chai')
chai.use(require('chai-dom'))
chai.use(require('sinon-chai'))
chai.should()

const sinon = require('sinon')

const while_monitoring = require('./while_monitoring.js')
const { set_val } = require('./support_test_functions.js')


describe('Test how the validation methods are applied.', function() {
  // quick links to form and input elements (set by beforeEach)
  const elements = {
    form: undefined,
    input_0: undefined,
    input_1: undefined,
    input: undefined, // same as input_0
    error_msg_0: undefined,
    error_msg_1: undefined,
    error_msg: undefined, // same as error_msg_0
    submit: undefined,
  }

  const schema = [
    {
      name: 'input_0',
      validate: Joi.string().alphanum(), //eslint-disable-line no-undef
    },
    {
      name: 'input_1',
      validate: Joi.number(), //eslint-disable-line no-undef
    },
    {
      // will modify the value
      name: 'input_3',
      validate: Joi.string().lowercase().allow(''), //eslint-disable-line no-undef
    },
  ]

  const input_0_vals = {good: 'a', bad: '@', error_msg: 'must only contain alpha-numeric characters'},
        input_1_vals = {good: '1', bad: 'b', error_msg: 'must be a number'},
        input_vals = input_0_vals


  beforeEach(function() {
    /* Re-initialize the page before each test */

    const dom = new JSDOM(
      '<!DOCTYPE html><body></body>',
      {
        runScripts: 'dangerously',
        resources: 'usable',
      }
    )
    window = dom.window //eslint-disable-line no-global-assign, prefer-destructuring
    document = window.window.document //eslint-disable-line no-global-assign, prefer-destructuring
    Event = window.Event //eslint-disable-line no-global-assign, prefer-destructuring

    set_val.Event = Event
    while_monitoring.Event = Event

    const form = form_builder(schema, { document })
    document.body.appendChild(form)
    apply_validation(form, schema)

    const [input_0, input_1, input_3, submit] = form.querySelectorAll('input')
    const [error_msg_0, error_msg_1] = form.querySelectorAll('.input-error-msg')

    Object.assign(elements, {
      form,
      input_0,
      input_1,
      input: input_0,
      input_3,
      submit,
      error_msg_0,
      error_msg_1,
      error_msg: error_msg_0,
      document,
      window,
    })
  })


  it('apply_validation should not add an error before input event.', function() {
    const { error_msg_0, error_msg_1 } = elements

    error_msg_0.should.have.text('')
    error_msg_1.should.have.text('')
  })

  describe('correct happenings for validation', function() {
    describe('valid value', function() {
      it('validation is applied to all form inputs', async function() {
        const { input_0, input_1 } = elements
        await set_val(input_0, input_0_vals.good, {resolve_events: 'valid'})
        await set_val(input_1, input_1_vals.good, {resolve_events: 'valid'})
      })

      it('valid event dispatched', function() {
        const { input } = elements
        return set_val(input, input_vals.good, {resolve_events: 'valid'})
      })

      it('error message removed', async function() {
        const { input, error_msg_0 } = elements
        error_msg_0.innerHTML = 'this should be removed on valid validation'
        await set_val(input, input_vals.good)

        error_msg_0.should.have.text('')
      })

      it('input-error class removed from input element', async function() {
        const invaid_class = 'input-error'
        const { input } = elements
        input.classList.add(invaid_class)
        await set_val(input, input_vals.good)

        input.should.not.have.class(invaid_class)
      })
    })

    describe('invalid value', function() {
      it('validation is applied to all form inputs', async function() {
        const { input_0, input_1 } = elements
        await set_val(input_0, input_0_vals.bad, {resolve_events: 'invalid'})
        await set_val(input_1, input_1_vals.bad, {resolve_events: 'invalid'})
      })

      it('invalid event dispatched', async function() {
        const { input } = elements
        return set_val(input, input_vals.bad, {resolve_events: 'invalid'})
      })

      it('error message added', async function() {
        const { input, error_msg_0 } = elements
        await set_val(input, input_vals.bad)

        error_msg_0.should.have.text(input_vals.error_msg)
      })

      it('input-error class added to input element', async function() {
        const { input } = elements
        await set_val(input, input_vals.bad)

        input.should.have.class('input-error')
      })

    })
  })

  it('No error when schema does not provide validation for one input', function() {
    const schema = [{name: 'input_0', validate: undefined}]
    apply_validation(elements.form, schema)
  })

  describe('event order', function() {
    it('waits for initial "blur" event for first validation', async function() {
      const { input } = elements
      const { good } = input_vals

      await while_monitoring(input)
        .do_not_expect(['valid', 'invalid'])
        .upon(() => input.dispatchEvent(new Event('keyup')))

      return set_val(input, good, {dispatch: 'blur', resolve_events: 'valid'})
    })

    it('after blur event, each "keyup" event (multiple) should trigger validation.', async function() {
      const { input } = elements
      await set_val(input, undefined, {dispatch: 'blur'})
      const { good, bad } = input_vals

      await set_val(input, good, {dispatch: 'keyup', resolve_events: 'valid'})
      await set_val(input, bad , {dispatch: 'keyup', resolve_events: 'invalid'})
      await set_val(input, good, {dispatch: 'keyup', resolve_events: 'valid'})
      await set_val(input, bad , {dispatch: 'keyup', resolve_events: 'invalid'})
    })

    describe('form submit', function() {
      describe('emits a validation event on the form element', function() {
        it('valid', function() {
          const { form, input_0, input_1 } = elements
          input_0.value = input_0_vals.good
          input_1.value = input_1_vals.good

          return while_monitoring(form).expect('valid').upon_event('submit')
        })

        it('invalid', function() {
          const { form, input_0, input_1 } = elements
          input_0.value = input_0_vals.bad
          input_1.value = input_1_vals.bad

          return while_monitoring(form).expect('invalid').upon_event('submit')
        })
      })

      it('does not use default form submit if javascript enabled', function() {
        /*
        JSDOM
        Form submission is not currently implemented, so it is not possible.
        https://github.com/tmpvar/jsdom/issues/123

        See affected line
        */
        /*eslint-disable no-console, no-unused-vars */
        const { form, input, document, window } = elements
        input.value = input_vals.bad

        const preventDefault = sinon.spy(),
              stopPropagation = sinon.spy()

        const submit_event = new Event('submit')
        submit_event.preventDefault = preventDefault
        submit_event.stopPropagation = stopPropagation

        form.dispatchEvent(submit_event)

        preventDefault.should.have.been.calledOnce
        stopPropagation.should.have.been.calledOnce
        document.body.should.contain(form) // affected line
      })

      it('inputs are validated', function() {
        const { form, input_0, input_1 } = elements

        input_0.value = input_0_vals.good
        input_1.value = input_1_vals.bad

        const validations = [
          while_monitoring(input_0).expect('valid').upon(),
          while_monitoring(input_1).expect('invalid').upon(),
        ]

        form.dispatchEvent(new Event('submit'))

        return Promise.all(validations)
      })

      it('validate sequence restarted', async function() {
        const { form, input } = elements
        const { good, bad } = input_vals

        await set_val(input, good, {dispatch: 'blur', resolve_events: 'valid'})
        await set_val(input, bad, {dispatch: 'keyup', resolve_events: 'invalid'})
        await while_monitoring(input)
          .expect('invalid')
          .upon(() => form.dispatchEvent(new Event('submit')))

        await while_monitoring(input)
          .do_not_expect(['valid', 'invalid'])
          .upon(() => {input.dispatchEvent(new Event('keyup'))})
        await set_val(input, bad, {dispatch: 'blur', resolve_events: 'invalid'})
        await set_val(input, good, {dispatch: 'keyup', resolve_events: 'valid'})
      })
    })
  })

  describe('validation returns a modified value', function() {
    it('input assumes modified value', async function() {
      const { input_3 } = elements

      await set_val(input_3, 'Hi', {resolve_events: 'valid'})

      input_3.should.have.value('hi')
    })

    it('cursor is put back in origional place', async function() {
      const cursor_position = 2
      const value = 'Hi there Chum'
      const { input_3 } = elements
      input_3.value = value
      input_3.selectionStart = input_3.selectionEnd = cursor_position

      await while_monitoring(input_3)
        .expect('valid')
        .upon_event('blur')

      input_3.should.have.value(value.toLowerCase())
      input_3.selectionStart.should.equal(cursor_position)
      input_3.selectionEnd.should.equal(cursor_position)
    })
  })
})
