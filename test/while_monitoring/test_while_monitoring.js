/*global describe, it */

const while_monitoring = require('./while_monitoring.js')

const chai = require('chai')
const { expect } = chai
chai.should()

/*eslint-disable no-global-assign */
const { JSDOM } = require('jsdom')
const window = new JSDOM('<!DOCTYPE html><body></body>').window
const { document } = window.window
Event = window.Event //asdfkasdf check if this needs to be a global
/*eslint-enable no-global-assign */


describe('while_monitoring', function() {

  const event_type = 'et0'
  const multiple_event_types = Object.freeze(['et1', 'et2'])

  describe('expect', function() {
    describe('upon', function() {
      describe('should hear event', function() {
        it('single event', function() {
          return while_monitoring(document)
            .expect(event_type)
            .upon(() => document.dispatchEvent(new Event(event_type)))
        })

        it('multiple events', function() {
          return while_monitoring(document)
            .expect(multiple_event_types)
            .upon(() => {
              multiple_event_types.forEach(event_type => {
                document.dispatchEvent(new Event(event_type))
              })
            })
        })
      })

      describe('should reject because event is not heard', function() {
        it('single event', async function() {
          try {
            await while_monitoring(document)
              .expect(event_type)
              .upon(() => {})

            return Promise.reject(new Error('No promise rejection when expected event was not heard.'))
          } catch (err) {
            expect(err.message).to.equal(`Event (${event_type}) was not heard after cause.`)
            checkErrorStack(err)
          }
        })

        it('multiple events', async function() {
          for (let meti = multiple_event_types.length - 1; meti >= 0; --meti) {
            const event_type = multiple_event_types[meti]
            try {
              await while_monitoring(document)
                .expect(multiple_event_types)
                .upon(() => {})

              return Promise.reject(new Error('No promise rejection when expected event was not heard.'))
            } catch (err) {
              expect(err.message).to.equal(`Event (${multiple_event_types.join(', ')}) was not heard after cause.`)
              checkErrorStack(err)
            }
          }

          try {
            await while_monitoring(document)
              .expect(multiple_event_types)
              .upon(() => {})

            return Promise.reject(new Error('No promise rejection when expected event was not heard.'))
          } catch (err) {
            expect(err.message).to.equal(`Event (${multiple_event_types.join(', ')}) was not heard after cause.`)
            checkErrorStack(err)
          }
        })

        it('multiple events with one listened for event heard the same number of times as the length of the number of events being listened for.', async function() {
          const event_type = multiple_event_types[0]
          const unheard_events = multiple_event_types.copyWithout(event_type).join(', ')

          try {
            await while_monitoring(document)
              .expect(multiple_event_types)
              .upon(() => {
                for (let meti = multiple_event_types.length - 1; meti >= 0; --meti)
                  document.dispatchEvent(new Event(event_type))
              })

            return Promise.reject(new Error(`No promise rejection when expected events ${unheard_events} were not heard.`))
          } catch (err) {
            expect(err.message).to.equal(`Event (${unheard_events}) was not heard after cause.`)
            checkErrorStack(err)
          }
        })

      })

      it('with default argument', function() {
        const wm_prom = while_monitoring(document)
          .expect(event_type)
          .upon()

        document.dispatchEvent(new Event(event_type))

        return wm_prom
      })

    })

    describe('upon_event', function() {
      describe('should hear event', function() {
        it('single events', function() {
          return while_monitoring(document)
            .expect(event_type)
            .upon_event(event_type)
        })

        it('multiple events', async function() {
          const test_event = 'multiple dispatch test'
          const dispatch = () => {
            multiple_event_types.forEach(event_type => {
              document.dispatchEvent(new Event(event_type))
            })
          }
          document.addEventListener(test_event, dispatch)

          try {
            await while_monitoring(document)
              .expect(multiple_event_types)
              .upon_event(test_event)
          } catch (err) {
            return Promise.reject(err)
          } finally {
            document.removeEventListener(test_event, dispatch)
          }
        })
      })

      describe('should reject because event is not heard', function() {
        it('single event', async function() {
          try {
            await while_monitoring(document)
              .expect(event_type)
              .upon_event('some other event')

            return Promise.reject(new Error('No promise rejection when expected event was not heard.'))
          } catch (err) {
            expect(err.message).to.equal(`Event (${event_type}) was not heard after cause.`)
            checkErrorStack(err)
          }
        })

        it('multiple events', async function() {
          for (let meti = multiple_event_types.length - 1; meti >= 0; --meti) {
            const event_type = multiple_event_types[meti]

            const test_event = 'multiple dispatch test'
            const dispatch = () => document.dispatchEvent(new Event(event_type))
            document.addEventListener(test_event, dispatch)

            const unheard_events = multiple_event_types.copyWithout(event_type).join(', ')
            try {
              await while_monitoring(document)
                .expect(multiple_event_types)
                .upon_event(test_event)

              return Promise.reject(`Was not rejected even though events ${unheard_events} were called.`)
            } catch (err) {
              expect(err.message).to.equal(`Event (${unheard_events}) was not heard after cause.`)
              checkErrorStack(err)
            } finally {
              document.removeEventListener(test_event, dispatch)
            }
          }
        })
      })

      it('should throw error if causal_event is not a string', function() {
        expect(() => {
          while_monitoring(document).expect(event_type).upon_event(undefined)
        }).to.throw(TypeError, 'causal_event needs to be a String.')
      })
    })
  })

  describe('do_not_expect', function() {
    describe('upon', function() {
      describe('should throw exception when event is caught', function() {
        it('single event', async function() {
          try {
            await while_monitoring(document)
              .do_not_expect(event_type)
              .upon(() => document.dispatchEvent(new Event(event_type)))

            return Promise.reject(new Error('Promise should have rejected but did not.'))
          } catch (err) {
            expect(err.message).to.equal(`${event_type} was heard after cause.`)
            checkErrorStack(err)
          }
        })

        it('multiple events', async function() {
          for (let meti = multiple_event_types.length - 1; meti >= 0; meti--) {
            const event_type = multiple_event_types[meti]

            try {
              await while_monitoring(document)
                .do_not_expect(multiple_event_types)
                .upon(() => document.dispatchEvent(new Event(event_type)))

              return Promise.reject(new Error('Promise should have rejected but did not.'))
            } catch (err) {
              expect(err.message).to.equal(`${event_type} was heard after cause.`)
              checkErrorStack(err)
            }
          }

          // should list both events
          try {
            await while_monitoring(document)
              .do_not_expect(multiple_event_types)
              .upon(() => {
                multiple_event_types.forEach(event_type => {
                  document.dispatchEvent(new Event(event_type))
                })
              })

            return Promise.reject(new Error(`Did not throw exception when ${multiple_event_types.join(', ')} were heard.`))
          } catch (err) {
            expect(err.message).to.equal(`${multiple_event_types.join(', ')} was heard after cause.`)
            checkErrorStack(err)
          }
        })
      })

      describe('should resolve when no event is caught', function() {
        it('single event', async function() {
          return while_monitoring(document)
            .do_not_expect(event_type)
            .upon(() => {})
        })

        it('multiple events', async function() {
          return Promise.all(multiple_event_types.map(event_type => {
            return while_monitoring(document)
              .do_not_expect(event_type)
              .upon(() => {})
          }))
        })
      })

      it('with default argument', async function() {
        const wm_prom = while_monitoring(document)
          .do_not_expect(event_type)
          .upon()

        document.dispatchEvent(new Event(event_type))

        try {
          await wm_prom
        } catch (err) {
          expect(err.message).to.equal(`${event_type} was heard after cause.`)
          checkErrorStack(err)
        }
      })

    })

    describe('upon_event', function() {
      describe('should throw exception when event is caught', function() {
        it('single event', async function() {
          try {
            await while_monitoring(document)
              .do_not_expect(event_type)
              .upon_event(event_type)

            return Promise.reject(new Error('Promise should have rejected but did not.'))
          } catch (err) {
            expect(err.message).to.equal(`${event_type} was heard after cause.`)
            checkErrorStack(err)
          }
        })

        it('multiple events', async function() {
          for (let meti = multiple_event_types.length - 1; meti >= 0; meti--) {
            const event_type = multiple_event_types[meti]
            try {
              await while_monitoring(document)
                .do_not_expect(event_type)
                .upon_event(event_type)

              return Promise.reject(new Error(`Did not throw exception when ${event_type} (index ${meti}) was heard.`))
            } catch (err) {
              expect(err.message).to.equal(`${event_type} was heard after cause.`)
              checkErrorStack(err)
            }
          }

          // should list both events
          const test_event = 'multiple dispatch test'
          const dispatch = () => {
            multiple_event_types.forEach(event_type => {
              document.dispatchEvent(new Event(event_type))
            })
          }
          document.addEventListener(test_event, dispatch)
          try {
            await while_monitoring(document)
              .do_not_expect(multiple_event_types)
              .upon_event(test_event)

            return Promise.reject(new Error(`Did not throw exception when ${multiple_event_types.join(', ')} were heard.`))
          } catch (err) {
            expect(err.message).to.equal(`${multiple_event_types.join(', ')} was heard after cause.`)
            checkErrorStack(err)
          }
          finally {
            document.removeEventListener(test_event, dispatch)
          }
        })
      })

      describe('should resolve when no event is caught', function() {
        it('single event', async function() {
          return while_monitoring(document)
            .do_not_expect(event_type)
            .upon_event('some other event')
        })

        it('multiple events', async function() {
          return Promise.all(multiple_event_types.map(event_type => {
            return while_monitoring(document)
              .do_not_expect(event_type)
              .upon_event('some other event')
          }))
        })
      })

      it('should throw error if causal_event is not a string', function() {
        expect(() => {
          while_monitoring(document).expect(event_type).upon_event(undefined)
        }).to.throw(TypeError, 'causal_event needs to be a String.')
      })

    })
  })
})




