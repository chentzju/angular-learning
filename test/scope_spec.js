/**
 * Created by chent on 2016/12/8.
 */

var _ = require('lodash');
var Scope = require( '../src/scope');

describe("Scope",function(){
    it("can be constructed adn used as an object",function(){
        var scope = new Scope();
        scope.aProperty = 1;

        expect(scope.aProperty).toBe(1);
    })
});

describe("digest",function(){
    var scope;

    beforeEach(function(){
        scope = new Scope();
    });

    it("calls the listener function of a watch on first $digest",function(){
        var watchFn = function(){return "wat";};
        var listenerFn = jasmine.createSpy();
        scope.$watch(watchFn,listenerFn);

        scope.$digest();

        expect(listenerFn).toHaveBeenCalled();
    });

    it("calls the watch function with the scope as the argument",function(){
        var watchFn = jasmine.createSpy();
        var listenerFn = function(){};
        scope.$watch(watchFn,listenerFn);

        scope.$digest();  //get data  and call listener

        expect(watchFn).toHaveBeenCalledWith(scope);
    });


    it("calls the listener when the watch data changes",function(){
        scope.someValue = "a";
        scope.counter = 0;

        scope.$watch(
            function(scope){return scope.someValue;},
            function(newValue,oldValue,scope){scope.counter++}
        );

        expect(scope.counter).toBe(0);

        scope.$digest();

        expect(scope.counter).toBe(1);

        scope.$digest();

        expect(scope.counter).toBe(1);

        scope.someValue = 'b';

        scope.$digest();

        expect(scope.counter).toBe(2);
    });


    it("calls listener when watch value is first undefined",function(){
        scope.counter = 0;
        scope.$watch(
            function(scope){return scope.someValue;},
            function(newValue,oldValue,scope){scope.counter++}
        );
        scope.$digest();
        expect(scope.counter).toBe(1);

    });

    it("may have watchers that omit the listener function",function(){
       var watchFn = jasmine.createSpy().and.returnValue('something');

        //listener function is null
        scope.$watch(watchFn);

        scope.$digest();

        expect(watchFn).toHaveBeenCalled();
    });


    it("triggers chained watchers in the same digest",function(){
        scope.name = "Jane";

        scope.$watch(
            function(scope){return scope.nameUpper;},
            function(newValue,oldValue,scope){
                if(newValue){
                    scope.initial = newValue.substring(0,1)+'.';
                }
            }
        );

        scope.$watch(
            function(scope){return scope.name;},
            function(newValue,oldValue,scope){
                if(newValue){
                    scope.nameUpper = newValue.toUpperCase();
                }
            }
        );

        scope.$digest();

        expect(scope.initial).toBe('J.');
    });

    it("ends the digest when the last watch is clean",function () {
        scope.array = _.range(100);
        var watchExecutions = 0;

        _.times(100,function (i) {
            //一共有100个watcher 每个watcher返回scope.array的第i个值
            scope.$watch(
                function(scope){watchExecutions++;return scope.array[i]},
                function(newValue,oldValue,scope){}
            )
        });


        scope.$digest();

        expect(watchExecutions).toBe(200);

        scope.array[1] = 420;
        scope.array[2] = 420;
        scope.array[2] = 410;
        scope.$digest();
        expect(watchExecutions).toBe(303);
    });


    it("does not end digest so that new watches are not run",function () {
        scope.aValue = 'abc';
        scope.counter = 0;

        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function(newValue,oldValue,scope){
                scope.$watch(
                    function(scope){return scope.aValue},
                    function(newValue,oldValue,scope){scope.counter++;}
                )
        });


        scope.$digest();
        expect(scope.counter).toBe(1);

    });

    it("compares based on value if enabled",function(){
        scope.aValue = [1,2,3];
        scope.counter = 0;

        scope.$watch(
            function(scope){return scope.aValue;},
            function (newValue,oldValue,scope) {
                scope.counter++;
            },
            true
        );

        scope.$digest();
        expect(scope.counter).toBe(1);

        scope.aValue.push(4);
        scope.$digest();
        expect(scope.counter).toBe(2);

    });


    it("execute $eval function and returns result",function(){
        scope.aValue = 42;

        var result = scope.$eval(function(scope){
            return scope.aValue;
        });

        expect(result).toBe(42);

        result = scope.$eval(function(scope,arg){
            return scope.aValue + arg;
        },2);

        expect(result).toBe(44);
    });


    it("execute $apply function and returns restult",function(){
        scope.aValue = 42;
        scope.counter = 0;

        scope.$watch(
            function(scope){return scope.aValue;},
            function(newValue,oldValue,scope){
                scope.counter++;
            },
            false
        );

        var result = scope.$apply(function(scope){
            scope.aValue++;
            return scope.aValue;

        });

        expect(result).toBe(43);
        expect(scope.counter).toBe(1);
    });

    it("execute $evalAsync function later in the same cycle",function(){
        scope.aValue = [1,2,3];
        scope.asyncEvaluated = false;
        scope.asyncEvaluatedImmediately = false;

        scope.$watch(
            function(scope){
                return scope.aValue
            },
            function(newValue,oldValue,scope){
                scope.$evalAsync(function(scope){
                    scope.asyncEvaluated = true;
                });
                scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
            },
            true
        );

        scope.$digest();

        expect(scope.asyncEvaluated).toBe(true);
        expect(scope.asyncEvaluatedImmediately).toBe(false);

    });

    it("execute $evalAsync when watch is not dirty",function () {
        scope.aValue = [1,2,3];
        scope.asyncTime = 0;
        scope.counter = 0;

        scope.$watch(
            function(scope){
                //如果一直增加，那就一直有evalAsyn函数，造成死循环
                if(scope.asyncTime < 2){
                    scope.$evalAsync(function(scope){
                        scope.asyncTime++;
                    })
                }
                scope.counter++;
                return scope.aValue;
            },
            function(newValue,oldValue,scope){}
        );

        scope.$digest();

        expect(scope.asyncTime).toBe(2);
        expect(scope.counter).toBe(3);
    });


    it("execute $evalAsync when watch function always schedule async function dead loop",function () {
        scope.aValue = [1,2,3];
        scope.asyncTime = 0;

        scope.$watch(
            function(scope){
                //如果一直增加，那就一直有evalAsyn函数，造成死循环
                scope.$evalAsync(function(scope){
                        scope.asyncTime++;
                });
                return scope.aValue;
            },
            function(newValue,oldValue,scope){}
        );
        expect(function(){scope.$digest();}).toThrow();
    });

    it("has a $$phase field whose value is the current digest phase",function(){
       scope.aValue = [1,2,3];
        scope.phaseInWatchFunction = undefined;
        scope.phaseInLisenerFunction = undefined;
        scope.phaseInApplyFunction = undefined;

        scope.$watch(
            function(scope){
                scope.phaseInWatchFunction = scope.$$phase;
                return scope.aValue
            },
            function(newValue,oldValue,scope){

                scope.phaseInLisenerFunction = scope.$$phase;
            }
        );

        scope.$apply(function(scope){
            scope.phaseInApplyFunction = scope.$$phase;
        });

        expect(scope.phaseInApplyFunction).toBe("$apply");
        expect(scope.phaseInWatchFunction).toBe("$digest");
        expect(scope.phaseInLisenerFunction).toBe("$digest");
    });


    //
    it("schedules a digest in $evalAsync",function(done){
        scope.aValue = "abc";
        scope.counter =0;

        scope.$watch(
            function(scope){return scope.aValue;},
            function(newValue,oldValue,scope){
                scope.counter++;
            }
        );

        scope.$evalAsync(function(scope){
            scope.counter++;
        });

        expect(scope.counter).toBe(0);

        setTimeout(function(){
            expect(scope.counter).toBe(2);
            done();  //调用done表示异步操作已经完成
        },50)
    });

    //$applyAsync是异步执行，当$digest执行时，不会在这个循环中执行$applyAsync中的队列
    it("never execute $applyAsync function in the same cycle",function(done){
        scope.aValue = [1,2,3];
        scope.asyncApplied = false;

        scope.$watch(
            function(scope){return scope.aValue},
            function(newValue,oldValue,scope){
                scope.$applyAsync(function(){
                    scope.asyncApplied = true;
                });
            }
        );

        scope.$digest();

        expect(scope.asyncApplied).toBe(false);

        setTimeout(function () {
            expect(scope.asyncApplied).toBe(true);
            done();
        },50)
    });

    //当有多个$applyAsync时，只调用一次digest
    it("coalesces many calls to $applyAsync",function(done){
        scope.counter = 0;
        scope.dirtytime = 0;

        scope.$watch(
            function(scope){
                scope.counter++;
                return scope.aValue;
            },
            function(newValue,oldValue,scope){
                scope.dirtytime++;
            }
        );

        scope.$applyAsync(function(scope){
            scope.aValue = "abc";
        });

        scope.$applyAsync(function (scope) {
            scope.aValue = "def";
        });

        setTimeout(function () {
            expect(scope.dirtytime).toBe(1);
            expect(scope.counter).toBe(2);
            done();
        },50)

    });


    //如果一个digest正在运行，那么$applyAsync就不需要再次延迟调用digest了
    //而是在$digest中检查延迟调用的队列，直接把他们执行掉
    it("coalesces $applyAsync if digest first",function(done){
        scope.counter = 0;
        scope.dirtytime = 0;

        scope.$watch(
            function(scope){
                scope.counter++;
                return scope.aValue;
            },
            function(newValue,oldValue,scope){
                scope.dirtytime++;
            }
        );

        scope.$applyAsync(function(scope){
            scope.aValue = "abc";
        });

        scope.$applyAsync(function (scope) {
            scope.aValue = "def";
        });

        scope.$digest();

        expect(scope.dirtytime).toBe(1);
        expect(scope.counter).toBe(2);

        setTimeout(function () {
            expect(scope.dirtytime).toBe(1);
            expect(scope.counter).toBe(2);
            done();
        },50)

    });


    //检查在dirty check 的for循环中的报错，单个watcher的报错不能影响其他的watcher
    it("catch exception in dirty checking and continues",function(){

        scope.aValue = 'abc';
        scope.counter = 0;

        scope.$watch(
            function(scope){return scope.aValue;},
            function(newValue,oldValue,scope){
                throw "Error";
            }
        );

        scope.$watch(
            function (scope) {
                return scope.aValue;
            },
            function (newValue,oldValue,scope) {
                scope.counter++;
            }
        );

        scope.$digest();

        expect(scope.counter).toBe(1);
    });


    //在延迟调用函数中抛异常，$evalAsync执行的过程中，如果报错 ，那么整个脏检查就会停止
    //加上try-catch机制后，脏检查能在延迟函数出错的情况下依然执行
    //try打在while内部，确保一个函数报错不会影响队列中别的函数
    it("catch exception in $evalAsync",function (done) {

        scope.aValue = "abc";
        scope.counter = 0;

        scope.$watch(
            function (scope) {return scope.aValue;

            },
            function (newValue,oldValue,scope) {
                scope.counter++;
            }
        );


        scope.$evalAsync(function () {
            throw "Error";
        });

        setTimeout(function () {
            expect(scope.counter).toBe(1);
            done();
        },50)
    });


    //其实跟上面一个道理，只不过这个是在digest外部执行的，也是一样，不影响digest本身，
    //也不影响队列中其他函数
    it("catch exception in $applyAsync",function(done){
        scope.aValue = "abc";
        scope.counter = 0;

        scope.$watch(
            function (scope) {return scope.aValue;

            },
            function (newValue,oldValue,scope) {
                scope.counter++;
            }
        );


        scope.$applyAsync(function () {
            throw "Error";
        });

        setTimeout(function () {
            expect(scope.counter).toBe(1);
            done();
        },50)
    });


    //在一次$digest中在某个watch中删除自己
    //考虑到forEach循环的后面一个watcher前移，当这个删除后，后面那个就执行不到了
    //因为$watchers 队列是动态变化的
    it("destroy a watch in the same watch",function(){

        scope.aValue = "abc";

        scope.watchCaller = [];

        scope.$watch(
            function(scope){
                scope.watchCaller.push("first");
                return scope.aValue;
            }
        );

        var destroy = scope.$watch(
            function(scope){
                scope.watchCaller.push("second");
                destroy();
            }
        );

        scope.$watch(
            function(scope){
                scope.watchCaller.push("third");
                return scope.aValue;
            }
        );

        scope.$digest();

        expect(scope.watchCaller).toEqual(["first","second","third","first","third"]);

    });


    //在一次$digest中在某个watch中删除另一个watch
    //会出现什么情况呢？ 如果第一个删了第三个，但是第三个还没有返回啊
    //如果第三个删了第二个 ？没变化!
    //如果第一个在listener中删了第二个
    //后面删前面都没问题，前面删了后面；在forEach循环中，后面的又要被执行到一次，因为length少了以为，本来的length-1是第一个
    //现在 length-1还是第一个
    it("destroy a watch in the same watch",function(){
        scope.aValue = "abc";

        scope.counter = 0;

        scope.$watch(
            function(scope){
                return scope.aValue;
            },
            function(newValue,oldValue,scope){
                destroyWatch();
            }
        );

        var destroyWatch = scope.$watch(
            function(scope){
            }
        );

        scope.$watch(
            function(scope){
                return scope.aValue;
            },
            function(newValue,oldValue,scope){
                scope.counter++;
            }
        );

        scope.$digest();

        expect(scope.counter).toEqual(1);
    });


    //防止脏检查过程中，watcher都被删光了，但是while还在执行，那么就要判断watcher是否为空
    it("destroy many watcher in a watch",function(){
        scope.aValue = "abc";
        scope.counter = 0;

        var destroyWatch1 = scope.$watch(
            function(scope){
                destroyWatch1();
                destroyWatch2();
            },
            function(newValue,oldValue,scope){
            }
        );

        var destroyWatch2 = scope.$watch(
            function(scope){
                return scope.aValue;
            },
            function(newValue,oldValue,scope){
                scope.counter++;
            }
        );

        scope.$digest();

        expect(scope.counter).toBe(0);
    });

});

describe("$watchGroup",function () {
    var scope;
    beforeEach(function(){
        scope = new Scope();
    });

    it("takes watches as an array and calls listener with arrays",function () {
       var gotNewValues,gotOldValues;

        scope.aValue = 1;
        scope.bValue = 2;

        scope.$watchGroup(
            [
                function(scope){return scope.aValue},
                function(scope){return scope.bValue}
            ],
            function(newValues,oldValues,scope){
                gotNewValues = newValues;
                gotOldValues = oldValues;
            }
        );

        scope.$digest();

        expect(gotNewValues).toEqual([1,2]);
        expect(gotOldValues).toEqual([1,2]);

    });

});