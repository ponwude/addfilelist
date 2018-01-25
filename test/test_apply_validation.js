/*eslint-disable no-console, no-unused-vars */
/*global describe, it, beforeEach, afterEach, process */

Joi = require('joi-browser') //eslint-disable-line no-global-assign, no-undef

const { JSDOM } = require('jsdom')

const apply_validation = require('../apply_validation.js') // testing

const form_builder = require('../form_builder.js')

const chai = require('chai')
chai.use(require('chai-dom'))
chai.use(require('sinon-chai'))
chai.should()

const sinon = require('sinon')

require('./unhandled.js')

const while_monitoring = require('./while_monitoring.js')
const { set_val } = require('./support_test_functions.js')


describe('Test how the validation methods are applied.', function() {
  // quick links to form and input elements (set by beforeEach)
  const elements = {}

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
      name: 'input_2',
      validate: Joi.string().lowercase().allow(''), //eslint-disable-line no-undef
    },
  ]

  const input_0_vals = {good: 'a', bad: '@', error_msg: 'must only contain alpha-numeric characters'},
        input_1_vals = {good: '1', bad: 'b', error_msg: 'must be a number'},
        input_2_vals = {good: 'hi', bad: ''},
        input_vals = input_0_vals


  beforeEach(async function() {
    /* Re-initialize the page before each test */

    const dom = new JSDOM(
      `
        <!DOCTYPE html>
        <body></body>
        <script>
          window.isloaded = true
          if (window.check_page_load !== undefined)
            window.check_page_load()
        </script>
      `,
      {
        runScripts: 'dangerously',
        resources: 'usable',
      }
    )
    window = dom.window //eslint-disable-line no-global-assign, prefer-destructuring
    document = window.window.document //eslint-disable-line no-global-assign, prefer-destructuring
    // console.log('window.XMLHttpRequest', window.XMLHttpRequest)
    Event = window.Event //eslint-disable-line no-global-assign, prefer-destructuring

    set_val.Event = Event
    while_monitoring.Event = Event

    form_builder.document = document
    let form = form_builder(schema)
    document.body.appendChild(form)
    form = apply_validation(form, schema)

    const [input_0, input_1, input_2, submit] = form.querySelectorAll('input')
    const [error_msg_0, error_msg_1, error_msg_2] = form.querySelectorAll('.input-error-msg')

    Object.assign(elements, {
      form,
      input_0,
      input_1,
      input_2,
      input: input_0,
      submit,
      error_msg_0,
      error_msg_1,
      error_msg_2,
      error_msg: error_msg_0,
      document,
      window,
      all_good() {
        input_0.value = input_0_vals.good
        input_1.value = input_1_vals.good
        input_2.value = input_2_vals.good
      },
      all_bad() {
        input_0.value = input_0_vals.bad
        input_1.value = input_1_vals.bad
        input_2.value = input_2_vals.bad
      },
    })

    // wait for page load
    await new Promise((resolve, reject) => {
      if (window.isloaded === true) resolve()
      else {
        window.check_page_load = resolve

        setTimeout(() => reject(new Error('page did not load')), 100)
      }
    })
  })

  it('apply should return the form element', function() {
    const { form } = elements
    form.tagName.should.equal('FORM')
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
          const { form, all_good } = elements
          all_good()

          return while_monitoring(form).expect('valid').upon_event('submit')
        })

        it('invalid', function() {
          const { form, all_bad } = elements
          all_bad()

          return while_monitoring(form).expect('invalid').upon_event('submit')
        })
      })

      it('does not use default form submit if javascript enabled', function() {
        /*
        JSDOM
        Form submission is not currently implemented, so it is not possible to
        actually check if the default behavior is inhibited
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

      describe('validate sequence', function() {
        it('restarted on successful form submit', async function() {
          const { form, input } = elements
          const { good } = input_vals

          await set_val(input, good, {dispatch: 'blur', resolve_events: 'valid'})
          await set_val(input, good, {dispatch: 'keyup', resolve_events: 'valid'})
          await while_monitoring(input)
            .expect('valid')
            .upon(() => form.dispatchEvent(new Event('submit')))

          await while_monitoring(input)
            .do_not_expect(['valid', 'invalid'])
            .upon(() => {input.dispatchEvent(new Event('keyup'))})
          await set_val(input, good, {dispatch: 'blur', resolve_events: 'valid'})
        })

        it('not restarted on failed form submit', async function() {
          const { form, input } = elements
          const { bad } = input_vals

          await set_val(input, bad, {dispatch: 'blur', resolve_events: 'invalid'})
          await set_val(input, bad, {dispatch: 'keyup', resolve_events: 'invalid'})
          await while_monitoring(input)
            .expect('invalid')
            .upon(() => form.dispatchEvent(new Event('submit')))

          await while_monitoring(input)
            .do_not_expect(['valid', 'invalid'])
            .upon(() => {input.dispatchEvent(new Event('keyup'))})
          await set_val(input, bad, {dispatch: 'blur', resolve_events: 'invalid'})
        })
      })

      describe('submit handlers', function() {
        it('validated submit', function(done) {
          const { form, all_good } = elements

          const on_validated_submit = sinon.spy(),
                on_invalidated_submit = sinon.spy()

          apply_validation(form, schema, {
            on_validated_submit,
            on_invalidated_submit,
          })

          all_good()
          form.dispatchEvent(new Event('submit'))

          setTimeout(function() {
            try {
              on_invalidated_submit.should.not.have.been.called
              on_validated_submit.should.have.been.calledOnce
              on_validated_submit.should.have.been.calledWith(form)
              done()
            } catch(err) {
              done(err)
            }
          })
        })

        it('invalidated submit', function(done) {
          const { form, all_bad } = elements

          const on_validated_submit = sinon.spy(),
                on_invalidated_submit = sinon.spy()

          apply_validation(form, schema, {
            on_validated_submit,
            on_invalidated_submit,
          })

          all_bad()
          form.dispatchEvent(new Event('submit'))

          setTimeout(function() {
            try {
              on_validated_submit.should.not.have.been.called
              on_invalidated_submit.should.have.been.calledOnce
              on_invalidated_submit.should.have.been.calledWith(form)
              done()
            } catch(err) {
              done(err)
            }
          })
        })
      })
    })
  })

  describe('validation returns a modified value', function() {
    it('input assumes modified value', async function() {
      const { input_2 } = elements

      await set_val(input_2, 'Hi', {resolve_events: 'valid'})

      input_2.should.have.value('hi')
    })

    it('cursor is put back in origional place', async function() {
      const cursor_position = 2
      const value = 'Hi there Chum'
      const { input_2 } = elements
      input_2.value = value
      input_2.selectionStart = input_2.selectionEnd = cursor_position

      await while_monitoring(input_2)
        .expect('valid')
        .upon_event('blur')

      input_2.should.have.value(value.toLowerCase())
      input_2.selectionStart.should.equal(cursor_position)
      input_2.selectionEnd.should.equal(cursor_position)
    })
  })
})