{
  // define the Array method copyWithout
  const new_method = 'copyWithout'

  if(Array.prototype[new_method] === undefined) {
    Array.prototype[new_method] = function(without) {
      if (!Array.isArray(without))
        without = [without]

      return this.filter(v => !without.includes(v))
    }

    Object.defineProperty(Array.prototype, new_method, {enumerable: false})

  } else throw new Error("Overriding existing Array.prototype.copyWithout. Possible causes: New API defines the method, there's a framework conflict or you've got double inclusions in your code.")
}



describe('Array copyWithout', function() {
  const to_copy = Object.freeze([1, 2, 3])

  describe('Copies all', function() {
    it('Without is a single item.', function() {
      const without = 0

      const copy = to_copy.copyWithout(without)

      expect(copy).to.be.an.instanceof(Array)
      expect(copy).not.to.equal(to_copy)
      expect(copy).to.eql(to_copy)
    })

    it('Without is an Array.', function() {
      const without = [0]

      const copy = to_copy.copyWithout(without)

      expect(copy).to.be.an.instanceof(Array)
      expect(copy).not.to.equal(to_copy)
      expect(copy).to.eql(to_copy)
    })
  })

  describe('Copies without.', function() {
    it('Without is a single item.', function() {
      const without = 2

      const copy = to_copy.copyWithout(without)

      expect(copy).to.be.an.instanceof(Array)
      expect(copy).not.to.equal(to_copy)
      expect(copy).to.eql([1, 3])
    })

    it('Without has multiple items.', function() {
      const without = [0, 1, 3]

      const copy = to_copy.copyWithout(without)

      expect(copy).to.be.an.instanceof(Array)
      expect(copy).not.to.equal(to_copy)
      expect(copy).to.eql([2])
    })
  })
})


