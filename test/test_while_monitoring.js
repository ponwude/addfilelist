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

const add_method = require('../add_method.js')

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

      describe('cause function', function() {
        it('fails with syncronous error.', async function() {
          const expected_error_msg = 'Expected Syncronous Error Message'
          try {
            await while_monitoring(document)
              .expect('No Events Expected')
              .upon(() => {throw new Error(expected_error_msg)})

            return Promise.reject('The exception trown by cause was not rejected.')
          } catch (err) {
            expect(err.message).to.equal(expected_error_msg)
          }
        })

        describe('returns a Promise that will', function() {
          it('reject.', async function() {
            const expected_error_msg = 'Expected Promise Rejection Message'
            try {
              await while_monitoring(document)
                .expect('No Events Expected')
                .upon(() => {return Promise.reject(new Error(expected_error_msg))})

              return Promise.reject('The returned rejected promise from cause was not rejected.')
            } catch (err) {
              expect(err.message).to.equal(expected_error_msg)
            }
          })

          it('resolve.', async function() {
            let is_resolved = false
            const to_resolve = new Promise(resolve => {
              is_resolved = true
              resolve()
            })

            try {
              await while_monitoring(document)
                .expect(event_type)
                .upon(() => {
                  document.dispatchEvent(new Event(event_type))
                  return to_resolve
                })
            } catch (err) {throw err}

            expect(is_resolved).to.be.true
          })
        })

        describe('is acually passed a Promise that', function() {

          // Not sure how to test this without rejecting with:
          // Error: Event (et0) was heard before cause called.
          it('resolves.'//,
            //   async function() {
            //   let is_resolved = false

            //   try {
            //     await while_monitoring(document)
            //       .expect(event_type)
            //       .upon(new Promise(resolve => {
            //         console.log('dispatchEvent')
            //         document.dispatchEvent(new Event(event_type))
            //         is_resolved = true
            //         resolve()
            //       }))
            //   } catch (err) {throw err}

            //   expect(is_resolved).to.be.true
            // }
          )

          it('rejects.', async function() {
            const reject_msg = 'Should Reject'

            try {
              await while_monitoring(document)
                .expect(event_type)
                .upon(Promise.reject(new Error(reject_msg)))

              return Promise.reject('The the cause reject promise was not rejected.')
            } catch (err) {
              expect(err.message).to.equal(reject_msg)
            }
          })
        })

        describe('is an async function that', function() {
          it('resolves.', async function() {
            let is_resolved = false

            try {
              await while_monitoring(document)
                .expect(event_type)
                .upon(async function() {
                  document.dispatchEvent(new Event(event_type))
                  await detach_thread(100)
                  is_resolved = true
                })
            } catch (err) {throw err}

            expect(is_resolved).to.be.true
          })

          it('throws error.', async function() {
            const expected_error_msg = 'test error message'

            try {
              await while_monitoring(document)
                .expect(event_type)
                .upon(async function() {
                  document.dispatchEvent(new Event(event_type))
                  await detach_thread(100)
                  throw new Error(expected_error_msg)
                })

              return Promise.reject(new Error('while_monitoring should not resolve when the cause async funtion throws an error.'))
            } catch (err) {
              expect(err.message).to.equal(expected_error_msg)
            }
          })

          it('returns an promise that resolves.', async function() {
            let is_resolved = false

            try {
              await while_monitoring(document)
                .expect(event_type)
                .upon(async function() {
                  document.dispatchEvent(new Event(event_type))
                  await detach_thread(100)
                  return long_promise(() => {is_resolved = true}, 100)
                })
            } catch (err) {throw err}

            expect(is_resolved).to.be.true
          })

          it('returns an promise that rejects.', async function() {
            const expected_error_msg = 'test error message'

            try {
              await while_monitoring(document)
                .expect(event_type)
                .upon(async function() {
                  document.dispatchEvent(new Event(event_type))
                  await detach_thread(100)
                  return long_promise(() => Promise.reject(new Error(expected_error_msg)), 100)
                })

              return Promise.reject(new Error('The cause async function returned a Promise that rejects and that rejected promise\'s error should have been thrown.'))
            } catch (err) {
              expect(err.message).to.equal(expected_error_msg)
            }
          })

        })

      })

      it('with default argument.', function() {
        const wm_prom = while_monitoring(document)
          .expect(event_type)
          .upon()

        document.dispatchEvent(new Event(event_type))

        return wm_prom
      })

      it('events heard before trigger', async function() {
        const wm = while_monitoring(document)
          .expect(['one', 'two', 'three'])

        document.dispatchEvent(new Event('one'))
        document.dispatchEvent(new Event('two'))
        document.dispatchEvent(new Event('four'))

        try {
          await wm.upon()

          return Promise.reject(new Error('Should have rejected because events were heard before upon trigger.'))
        } catch (err) {
          expect(err.message).to.equal('Before upon trigger the following events were heard: one, two')
        }
      })

      it('if all events seen before full timeout it should resolve before.', async function() {
        const timeout = 500,
              max_time = 50,
              start_time = Date.now()

        const wm = while_monitoring(document)
          .expect(['one', 'two'])
          .upon(() => {}, timeout)

        document.dispatchEvent(new Event('one'))
        document.dispatchEvent(new Event('two'))

        try {
          await wm
        } catch (err) {throw err}

        const end_time = Date.now()

        expect(end_time - start_time).to.be.below(max_time, 'is not resolving before timeout')
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

      it('events heard before trigger', async function() {
        const wm = while_monitoring(document)
          .expect(['one', 'two', 'three'])

        document.dispatchEvent(new Event('one'))
        document.dispatchEvent(new Event('two'))
        document.dispatchEvent(new Event('four'))

        try {
          await wm.upon_event('hi')

          return Promise.reject(new Error('Should have rejected because events were heard before upon trigger.'))
        } catch (err) {
          expect(err.message).to.equal('Before upon trigger the following events were heard: one, two')
        }
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

      describe('cause function', function() {
        it('fails with syncronous error.', async function() {
          const expected_error_msg = 'Expected Syncronous Error Message'
          try {
            await while_monitoring(document)
              .do_not_expect('No Events Expected')
              .upon(() => {throw new Error(expected_error_msg)})

            return Promise.reject('The exception trown by cause was not rejected.')
          } catch (err) {
            expect(err.message).to.equal(expected_error_msg)
          }
        })

        describe('returns a Promise that will', function() {
          it('reject.', async function() {
            const expected_error_msg = 'Expected Promise Rejection Message'
            try {
              await while_monitoring(document)
                .do_not_expect('No Events Expected')
                .upon(() => {return Promise.reject(new Error(expected_error_msg))})

              return Promise.reject('The returned rejected promise from cause was not rejected.')
            } catch (err) {
              expect(err.message).to.equal(expected_error_msg)
            }
          })

          it('resolve.', async function() {
            let is_resolved = false
            const to_resolve = new Promise(resolve => {
              is_resolved = true
              resolve()
            })

            try {
              await while_monitoring(document)
                .do_not_expect(event_type)
                .upon(() => to_resolve)
            } catch (err) {throw err}

            expect(is_resolved).to.be.true
          })
        })

        describe('is acually passed a Promise that', function() {

          // Not sure how to test this without rejecting with:
          // Error: Event (et0) was heard before cause called.
          it('resolves.'//,
            //   async function() {
            //   let is_resolved = false

            //   try {
            //     await while_monitoring(document)
            //       .do_not_expect(event_type)
            //       .upon(new Promise(resolve => {
            //         console.log('dispatchEvent')
            //         document.dispatchEvent(new Event(event_type))
            //         is_resolved = true
            //         resolve()
            //       }))
            //   } catch (err) {throw err}

            //   expect(is_resolved).to.be.true
            // }
          )

          it('rejects.', async function() {
            const reject_msg = 'Should Reject'

            try {
              await while_monitoring(document)
                .do_not_expect(event_type)
                .upon(Promise.reject(new Error(reject_msg)))

              return Promise.reject('The the cause reject promise was not rejected.')
            } catch (err) {
              expect(err.message).to.equal(reject_msg)
            }
          })
        })

        describe('is an async function that', function() {
          it('resolves.', async function() {
            let is_resolved = false

            try {
              await while_monitoring(document)
                .do_not_expect(event_type)
                .upon(async function() {
                  await detach_thread(100)
                  is_resolved = true
                })
            } catch (err) {throw err}

            expect(is_resolved).to.be.true
          })

          it('throws error.', async function() {
            const expected_error_msg = 'test error message'

            try {
              await while_monitoring(document)
                .do_not_expect(event_type)
                .upon(async function() {
                  await detach_thread(100)
                  throw new Error(expected_error_msg)
                })

              return Promise.reject(new Error('while_monitoring should not resolve when the cause async funtion throws an error.'))
            } catch (err) {
              expect(err.message).to.equal(expected_error_msg)
            }
          })

          it('returns an promise that resolves.', async function() {
            let is_resolved = false

            try {
              await while_monitoring(document)
                .do_not_expect(event_type)
                .upon(async function() {
                  await detach_thread(100)
                  return long_promise(() => {is_resolved = true}, 100)
                })
            } catch (err) {throw err}

            expect(is_resolved).to.be.true
          })

          it('returns an promise that rejects.', async function() {
            const expected_error_msg = 'test error message'

            try {
              await while_monitoring(document)
                .do_not_expect(event_type)
                .upon(async function() {
                  await detach_thread(100)
                  return long_promise(() => Promise.reject(new Error(expected_error_msg)), 100)
                })

              return Promise.reject(new Error('The cause async function returned a Promise that rejects and that rejected promise\'s error should have been thrown.'))
            } catch (err) {
              expect(err.message).to.equal(expected_error_msg)
            }
          })

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

      it('events heard before trigger', async function() {
        const wm = while_monitoring(document)
          .do_not_expect(['one', 'two', 'three'])

        document.dispatchEvent(new Event('one'))
        document.dispatchEvent(new Event('two'))
        document.dispatchEvent(new Event('four'))

        try {
          await wm.upon()

          return Promise.reject(new Error('Should have rejected because events were heard before upon trigger.'))
        } catch (err) {
          expect(err.message).to.equal('Before upon trigger the following events were heard: one, two')
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

      it('events heard before trigger', async function() {
        const wm = while_monitoring(document)
          .do_not_expect(['one', 'two', 'three'])

        document.dispatchEvent(new Event('one'))
        document.dispatchEvent(new Event('two'))
        document.dispatchEvent(new Event('four'))

        try {
          await wm.upon_event('hi')

          return Promise.reject(new Error('Should have rejected because events were heard before upon trigger.'))
        } catch (err) {
          expect(err.message).to.equal('Before upon trigger the following events were heard: one, two')
        }
      })

      it('if events seen before full timeout it should reject before.', async function() {
        const timeout = 500,
              max_time = 50,
              start_time = Date.now()

        const wm = while_monitoring(document)
          .do_not_expect(['one', 'two'])
          .upon(() => {}, timeout)

        document.dispatchEvent(new Event('one'))

        try {
          await wm

          return Promise.reject(new Error('Did not reject.'))
        } catch (err) {
          const end_time = Date.now()
          expect(end_time - start_time).to.be.below(max_time, 'is not rejecting before timeout')
        }
      })
    })
  })
})


add_method('copyWithout', Array, function(without) {
  if (!Array.isArray(without))
    without = [without]

  return this.filter(v => !without.includes(v))
})

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
    const stack = {stack: 'Error: et0 was heard after cause.\n    at Timeout._onTimeout (/Users/williamrusnack/Documents/form_database/test/while_monitoring.js:132:22)'}
    expect(() => checkErrorStack(stack, false))
      .to.throw('Lists while_monitoring in trace.')

    const stack_ok = {stack: 'Error: Event (et0) was not heard after cause.\n      at while_monitoring (/Users/williamrusnack/Documents/form_database/test/while_monitoring.js:48:47)'}
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


function detach_thread(timeout=100) {
  /* allows await to let go of the thread */
  return new Promise(resolve => {
    setTimeout(resolve, timeout)
  })
}

describe('detach_thread', function() {
  it('should allow another promise to fufill then finish.', async function() {
    let is_resolved = false
    // const resolve_later = Promise.resolve()
    //   .then(() => {is_resolved = true})
    const resolve_later = new Promise(resolve => {
      setTimeout(function() {
        is_resolved = true
        resolve()
      }, 1)
    })

    for (let i = 0; i < 1000; ++i) Math.sqrt(i) // take some time

    expect(is_resolved).to.be.false
    await detach_thread()
    expect(is_resolved).to.be.true

    return resolve_later
  })
})

function long_promise(after_func, timeout=100) {
  /* returns a Promise that with call after_func after the timeout */
  return Promise.resolve(timeout)
    .then(detach_thread)
    .then(after_func)
}

describe('long_promise', function() {
  it('should call after_func after the timeout.', async function() {
    const timeout = 200
    this.timeout(timeout + 100)
    const start_time = Date.now()

    let after_func_called = false
    try {
      await long_promise(() => after_func_called = true, timeout)
    } catch(err) {throw err}

    const total_time = Date.now() - start_time

    expect(after_func_called).to.be.true
    expect(total_time).to.be.at.least(timeout)
  })
})
