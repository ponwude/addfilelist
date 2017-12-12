/*global describe, it, beforeEach */

/*eslint-disable no-global-assign */
const { JSDOM } = require('jsdom')
window = new JSDOM('<!DOCTYPE html><body></body>').window
const document = window.window.document
Event = window.Event
/*eslint-enable no-global-assign */

const chai = require('chai')
chai.use(require('chai-dom'))
// chai.should()
const { expect } = chai

const { set_val } = require('./support_test_functions.js')
const while_monitoring = require('./while_monitoring.js')


describe('set_val', function() {
  const single_event = 'ev0'
  const multiple_events = Object.freeze(['ev1', 'ev2'])

  let input
  beforeEach(function() {
    input = document.createElement('input')
  })

  describe('should dispatch', function() {
    it('a single trigger event.', function() {
      return while_monitoring(input)
        .expect(single_event)
        .upon(async () => {
          try {
            const set_val_promise = set_val(input, undefined, single_event)
            input.dispatchEvent(new Event('valid'))
            return set_val_promise
          } catch(err) {throw err}
        })
    })

    it('multiple trigger events.', function() {
      return while_monitoring(input)
        .expect(multiple_events)
        .upon(() => set_val(input, undefined, multiple_events, []))
    })
  })

  describe('should resolve on', function() {
    it('a single event.', function() {
      const set_val_promise = set_val(input, undefined, [], single_event)
      input.dispatchEvent(new Event(single_event))
      return set_val_promise
    })

    it('multiple events.', function() {
      return Promise.all(multiple_events.map(event => {
        const set_val_promise = set_val(input, undefined, [], multiple_events)
        input.dispatchEvent(new Event(event))
        return set_val_promise
      }))
    })

    it('setting the value when there are no resolve events.', function() {
      return set_val(input, undefined, [], [])
    })
  })

  it('dispatch events should not be dispatched before resolve listeners are set.', function() {
    const event = 'dispatch_&_hear'
    return set_val(input, undefined, event, event)
  })

  it('should set the input attribue value to val.', async function() {
    const value = 'this is a value'
    await set_val(input, value, [], [])

    expect(input).to.have.value(value)
  })

  it('should reject when timeout elapses.', async function() {
    const expected_events = ['elapses', 'another']

    try {
      await set_val(input, undefined, [], expected_events)
    } catch(err) {
      expect(err.message).to.equal(`Did not hear any of the resolve_events: ${expected_events.join(', ')}.`)
    }
  })
})
