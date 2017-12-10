/* Watches files and tests for changes and runs the correct test */

/*global process */
/*eslint-disable no-console */

const chokidar = require('chokidar')
const { exec } = require('child-process-promise')
const fs = require('then-fs')
const moment = require('moment')

const relations = [
  {
    testing: 'apply_validation',
    watch_files: [
      'apply_validation.js',
      'test/test_apply_validation.js',
    ],
    test_file: 'test/test_apply_validation.js',
  },
  {
    testing: 'while_monitoring',
    watch_files: [
      'test/while_monitoring/test_while_monitoring.js',
      'test/while_monitoring/while_monitoring.js',
    ],
    test_file: 'test/while_monitoring/test_while_monitoring.js',
  },
  {
    testing: 'create_form_routes',
    watch_files: [
      'test/test_create_form_routes.js',
      'create_form_routes.js',
    ],
    test_file: 'test/test_create_form_routes.js',
  },
  {
    testing: 'form_builder',
    watch_files: [
      'test/test_form_builder.js',
      'form_builder.js',
    ],
    test_file: 'test/test_form_builder.js',
  },
  {
    testing: 'add_method',
    watch_files: [
      'test/test_add_method.js',
      'add_method.js',
    ],
    test_file: 'test/test_add_method.js',
  },
]

const rate_limit_time = 200 // miliseconds

setup()


async function setup() {
  for (let ri = 0; ri < relations.length; ++ri) {
    const settings = relations[ri]

    try {
      await Promise.all([settings.test_file].concat(settings.watch_files).map(
        file => fs.access(file)
      ))
    } catch(err) {
      console.error(err)
      process.exit(1)
    }

    const run_mocha_test = async function() {
      try {
        const {stdout, stderr} = await exec([
          'echo "exec start" &&',
          `npx eslint ${settings.watch_files.join(' ')} &&`,
          `echo "eslint passed: ${settings.watch_files.join(' ')}" &&`,
          `echo "mocha results: ${settings.test_file}" &&`,
          `npx mocha ${settings.test_file} || true`,
        ].join(' '))

        console.log([
          break_cml('start', settings.testing),
          stdout,
          stderr,
          break_cml('end', settings.testing),
        ].join('\n'))

      } catch(err) {console.error(err)}
    }

    chokidar.watch(settings.watch_files, {interval: rate_limit_time})
      .on('change', rate_limit_drop(rate_limit_time, run_mocha_test))

    try {
      run_mocha_test()
    } catch(err) {
      console.error(err)
      process.exit(1)
    }

  }
}


function break_cml(str1='', str2='') {
  const label = ` ${str1.trim()} ${str2.trim()} ${moment().format('h:mm:ss')} `
  const num_dashes = Math.trunc((process.stdout.rows - label.length) / 2)
  const dashes = '-'.repeat(num_dashes)
  return dashes + label + dashes + '\n'
}


function rate_limit_drop(time_limit, func) {
  let last_run_time = 0

  return function() {
    const to_return = (last_run_time + time_limit < Date.now()) ?
      func(...arguments) :
      undefined

    last_run_time = Date.now()

    return to_return
  }
}
