// Karma configuration
// Generated on Mon Dec 12 2016 11:28:42 GMT+0800 (中国标准时间)

module.exports = function(config) {
  config.set({
    // frameworks to use
    // available frameworks: https://npmjs.org/browse/keyword/karma-adapter
    frameworks: ['browserify','jasmine'],
    // list of files / patterns to load in the browser
    files: [
      'src/*.js',
      'test/*.js'
    ],

    plugins : [
      'karma-browserify',
      'karma-jasmine',
      'karma-phantomjs-launcher',
      "karma-chrome-launcher"
    ],

    // preprocess matching files before serving them to the browser
    // available preprocessors: https://npmjs.org/browse/keyword/karma-preprocessor
    preprocessors: {
      'src/*.js':['browserify'],
      'test/*.js': ['browserify' ]
    },
    // start these browsers
    // available browser launchers: https://npmjs.org/browse/keyword/karma-launcher
    browsers: ['Chrome'],
    browserify: {
      debug: true,
      bundleDelay: 2000 // Fixes "reload" error messages, YMMV!
    }
  })
};
