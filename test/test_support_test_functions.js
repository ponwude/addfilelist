/*global describe, it, beforeEach */

const { JSDOM } = require('jsdom')
const { window } = new JSDOM('<!DOCTYPE html><body></body>')
const { document, Event } = window.window

const chai = require('chai')
const { expect } = chai

const { set_val } = require('./support_test_functions.js')
set_val.Event = Event

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
          const set_val_promise = set_val(input, undefined, {dispatch: single_event})
          input.dispatchEvent(new Event('valid'))
          return set_val_promise
        })
    })

    it('multiple trigger events.', function() {
      return while_monitoring(input)
        .expect(multiple_events)
        .upon(() => set_val(input, undefined, {dispatch: multiple_events, resolve_events: []}))
    })
  })

  describe('should resolve on', function() {
    it('a single event.', function() {
      const set_val_promise = set_val(input, undefined, {dispatch: [], resolve_events: single_event})
      input.dispatchEvent(new Event(single_event))
      return set_val_promise
    })

    it('multiple events.', function() {
      return Promise.all(multiple_events.map(event => {
        const set_val_promise = set_val(input, undefined, {dispatch: [], resolve_events: multiple_events})
        input.dispatchEvent(new Event(event))
        return set_val_promise
      }))
    })

    it('setting the value when there are no resolve events.', function() {
      return set_val(input, undefined, {dispatch: [], resolve_events: []})
    })
  })

  it('dispatch events should not be dispatched before resolve listeners are set.', function() {
    const event = 'dispatch_&_hear'
    return set_val(input, undefined, {dispatch: event, resolve_events: event})
  })

  it('should set the input attribue value to val.', async function() {
    const value = 'this is a value'
    await set_val(input, value, {dispatch: [], resolve_events: []})

    expect(input.value).to.equal(value)
  })

  it('should reject when timeout elapses.', async function() {
    const expected_events = ['elapses', 'another']
    const timeout = 50

    const start_time = Date.now()
    try {
      await set_val(input, undefined, {dispatch: [], resolve_events: expected_events, timeout: 50})

      return Promise.reject(new Error('set_val should have rejected'))
    } catch(err) {
      const end_time = Date.now()

      expect(err.message).to.equal(`Did not hear any of the resolve_events: ${expected_events.join(', ')}.`)
      expect(end_time - start_time).to.be.above(timeout)
      expect(end_time - start_time).to.be.below(timeout + 10)
    }
  })
})
