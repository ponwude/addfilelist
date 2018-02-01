/*eslint-disable no-console, no-unused-vars */
/*global Joi, describe, it, beforeEach, afterEach, process, __dirname */

const path = require('path')

Joi = require('joi-browser') //eslint-disable-line no-global-assign, no-undef

const { JSDOM } = require('jsdom')

const _ = require('lodash')

const chai = require('chai')
chai.use(require('chai-dom'))
chai.use(require('sinon-chai'))
chai.use(require('chai-as-promised'))
chai.should()
const { expect } = chai

const sinon = require('sinon')

const apply_validation = require('../apply_validation.js') // testing
const form_builder = require('../form_builder.js')

const while_monitoring = require('./while_monitoring.js')
const { set_val } = require('./support_test_functions.js')
const { addFileList } = require('./addFileList.js')
require('./unhandled.js')


async function load_dom(schema) {
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
  Event = window.Event //eslint-disable-line no-global-assign, prefer-destructuring

  set_val.Event = Event
  while_monitoring.Event = Event

  set_val.Event = Event
  while_monitoring.Event = Event

  form_builder.document = document
  let form = form_builder(schema)
  document.body.appendChild(form)
  form = apply_validation(form, schema)

  const inputs = _.keyBy(
    form.querySelectorAll('input:not([type=submit])'),
    'name'
  )
  Object.keys(inputs).should.have.lengthOf(schema.length)

  const error_msgs = _.fromPairs(_.zip(
    _.map(schema, 'name'),
    form.querySelectorAll('.input-error-msg')
  ))
  Object.keys(error_msgs).should.have.lengthOf(schema.length)

  // wait for page load
  await new Promise((resolve, reject) => {
    if (window.isloaded === true) resolve()
    else {
      window.check_page_load = resolve

      setTimeout(() => reject(new Error('page did not load')), 100)
    }
  })

  return { dom, window, document, Event, form, inputs, error_msgs }
}


describe('schema errors', function() {
  const schemas = {
    bad_validate: [
      {
        name: 'bad_validate',
        validate: 'not a Joi object or a function',
      },
    ],
  }

  it('throw error when validate is wrong', function() {
    return expect( load_dom(schemas.bad_validate) )
      .to.be.rejectedWith('bad_validate.validate needs to be a Joi validator or a function')
  })
})


