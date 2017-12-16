/* Watches files and tests for changes and runs the correct test */

/*global process */
/*eslint-disable no-console */

const chokidar = require('chokidar')
const { exec } = require('child-process-promise')
const fs = require('then-fs')
const moment = require('moment')

const {dependency_tree, sort_test_order} = require('./dependency_tree.js')

const _ = require('lodash')


const config = {
  apply_validation: {
    build() {return exec('npx browserify -e apply_validation-entry.js -o apply_validation-bundle.js')},
    test_file: 'test/test_apply_validation.js',
    to_test: 'apply_validation.js',
  },
  while_monitoring: {
    test_file: 'test/test_while_monitoring.js',
    to_test: 'test/while_monitoring.js',
  },
  create_form_routes: {
    test_file: 'test/test_create_form_routes.js',
    to_test: 'create_form_routes.js',
    extra_dependancies: [
      'apply_validation-entry.js',
      'apply_validation-bundle.js',
    ],
  },
  form_builder: {
    test_file: 'test/test_form_builder.js',
    to_test: 'form_builder.js',
  },
  add_method: {
    test_file: 'test/test_add_method.js',
    to_test: 'add_method.js',
  },
  support_test_functions: {
    test_file: 'test/test_support_test_functions.js',
    to_test: 'test/support_test_functions.js',
  },
}


setup(config)


async function setup(config, queue_time=300) {

  const watch_files = new Set()
  const test_functions = {}
  const dep_trees = {}

  // create the function to run for each test
  for (const label in config) {
    if (config.hasOwnProperty(label)) {
      const {
        test_file,
        to_test,
        build,
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
        // function that will be called when the test for the specific label is called
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

  // priority of test runs. lower index has higher priority
  const test_order = sort_test_order(_.fromPairs(
    Object.keys(config).map(label => [
      label,
      {
        src: config[label].to_test,
        deptree: dep_trees[label],
      },
    ])
  ))

  const to_run_queue = new Set() // test labels that need to run
  let is_queuing = false
  try {
    chokidar.watch(Array.from(watch_files))
      .on('change', path => {
        for (const label in dep_trees) {
          if (dep_trees.hasOwnProperty(label) && dep_trees[label].contains(path)) {
            to_run_queue.add(label)
          }
        }

        if (!is_queuing) {
          is_queuing = true

          setTimeout(async function() {
            const tests2run = _.sortBy(
              Array.from(to_run_queue),
              t => test_order.indexOf(t)
            )

            // reset queue
            to_run_queue.clear()
            is_queuing = false

            for (let t2ri = 0; t2ri < tests2run.length; ++t2ri) {
              try {
                const test_func = test_functions[tests2run[t2ri]]
                const [passed, results] = await test_func()
                console.log(results)
                if (!passed) break
              } catch(err) {log_exit(err)}
            }
          }, queue_time)
        }
      })
  } catch(err) {log_exit(err)}

  try {
    await Promise.all(Object.values(test_functions).map(f => f()))
  } catch(err) {log_exit(err)}
}


function break_cml(str1='', str2='') {
  const label = ` ${str1.trim()} ${str2.trim()} ${moment().format('h:mm:ss')} `
  const num_dashes = Math.trunc((process.stdout.rows - label.length) / 2)
  const dashes = '-'.repeat(num_dashes)
  return dashes + label + dashes + '\n'
}

function log_exit(err) {
  if (err === undefined) err = new Error('log_exit requres an Error input.')
  console.error(err)
  process.exit(1)
}
