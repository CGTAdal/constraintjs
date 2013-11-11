module.exports = function(grunt) {
	var package = grunt.file.readJSON('package.json'); // Project configuration.

	var src_files = ["src/util.js", "src/core.js", "src/array.js", "src/map.js", "src/liven.js", "src/memoize.js", "src/binding.js",
					"src/state_machine/cjs_fsm.js", "src/state_machine/cjs_events.js", "src/state_machine/cjs_fsm_constraint.js",
					"src/template/cjs_template.js", "src/template/handlebars_template.js", "src/ir_builder/handlebars_ir.js",
					"src/template/parser/handlebars_parser.js", "src/template/parser/html_parser.js", "src/template/parser/jsep.js"];
	var enclosed_src_files = (["src/header.js"]).concat(src_files, "src/footer.js");

	grunt.initConfig({
		pkg: package,
		jshint: {
			build: {
				src: src_files
			}
		},
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
						'<%= grunt.template.today("yyyy-mm-dd h:MM:ss TT") %> */\n',
				report: 'gzip'
			},
			build: {
				src: "build/cjs.js", // Use concatenated files
				dest: "build/cjs.min.js"
			}
		},
		concat: {
			options: {
				banner: '/*! <%= pkg.name %> - v<%= pkg.version %> - ' +
						'<%= grunt.template.today("yyyy-mm-dd h:MM:ss TT") %> */\n',
				process: {
					data: {
						version: package.version // the updated version will be added to the concatenated file
					}
				}
			},
			js: {
				src: enclosed_src_files,
				dest: "build/cjs.js"
			}
		},
		qunit: {
			files: ['test/unit_tests.html']
		},
		clean: {
			build: ["build/"]
		},
		watch: {
			files: src_files.concat(['test/unit_tests.js', 'test/unit_tests/*.js']),
			tasks: ['concat', 'jshint', 'qunit']
		}
	});

	// Load the plugin that provides the "uglify" task.
	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-qunit');
	grunt.loadNpmTasks('grunt-contrib-watch');

	// Default task(s).
	grunt.registerTask('default', ['concat', 'uglify']);
	grunt.registerTask('test', ['concat', 'jshint', 'qunit']); // Skip uglification if just testing
};
