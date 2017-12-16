/* Watches files and tests for changes and runs the correct test */

/*global process */
/*eslint-disable no-console */

const chokidar = require('chokidar')
const { exec } = require('child-process-promise')
const fs = require('then-fs')
const { resolve:path_resolve } = require('path')
const moment = require('moment')

const {dependency_tree, sort_test_order} = require('./dependency_tree.js')

const _ = require('lodash')

const config = {
  apply_validation: {
    build() {
      return exec('npx browserify -e apply_validation-entry.js -o apply_validation-bundle.js')
    },
    // build_files: [
    //   'apply_validation-entry.js',
    //   'apply_validation-bundle.js',
    // ],
    // watch_files: [
    //   'apply_validation.js',
    //   'test/test_apply_validation.js',
    // ],
    test_file: 'test/test_apply_validation.js',
    to_test: 'apply_validation.js',
  },
  while_monitoring: {
    // watch_files: [
    //   'test//test_while_monitoring.js',
    //   'test/while_monitoring.js',
    // ],
    test_file: 'test/test_while_monitoring.js',
    to_test: 'test/while_monitoring.js',
  },
  create_form_routes: {
    // watch_files: [
    //   'test/test_create_form_routes.js',
    //   'create_form_routes.js',
    //   {file: 'form_template.html', skip_eslint: true},
    //   {file: 'apply_validation-bundle.js', skip_eslint: true},
    // ],
    test_file: 'test/test_create_form_routes.js',
    to_test: 'create_form_routes.js',
    extra_dependancies: [
      'apply_validation-entry.js',
      'apply_validation-bundle.js',
    ],
  },
  form_builder: {
    // watch_files: [
    //   'test/test_form_builder.js',
    //   'form_builder.js',
    // ],
    test_file: 'test/test_form_builder.js',
    to_test: 'form_builder.js',
  },
  add_method: {
    // watch_files: [
    //   'test/test_add_method.js',
    //   'add_method.js',
    // ],
    test_file: 'test/test_add_method.js',
    to_test: 'add_method.js',
  },
  support_test_functions: {
    // watch_files: [
    //   'test/support_test_functions.js',
    //   'test/test_support_test_functions.js',
    // ],
    test_file: 'test/test_support_test_functions.js',
    to_test: 'test/support_test_functions.js',
  },
}


setup(config)


async function setup(config, queue_time=300) {

  const watch_files = new Set()
  const test_functions = {}
  const dep_trees = {}

  for (const label in config) {
    if (config.hasOwnProperty(label)) {
      const {
        test_file,
        to_test,
        build,
        // build_files=[],
        extra_dependancies=[],
      } = config[label]

      try {
        const dep_tree = await dependency_tree(test_file)
        extra_dependancies.forEach(ed => dep_tree.add_child(ed))
        dep_tree.flatten().forEach(watch_files.add.bind(watch_files))
        dep_trees[label] = dep_tree
      } catch(err) {log_exit(err)}

      const file_paths = [test_file, to_test].concat(extra_dependancies)

      try {
        await Promise.all(file_paths.map(fp => fs.access(fp)))
      } catch(err) {log_exit(err)}


      const commands = []

      const eslint_files = [test_file, to_test]
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

      if (build !== undefined) commands.push(build)

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

      Object.freeze(commands)

      test_functions[label] = async function() {
        let results = break_cml('start', label)
        let passed = true

        for (let ci = 0; ci < commands.length; ++ci) {
          try {
            results += await commands[ci]()
          } catch(err) {
            if (err.stdout === undefined) log_exit(err)

            results += err.stdout
            passed = false

            break
          }
        }
        results += break_cml('end', label)

        return [passed, results]
      }

    }
  }

  const tf2label = _.invert(_.mapValues(config, t => path_resolve(t.test_file)))
  const test_order = sort_test_order(Object.values(dep_trees))
    .map(tf => tf2label[tf])

  console.log('-- test_order --\n' + '\t' + test_order.join('\n\t'))

  // const order_queue = []
  // let is_queuing = false
  // try {
  //   chokidar.watch(Array.from(watch_files))
  //     .on('change', path => {
  //       for (const label in dep_trees) {
  //         if (dep_trees.hasOwnProperty(label) && dep_trees[label].contains(path)) {
  //           order_queue.push(label)
  //         }
  //       }

  //       if (!is_queuing) {
  //         is_queuing = true

  //         setTimeout(async function() {
  //           const tests2run = _.sortBy(order_queue, t => test_order.indexOf(t))

  //           // reset queue
  //           order_queue.length = 0
  //           is_queuing = false

  //           for (let t2ri = 0; t2ri < tests2run.length; ++t2ri) {
  //             try {
  //               const test_func = test_functions[tests2run[t2ri]]
  //               const [passed, results] = await test_func()
  //               console.log(results)
  //               if (!passed) break
  //             } catch(err) {log_exit(err)}
  //           }
  //         }, queue_time)
  //       }
  //     })
  // } catch(err) {log_exit(err)}

  // try {
  //   await Promise.all(Object.values(test_functions).map(f => f()))
  // } catch(err) {log_exit(err)}
}


function break_cml(str1='', str2='') {
  const label = ` ${str1.trim()} ${str2.trim()} ${moment().format('h:mm:ss')} `
  const num_dashes = Math.trunc((process.stdout.rows - label.length) / 2)
  const dashes = '-'.repeat(num_dashes)
  return dashes + label + dashes + '\n'
}


// function rate_limit_drop(time_limit, func) {
//   let last_run_time = 0

//   return function() {
//     const to_return = (last_run_time + time_limit < Date.now()) ?
//       func(...arguments) :
//       undefined

//     last_run_time = Date.now()

//     return to_return
//   }
// }

// function get_file_name(file_objs, depth=0) {
//   if (typeof file_objs === 'string')
//     return file_objs

//   if (Array.isArray(file_objs)) {
//     if (depth > 0)
//       throw new Error('file_objs cannot contain Arrays.')

//     return file_objs.map(file => get_file_name(file, 1))
//   }

//   if (typeof file_objs === 'object') {
//     if (typeof file_objs.file !== 'string')
//       throw new TypeError(`Expected file_objs.file to be of type string but was actually type ${typeof file_objs.file}.`)

//     return file_objs.file
//   }

//   throw new Error('file_objs is not the correct type.')
// }

function log_exit(err) {
  if (err === undefined) err = new Error('log_exit requres an Error input.')
  console.error(err)
  process.exit(1)
}