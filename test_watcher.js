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
    build() {
      return exec('npx browserify -e apply_validation-entry.js -o apply_validation-bundle.js')
    },
    watch_files: [
      'apply_validation.js',
      'test/test_apply_validation.js',
    ],
    test_file: 'test/test_apply_validation.js',
  },
  {
    testing: 'while_monitoring',
    watch_files: [
      'test//test_while_monitoring.js',
      'test/while_monitoring.js',
    ],
    test_file: 'test/test_while_monitoring.js',
  },
  {
    testing: 'create_form_routes',
    watch_files: [
      'test/test_create_form_routes.js',
      'create_form_routes.js',
      {file: 'form_template.html', skip_eslint: true},
      {file: 'apply_validation-bundle.js', skip_eslint: true},
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
  {
    testing: 'support_test_functions',
    watch_files: [
      'test/support_test_functions.js',
      'test/test_support_test_functions.js',
    ],
    test_file: 'test/test_support_test_functions.js',
  },
]

const rate_limit_time = 200 // miliseconds

setup()


async function setup() {
  const init_functions = []

  for (let ri = 0; ri < relations.length; ++ri) {
    const {testing, watch_files, test_file, build} = relations[ri]

    const file_objects = [test_file].concat(watch_files),
          file_paths = get_file_name(file_objects)

    try {
      await Promise.all(file_paths.map(fp => fs.access(fp)))
    } catch(err) {log_exit(err)}


    const commands = []

    const eslint_files = file_objects.filter(file => {
      const file_name = get_file_name(file)
      return !file.skip_eslint && file_name.endsWith('.js')
    })
    if (eslint_files.length > 0) {
      const eslint_files_str = eslint_files.join(' ')
      const exe_command = [
        `npx eslint ${eslint_files_str}`,
        `echo "eslint passed: ${eslint_files_str}"`,
      ].join(' && ')

      commands.push(async () => {
        try {
          return (await exec(exe_command)).stdout
        } catch(err) {throw err}
      })
    }

    if (build !== undefined)
      commands.push(build)

    if (test_file !== undefined) {
      const exe_command = [
        `echo "${test_file}"`,
        `npx mocha ${test_file}`,
      ].join(' && ')

      commands.push(async () => {
        try {
          return (await exec(exe_command)).stdout
        } catch(err) {throw err}
      })
    }

    const run_mocha_test = async function() {
      let results = break_cml('start', testing)
      for (let ci = 0; ci < commands.length; ++ci) {
        try {
          results += await commands[ci]()
        } catch(err) {
          if (err.stdout === undefined) log_exit(err)
          results += err.stdout
          break
        }
      }
      results += break_cml('end', testing)
      console.log(results)
    }

    try {
      chokidar.watch(file_paths, {interval: rate_limit_time})
        .on('change', rate_limit_drop(rate_limit_time, run_mocha_test))
    } catch(err) {log_exit(err)}

    init_functions.push(run_mocha_test)
  }

  try {
    await Promise.all(init_functions.map(f => f()))
  } catch(err) {log_exit(err)}
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

function get_file_name(file_objs, depth=0) {
  if (typeof file_objs === 'string')
    return file_objs

  if (Array.isArray(file_objs)) {
    if (depth > 0)
      throw new Error('file_objs cannot contain Arrays.')

    return file_objs.map(file => get_file_name(file, 1))
  }

  if (typeof file_objs === 'object') {
    if (typeof file_objs.file !== 'string')
      throw new TypeError(`Expected file_objs.file to be of type string but was actually type ${typeof file_objs.file}.`)

    return file_objs.file
  }

  throw new Error('file_objs is not the correct type.')
}

function log_exit(err) {
  if (err === undefined) err = new Error('log_exit requres an Error input.')
  console.error(err)
  process.exit(1)
}