function checkErrorStack(err, multi_line_trace=true) {
  // if (err.stack[err.stack.length - 1] !== '\n')
  //   throw new Error('stack must end with new line.')

  const check_err = (function() {
    if (err.stack.search(/^Error.*/g) < 0)
      return new Error('No "Error: <message>" line found is err.stack.')

    const num_traces = (() => {
      const matches = err.stack.match(/\n +at.+/g)
      return matches === null ? 0 : matches.length
    })()

    if (num_traces <= 0)
      return new Error('No stack trace found.')

    if (multi_line_trace && num_traces < 2)
      return new Error('More than one trace required.')

    if (err.stack.search('timers.js') >= 0)
      return new Error('Lists wrong trace.')

    if (err.stack.search('while_monitoring.js') >= 0 &&
        err.stack.search(' at while_monitoring ') < 0)
      return new Error('Lists while_monitoring in trace.')
  })()

  if (check_err !== undefined) {
    const out_err = {}
    Object.getOwnPropertyNames(check_err).forEach(prop => {
      out_err[prop] = check_err[prop]
    })

    out_err.stack += `\n${'-'.repeat(20)} Original Error Below ${'-'.repeat(20)}\n`
    out_err.stack += err.stack

    throw Object.freeze(out_err)
  }
}

describe('Check Error stack', function() {
  it('for "Error: <message>" as first line.', function() {
    const stack = {stack: 'at repl:1:7'}

    expect(() => checkErrorStack(stack))
      .to.throw('No "Error: <message>" line found is err.stack.')
  })

  it('for at least one line of stack trace.', function() {
    const stack = {stack: 'Error: hi'}

    expect(() => checkErrorStack(stack, false))
      .to.throw('No stack trace found.')
  })

  it('for multi-line stack trace.', function() {
    const stack_no_trace = {stack: 'Error: hi'}
    expect(() => checkErrorStack(stack_no_trace, true))
      .to.throw('No stack trace found.')

    const stack_one_trace = {stack: 'Error: hi\n    at repl:1:7'}
    expect(() => checkErrorStack(stack_one_trace, true))
      .to.throw('More than one trace required.')
  })

  // it('for ending new line', function() {
  //   const stack_one_trace = {stack: 'Error: hi\nat repl:1:7'}
  //   expect(() => checkErrorStack(stack_one_trace, true))
  //     .to.throw('stack must end with new line.')

  //   const stack_two_traces = {stack: 'Error: hi\nat repl:1:7\nat repl:1:7'}
  //   expect(() => checkErrorStack(stack_two_traces, true))
  //     .to.throw('stack must end with new line.')
  // })

  it('Good trace no errors.', function() {
    const single_line_error = {stack: 'Error: hi\n    at repl:1:7'},
          multi_line_error = {stack: 'Error: hi\n    at repl:1:7\n    at ContextifyScript.Script.runInThisContext (vm.js:44:33)'}

    checkErrorStack(single_line_error, false)
    checkErrorStack(multi_line_error, false)
    checkErrorStack(multi_line_error, true)
  })

  it('Should not list timer.js errors.', function() {
    const stack = {stack: 'Error: et0 was heard after cause.\n    at ontimeout (timers.js:469:11)'}
    expect(() => checkErrorStack(stack, false))
      .to.throw('Lists wrong trace.')
  })

  it('Should not list while_monitoring in the trace.', function() {
    const stack = {stack: 'Error: et0 was heard after cause.\n    at Timeout._onTimeout (/Users/williamrusnack/Documents/form_database/test/while_monitoring/while_monitoring.js:132:22)'}
    expect(() => checkErrorStack(stack, false))
      .to.throw('Lists while_monitoring in trace.')

    const stack_ok = {stack: 'Error: Event (et0) was not heard after cause.\n      at while_monitoring (/Users/williamrusnack/Documents/form_database/test/while_monitoring/while_monitoring.js:48:47)'}
    checkErrorStack(stack_ok, false)
  })

})



describe('Custom method String.removeLinesWith', function() {
  const test_line = 'hi\nthere\nbob\nthis\nis\ngreat\n'

  it('Does not remove any lines.', function() {
    test_line.removeLinesWith('hey')
      .should.equal(test_line)
  })

  it('Remove multiple lines.', function() {
    test_line.removeLinesWith('hi')
      .should.equal('there\nbob\nis\ngreat\n')
  })

  it('Must contain multiple substrings to be removed.', function() {
    test_line.removeLinesWith(['th', 're'])
      .should.equal('hi\nbob\nthis\nis\ngreat\n')
  })
})

