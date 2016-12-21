/**
 * Created by chent on 2016/12/13.
 */
var gulp = require('gulp');
var Server = require('karma').Server;

/**
 * Run test once and exit
 */
gulp.task('default', function (done) {
    new Server({
        configFile: __dirname+'/karma.conf.js',
        singleRun: true,
        browsers: ['PhantomJS']
    }, done).start();
});