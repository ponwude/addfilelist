const Joi = require('joi-browser')

const jsdom = require("jsdom")
const { JSDOM } = jsdom
window = new JSDOM(`<!DOCTYPE html><body></body>`).window
const { document } = window.window
Event = window.Event


const {
  form_builder: form_builder_func,
  apply_validation
} = require('../form_builder.js')
const form_builder = (spec, options) => form_builder_func(spec, Object.assign({document}, options))

const chai = require('chai')
chai.use(require('chai-dom'))
chai.should()
const {expect} = chai


describe('Create a form.', function() {
  it('Creates a form (does not check validate).', function() {
    const schema = [
      {
        label: 'Label 1',
        name: 'input_1',
        attr: {type: 'text', required: true},
        validate: true,
      },
      {
        label: 'Label 2',
        name: 'input_2',
        attr: {type: 'number'},
        validate: true,
      },
    ]

    const form = form_builder(schema)

    expect(form.tagName).to.equal('FORM')
    expect(form.children).to.have.lengthOf(schema.length + 1)  // input divs and submit

    Array.from(form.children)
      .filter((element, index) => index < schema.length)  // remove input submit element
      .forEach((input_div, div_index) => {
        // three elements label, input, error_text
        expect(input_div.tagName).to.equal('DIV')
        expect(input_div).to.have.length(3)

        const [label, input, error_text] = input_div.children,
              input_schema = schema[div_index]

        expect(label.tagName).to.equal('LABEL')
        expect(label.innerHTML).to.equal(input_schema.label)

        expect(input.tagName).to.equal('INPUT')
        expect(input).to.have.attr('name', input_schema.name)
        for (const is_attr in input_schema.attr) {
          if (input_schema.hasOwnProperty(is_attr)) {
            expect(input).to.have.attr(is_attr, input_schema.attr[is_attr])
          }
        }

        expect(error_text.tagName).to.equal('P')
        expect(error_text).to.have.class('input-error-msg')
        expect(error_text.innerHTML).to.equal('')  // no error message
      })

    const submit = form.children[schema.length]
    expect(submit.tagName).to.equal('INPUT')
    expect(submit).to.have.attr('type', 'submit')
  })

  it('Empty label should be created if "label" undefined.', function() {
    const schema = [
      {
        label: undefined,
        name: 'input_1',
        attr: {type: 'text', required: true},
        validate: true,
      },
    ]

    const label = form_builder(schema).children[0].firstChild
    expect(label.tagName).to.equal('LABEL')
    expect(label).to.have.text('')
  })

  it('Error text should be created if "validate" undefined.', function() {
    const schema = [
      {
        label: 'Label 1',
        name: 'input_1',
        attr: {type: 'text', required: true},
        validate: undefined,
      },
    ]

    const error_text = form_builder(schema).children[0].lastChild
    expect(error_text.tagName).to.equal('P')
    expect(error_text).to.have.class('input-error-msg')
    expect(error_text).to.have.text('')
  })

  it('Error should be thrown if "name" not defined.', function() {
    const schema = [
      {
        label: 'Label 1',
        name: undefined,
        attr: {type: 'text', required: true},
      },
    ]

    expect(() => form_builder(schema))
      .to.throw('No name specified for input.')
  })

  it('No error if "attr" is undefined (name should still be defined).', function() {
    const schema = [
      {
        label: 'Label 1',
        name: 'input_1',
        attr: undefined,
        validate: true
      },
    ]

    const input_div = form_builder(schema).children[0]
    expect(input_div).to.have.length(3)
    expect(input_div.children[1]).to.have.attr('name', schema[0].name)
  })

  describe('Submit input should be created with ', function() {
    it('default value of "Submit".', function() {
      const schema = []

      const submit_input = form_builder(schema).lastChild
      expect(submit_input.tagName).to.equal('INPUT')
      expect(submit_input).to.have.attr('type', 'submit')
      expect(submit_input).to.have.value('Submit')
    })

    it('custom value of "Push to Submit".', function() {
      const schema = []

      const submit_input = form_builder(schema, {submit_text: 'Push to Submit'}).lastChild
      expect(submit_input.tagName).to.equal('INPUT')
      expect(submit_input).to.have.attr('type', 'submit')
      expect(submit_input).to.have.value('Push to Submit')
    })
  })
})

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
      validate: Joi.string().alphanum(),
    },
    {
      name: 'input_2',
      validate: Joi.number(),
    },
  ]

  const input_1_vals = {good: 'a', bad: '@', error_msg: 'must only contain alpha-numeric characters'},
        input_2_vals = {good: '1', bad: 'b', error_msg: 'must be a number'}

  function set_val(input, val) {
    return new Promise(function(resolve, reject) {
      input.value = val
      input.dispatchEvent(new Event('brush'))
      input.dispatchEvent(new Event('change'))

      input.addEventListener('valid', () => resolve('valid'))
      input.addEventListener('invalid', () => resolve('invalid'))
    })
  }

  beforeEach(function() {
    /* Re-initialize the form before each test */
    const form = form_builder(schema)
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

