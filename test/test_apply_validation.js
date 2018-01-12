/*global describe it beforeEach */

/*eslint-disable no-global-assign, no-undef, no-console */
Joi = require('joi-browser')

const { JSDOM } = require('jsdom')
window = new JSDOM('<!DOCTYPE html><body></body>').window
document = window.window.document
Event = window.Event
/*eslint-enable no-global-assign, no-undef */

const apply_validation = require('../apply_validation.js') // testing

const form_builder = require('../form_builder.js')

const chai = require('chai')
chai.use(require('chai-dom'))
chai.should()
const {expect} = chai

const while_monitoring = require('./while_monitoring.js')
const { set_val } = require('./support_test_functions.js')


describe('Test how the validation methods are applied.', function() {
  // quick links to form and input elements (set by beforeEach)
  const elements = {
    form: undefined,
    input_1: undefined,
    input_2: undefined,
    error_msg_1: undefined,
    error_msg_2: undefined,
    submit: undefined,
  }

  const schema = [
    {
      name: 'input_1',
      validate: 'Joi.string().alphanum()',
    },
    {
      name: 'input_2',
      validate: 'Joi.number()',
    },
  ]

  const input_1_vals = {good: 'a', bad: '@', error_msg: 'must only contain alpha-numeric characters'},
        input_2_vals = {good: '1', bad: 'b', error_msg: 'must be a number'}


  beforeEach(function() {
    /* Re-initialize the form before each test */
    const form = form_builder(schema, {document})
    apply_validation(form, schema)

    const [input_1, input_2, submit] = form.querySelectorAll('input')
    const [error_msg_1, error_msg_2] = form.querySelectorAll('.input-error-msg')

    Object.assign(elements,
      {form, input_1, input_2, submit, error_msg_1, error_msg_2})
  })


  it('apply_validation should not add an error before input event.', function() {
    const {error_msg_1, error_msg_2} = elements

    error_msg_1.should.have.text('')
    error_msg_2.should.have.text('')
  })

  it('No input error', async function() {
    const {input_1, input_2, error_msg_1, error_msg_2} = elements

    expect( await set_val(input_1, input_1_vals.good) )
      .to.equal('valid')
    error_msg_1.should.have.text('')

    expect( await set_val(input_2, input_2_vals.good) )
      .to.equal('valid')
    error_msg_2.should.have.text('')
  })

  it('Error for both inputs.', async function() {
    const {input_1, input_2, error_msg_1, error_msg_2} = elements

    expect( await set_val(input_1, input_1_vals.bad) )
      .to.equal('invalid')
    error_msg_1.should.have.text(input_1_vals.error_msg)

    expect( await set_val(input_2, input_2_vals.bad) )
      .to.equal('invalid')
    error_msg_2.should.have.text(input_2_vals.error_msg)
  })

  it('No error when schema does not provide validation for one input', function() {
    const schema = [
      {
        name: 'input_1',
        validate: undefined,
      },
    ]

    apply_validation(elements.form, schema)
  })

  describe('single blur and then multiple change events should trigger validation.', function() {
    describe('initial blur event', function() {
      it('valid', async function() {
        const { input_1 } = elements

        expect( await set_val(input_1, input_1_vals.good, 'blur') )
          .to.equal('valid')
      })

      it('invalid', async function() {
        const { input_1 } = elements

        expect( await set_val(input_1, input_1_vals.bad, 'blur') )
          .to.equal('invalid')
      })
    })

    describe('multiple change events', function() {
      beforeEach(async function() {
        const { input_1 } = elements

        await set_val(input_1, input_1_vals.good, 'blur')
        input_1.value = ''
      })

      it('valid change', async function() {
        const { input_1 } = elements

        for (let i = 0; i < 2; ++i) {
          expect( await set_val(input_1, input_1_vals.good, 'change') )
            .to.equal('valid')
        }
      })

      it('valid change', async function() {
        const { input_1 } = elements

        for (let i = 0; i < 2; ++i) {
          expect( await set_val(input_1, input_1_vals.bad, 'change') )
            .to.equal('invalid')
        }
      })
    })
  })

  describe('form submit', function() {
    it('inputs are validated', async function() {
      const { form, input_1, input_2 } = elements

      input_1.value = input_1_vals.good
      input_2.value = input_2_vals.bad

      try {
        const validations = [
          while_monitoring(input_1).expect('valid').upon(),
          while_monitoring(input_2).expect('invalid').upon(),
        ]

        form.dispatchEvent(new Event('submit'))

        await Promise.all(validations)

      } catch(err) {throw err}

    })

    it('validate sequence restarted after form submit', async function() {
      const { form, input_1 } = elements

      input_1.value = input_1_vals.bad
      try {
        await while_monitoring(input_1)
          .expect('invalid')
          .upon(() => form.dispatchEvent(new Event('submit')))
      } catch(err) {throw err}

      input_1.value = input_1_vals.good

      return set_val(input_1, input_1_vals.good, 'blur', 'valid')
    })
  })

})
