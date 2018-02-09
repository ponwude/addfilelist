module.exports = {
  // add_method: {
  //   test_file: 'test/test_add_method.js',
  //   to_test: 'add_method.js',
  // },
  // dependency_tree: {
  //   test_file: 'test/test_dependency_tree.js',
  //   to_test: 'dependency_tree.js',
  // },
  // form_builder: {
  //   test_file: 'test/test_form_builder.js',
  //   to_test: 'form_builder.js',
  // },
  // while_monitoring: {
  //   test_file: 'test/test_while_monitoring.js',
  //   to_test: 'test/while_monitoring.js',
  // },
  // support_test_functions: {
  //   test_file: 'test/test_support_test_functions.js',
  //   to_test: 'test/support_test_functions.js',
  // },
  // schema_checks: {
  //   test_file: 'test/test_load_schema.js',
  //   to_test: 'load_schema.js',
  // },
  // apply_validation: {
  //   test_file: 'test/test_apply_validation.js',
  //   to_test: 'apply_validation.js',
  // },
  // form_get_routes: {
  //   test_file: 'test/test_form_get_routes.js',
  //   to_test: 'form_get_routes.js',
  //   extra_dependancies: [
  //     'apply_validation.js',
  //     'test/form_schemas/form_test_schema.js',
  //   ],
  // },
  post_request_validator: {
    test_file: 'test/test_post_request_validator.js',
    to_test: 'post_request_validator.js',
    extra_dependancies: [
      'test/form_schemas/form_test_schema.js',
      'test/form_schemas/undefined_validation.js',
    ],
  },
  // post_to_database: {
  //   test_file: 'test/test_post_to_database.js',
  //   to_test: 'post_to_database.js',
  //   extra_dependancies: [
  //     'test/form_schemas/form_test_schema.js',
  //     'test/form_schemas/undefined_validation.js',
  //   ],
  // },
}
