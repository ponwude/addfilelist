/*global describe it beforeEach */

/*eslint-disable no-global-assign, no-undef */
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

const while_monitoring = require('./while_monitoring/while_monitoring.js')


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

    const validity_1 = await set_val(input_1, input_1_vals.good)
    expect(validity_1).to.equal('valid')
    error_msg_1.should.have.text('')

    const validity_2 = await set_val(input_2, input_2_vals.good)
    expect(validity_2).to.equal('valid')
    error_msg_2.should.have.text('')
  })

  it('Error for both inputs.', async function() {
    const {input_1, input_2, error_msg_1, error_msg_2} = elements

    const validity_1 = await set_val(input_1, input_1_vals.bad)
    expect(validity_1).to.equal('invalid')
    error_msg_1.should.have.text(input_1_vals.error_msg)

    const validity_2 = await set_val(input_2, input_2_vals.bad)
    expect(validity_2).to.equal('invalid')
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

})


function set_val(input, val, dispatch=['blur', 'change']) {

  return new Promise(resolve => {
    input.value = val
    dispatch.forEach(e => input.dispatchEvent(new Event(e)))

    input.addEventListener('valid', () => resolve('valid'))
    input.addEventListener('invalid', () => resolve('invalid'))
  })
}

describe.only('set_val', function() {
  let input

  beforeEach(function() {
    input = document.createElement('input')
  })

  describe('should dispatch', function() {
    it('a single trigger event.', function() {
      const single_event = 'ev0'

      return while_monitoring(input)
        .expect(single_event)
        .upon(() => {
          set_val(input, undefined, single_event)
        })
    })

    it('multiple trigger events.', function() {
      const multiple_events = Object.freeze(['ev1', 'ev2'])

      return while_monitoring(input)
        .expect(multiple_events)
        .upon(() => {
          set_val(input, undefined, multiple_events)
        })
    })

    it('no trigger event.', function() {
      return
    })
  })

  it('description', function() {
    throw 'asdf'
  })
  // it('should trigger ', async function() {
  //   const expected_events = Object.freeze(['ev1', 'ev2'])
  //   while_monitoring(input)
  //     .expect('valid')
  //     .upon(() => input.dispatchEvent(new Event('b')))

  // })
})
