/* Watches files and tests for changes and runs the correct test */

/*global process */
/*eslint-disable no-console */

const chokidar = require('chokidar')
const { exec } = require('child-process-promise')
const fs = require('then-fs')
const moment = require('moment')

const {dependency_tree, sort_test_order} = require('./dependency_tree.js')

const _ = require('lodash')

const config = require('./test_watcher.config.js')


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

      if (build !== undefined) commands.push(build)

      if (test_file !== undefined) {
        const exe_command = `npx mocha ${test_file}`

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
            if (err.stdout !== undefined) results += err.stdout
            if (err.stderr !== undefined) results += err.stderr

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
  const tests_passing = {}
  test_order.forEach(label => tests_passing[label] = false)

  const to_run_queue = new Set() // test labels that need to run
  let is_queuing = false
  try {
    chokidar.watch(Array.from(watch_files))
      .on('change', path => {
        for (const label in dep_trees) {
          if (dep_trees.hasOwnProperty(label) && dep_trees[label].contains(path)) {
            to_run_queue.add(label)

            // if dependant tests have not passed, add them too
            let dependencies_passing = true
            const label_order_index = test_order.indexOf(label)
            for (let toi = 0; toi < label_order_index; ++toi) {
              const dep_label = test_order[toi]

              if (!tests_passing[dep_label]) dependencies_passing = false
              if (!dependencies_passing) to_run_queue.add(dep_label)
            }
          }
        }

        if (!is_queuing) {
          is_queuing = true

          setTimeout(async function() {
            const init_toi = _.max(
              Array.from(to_run_queue).map(label => test_order.indexOf(label))
            )
            for (
              let toi = init_toi;
              toi < test_order.length;
              ++toi
            ) {
              to_run_queue.add(test_order[toi])
            }

            const tests2run = _.sortBy(
              Array.from(to_run_queue),
              t => test_order.indexOf(t)
            )

            // reset queue
            to_run_queue.clear()
            is_queuing = false

            for (let t2ri = 0; t2ri < tests2run.length; ++t2ri) {
              const label = tests2run[t2ri]
              try {
                const [passed, results] = await test_functions[label]()
                console.log(results)
                tests_passing[label] = passed
                if (!passed) break
              } catch(err) {log_exit(err)}
            }
          }, queue_time)
        }
      })
  } catch(err) {log_exit(err)}

  // run initial tests
  try {
    for (let toi = 0; toi < test_order.length; ++toi) {
      const label = test_order[toi]
      const [passed, results] = await test_functions[label]()
      tests_passing[label] = passed
      if (passed) console.log(`${label}: Passed`)
      else {
        console.log(`${label}: Failed`)
        console.log(results)
        break_cml('end', label)
        break
      }
    }
  } catch(err) {
    log_exit(err)
  }
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
