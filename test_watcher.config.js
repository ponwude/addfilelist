const { exec } = require('child-process-promise')

module.exports = {
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
  dependency_tree: {
    test_file: '/test/test_dependency_tree.js',
    to_test: '/test/dependency_tree.js',
  },
}