describe('Test how the validation methods are applied.', function() {
  // quick links to form and input elements (set by beforeEach)
  const elements = {}

  const schema = [
    {
      name: 'input_0',
      validate: Joi.string().alphanum(),
    },
    {
      name: 'input_1',
      validate: Joi.number(),
    },
    {
      // will modify the value
      name: 'input_2',
      validate: Joi.string().lowercase().allow(''),
    },
  ]

  const input_0_vals = {good: 'a', bad: '@', error_msg: 'must only contain alpha-numeric characters'},
        input_1_vals = {good: '1', bad: 'b', error_msg: 'must be a number'},
        input_2_vals = {good: 'hi', bad: ''},
        input_vals = input_0_vals


  beforeEach(async function() {
    /* Re-initialize the page before each test */

    const { dom, window, document, Event, form } = await load_dom(schema)

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

describe('validate can be non-joi functions', function() {
  const schema = [
    {
      name: 'sync_no_change',
      validate(value) {
        if (value !== '3') throw new Error('must be 3')
        return '3'
      },
      good_value: '3',
      result_value: '3',
      bad_value: 'bad',
      err_msg: 'must be 3',
    },
    {
      name: 'sync_change',
      validate(value) {
        if (value !== '4') throw new Error('must be 4')
        return '5' // should return 5 not 4
      },
      good_value: '4',
      result_value: '5',
      bad_value: 'bad',
      err_msg: 'must be 4',
    },
    {
      name: 'async_no_change',
      validate(value) {return new Promise((resolve, reject) => {
        if (value !== '6') reject(new Error('must be 6')) //eslint-disable-line eqeqeq
        else resolve('6')
      })},
      good_value: '6',
      result_value: '6',
      bad_value: 'bad',
      err_msg: 'must be 6',
    },
    {
      name: 'async_change',
      validate(value) {return new Promise((resolve, reject) => {
        if (value != '7') reject('must be 7') //eslint-disable-line eqeqeq
        else resolve('8') // should resolve with 8
      })},
      good_value: '7',
      result_value: '8',
      bad_value: 'bad',
      err_msg: 'must be 7',
    },
  ]

  const schema_lookup = _.keyBy(schema, 'name')

  const elements = {}

  beforeEach(async function() {
    Object.assign(elements, await load_dom(schema))
    set_val.Event = elements.Event
  })

  describe('valid on good_value', function() {
    it('sync', function() {
      const input = elements.inputs.sync_no_change
      const { good_value } = schema_lookup.sync_no_change

      return set_val(input, good_value, {resolve_events: 'valid'} )
    })

    it('async', function() {
      const input = elements.inputs.async_no_change
      const { good_value } = schema_lookup.async_no_change

      return set_val(input, good_value, {resolve_events: 'valid'} )
    })
  })

  describe('no error message on good_value', function() {
    it('sync', async function() {
      const input = elements.inputs.sync_no_change,
            error_msg_element = elements.error_msgs.sync_no_change
      const { good_value } = schema_lookup.sync_no_change

      await set_val(input, good_value)

      error_msg_element.should.have.text('')
    })

    it('async', async function() {
      const input = elements.inputs.async_no_change,
            error_msg_element = elements.error_msgs.async_no_change
      const { good_value } = schema_lookup.async_no_change

      await set_val(input, good_value)

      error_msg_element.should.have.text('')
    })
  })

  describe('invalid on bad_value', function() {
    it('sync', function() {
      const input = elements.inputs.sync_no_change
      const { bad_value } = schema_lookup.sync_no_change

      return set_val(input, bad_value, {resolve_events: 'invalid'} )
    })

    it('async', function() {
      const input = elements.inputs.async_no_change
      const { bad_value } = schema_lookup.async_no_change

      return set_val(input, bad_value, {resolve_events: 'invalid'} )
    })
  })

  describe('correct error message on bad_value', function() {
    it('sync', async function() {
      const input = elements.inputs.sync_no_change,
            error_msg_element = elements.error_msgs.sync_no_change
      const { bad_value, err_msg } = schema_lookup.sync_no_change

      await set_val(input, bad_value)

      error_msg_element.should.have.text(err_msg)
    })

    it('async', async function() {
      const input = elements.inputs.async_no_change,
            error_msg_element = elements.error_msgs.async_no_change
      const { bad_value, err_msg } = schema_lookup.async_no_change

      await set_val(input, bad_value)

      error_msg_element.should.have.text(err_msg)
    })
  })

  describe('value changed to correct', function() {
    it('sync no value change', async function() {
      const input = elements.inputs.sync_no_change
      const { good_value } = schema_lookup.sync_no_change

      await set_val(input, good_value)

      input.should.have.value(good_value)
    })

    it('async no value change', async function() {
      const input = elements.inputs.async_no_change
      const { good_value } = schema_lookup.async_no_change

      await set_val(input, good_value)

      input.should.have.value(good_value)
    })

    it('sync value change', async function() {
      const input = elements.inputs.sync_change
      const { good_value, result_value } = schema_lookup.sync_change

      await set_val(input, good_value)

      input.should.have.value(result_value)
    })

    it('async value change', async function() {
      const input = elements.inputs.async_change
      const { good_value, result_value } = schema_lookup.async_change

      await set_val(input, good_value)

      input.should.have.value(result_value)
    })
  })
})

describe('file type inputs are validated', function() {
  // const elements = {}

  // const schema = [
  //   {
  //     name: 'file_meta',
  //     attr: {type: 'file'},
  //     validate: {
  //       meta: Joi.object().keys({
  //         size: Joi.number().less(100),
  //       }),
  //     },
  //     good_file: 'test_apply_validation_files/file_meta.text',
  //     bad_file: 'test_apply_validation_files/file_meta.bad',
  //   },
  //   // {
  //   //   name: 'file_contents',
  //   //   attr: {type: 'file'},
  //   //   validate: {
  //   //     contents: ,
  //   //   },
  //   //   good_file: 'test_apply_validation_files/file_contents.text',
  //   //   bad_file: 'test_apply_validation_files/file_contents.bad',
  //   // },
  //   // {
  //   //   name: 'file_meta_contents',
  //   //   attr: {type: 'file'},
  //   //   validate: {
  //   //     meta: ,
  //   //     contents: ,
  //   //   },
  //   //   good_file: 'test_apply_validation_files/file_meta_contents.text',
  //   //   bad_file: 'test_apply_validation_files/file_meta_contents.bad',
  //   // },
  // ]

  // let all_good, all_bad

  // beforeEach(async function() {
  //   const { dom, window, document, Event, form } = await load_dom(schema)

  //   const inputs = form.querySelectorAll('input[type=file]')
  //   const error_msgs = form.querySelectorAll('.input-error-msg')
  //   inputs.should.have.lengthOf(schema.length)
  //   error_msgs.should.have.lengthOf(schema.length)

  //   Object.assign(elements, {
  //     dom,
  //     window,
  //     document,
  //     Event,
  //     form,
  //   })

  //   all_good = () => {
  //     schema.forEach(({name, good_file}) => {
  //       const input = form.querySelector(`input[name=${name}`)
  //       addFileList(input, good_file)
  //     })
  //   }

  //   all_bad = () => {
  //     schema.forEach(({name, bad_file}) => {
  //       const input = form.querySelector(`input[name=${name}`)
  //       addFileList(input, bad_file)
  //     })
  //   }
  // })

  describe('schema checks when input.type="file"', function() {
    it('validate can be undefined', function() {
      return load_dom([{
        name: 'validate undefined',
        attr: {type: 'file'},
      }])
    })

    it('validate cannot be a function', function() {
      return expect(load_dom([{
        name: 'validate function',
        attr: {type: 'FILE'},
        validate() {},
      }])).to.be.rejectedWith('file input validator must be an Object with keys "meta" and/or "contents"')
    })

    it('when validate is an Object it must have "meta" and/or "contents" defined', function() {
      return expect(load_dom([{
        name: 'validate function',
        attr: {type: 'FILE'},
        validate: {},
      }])).to.be.rejectedWith('file input validator must be an Object with keys "meta" and/or "contents"')
    })
  })

  describe('check file meta data', function() {

    const resolve_path = file_name => path.join(
      __dirname,
      'test_apply_validation_files',
      file_name
    )

    const load_file_input = async (validate, file_names) => {
      const name = 'input_name'
      const { inputs, error_msgs } = await load_dom([{
        name,
        attr: {type: 'file'},
        validate,
      }])

      const input = inputs[name],
            error_msg = error_msgs[name]

      if (!Array.isArray(file_names)) file_names = [file_names]
      addFileList(input, file_names.map(resolve_path))

      return {input, error_msg}
    }

    describe('error if meta contains an invalid value', function() {
      describe('file to large', function() {
        it.only('joi', async function() {
          const joi_meta_validator = Joi.object().keys({
            size: Joi.number().max(-1),
          })

          const { input, error_msg } = await load_file_input(
            {meta: joi_meta_validator},
            'file_too_large.txt',
          )

          await while_monitoring(input).expect('invalid').upon_event('change')
          error_msg.should.have.text('file too large')
        })

        it('sync function', async function() {
          const error_text = 'file to large sync'
          const sync_meta_validator = file => {throw new Error(error_text)}

          const { input, error_msg } = await load_file_input(
            {meta: sync_meta_validator},
            'file_too_large.txt'
          )

          await while_monitoring(input).expect('invalid').upon_event('change')
          error_msg.should.have.text(error_text)
        })

        it('async function', async function() {
          const error_text = 'file too large async'
          const async_meta_validator = file => {
            return new Promise((resolve, reject) => {
              reject(new Error(error_text))
            })
          }

          const { input, error_msg } = await load_file_input(
            {meta: async_meta_validator},
            'file_too_large.txt'
          )

          await while_monitoring(input).expect('invalid').upon_event('change')
          error_msg.should.have.text(error_text)
        })
      })

      it('incorrect name (function)')
    })

    describe('no error if all meta is correct', function() {})
    describe('validator cannot modify meta value', function() {})
    it('no error if validation not defined for every meta propery (Joi only)')
    it('checks all files when input.files has more than one file')
    it('validator is a async function')
  })

  describe('check file contents', function() {
    it('for substring and find it (no error)')
    it('for substring and does not find it (error throw)')
    it('checks all files when input.files has more than one file')
    it('validator is a async function')
  })
})











