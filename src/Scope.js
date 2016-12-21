/**
 * Created by chent on 2016/12/8.
 */

'use strict';

var _ = require('lodash');

function Scope(){
    //监视列表
    this.$$watchers = [];

    //保存dirty check 最后一个watcher, 减少下一次digest迭代的触发的数量，
    //这个其实有运气的成分，如果下一次变动的是最后一个watcher监视的scope,那么
    //本次记录的是最后一个watcher，在脏检查的时候仍然要检查到最后一个

    //更好的方法？ 用一个dirtywatch数组来记录有值变动的watcher，然后对
    // 这些watcher进行dirty check
    this.$$lastDirtyWatch = null;

    //延迟调用函数队列，digest内部调用
    this.$$asyncQueue = [];

    //相位  表示scope的执行状态
    //如果是$digest() 那么状态为"$digest"   如果是$apply()，那么状态为"$apply" 其他时刻都为null
    //用来给$evalAsync做状态判断以确定是否要新起一个digest
    this.$$phase = null;


    //延迟调用函数队列,digest外部调用
    this.$$applyAsyncQueue = [];

    //记录$$applyAsyncQueue延迟调用函数setTimeout是否存在
    //如果不存在，就需要新起一个
    this.$$applyAsyncId = null;

    //digest之后调用的函数队列
    this.$$postDigestQueue = [];

}

function initWatchValue(){}

Scope.prototype.$watch = function(watchFn,listenerFn,valueEq){
    var self = this;
    var watcher = {
        watchFn:watchFn,    //用来获取数据
        listenerFn:listenerFn || function(){},   //用来执行检查到数据变化后的处理
        valueEq:!!valueEq,     //用来明确相等是值比较还是引用比较  true 引用比较  false 值比较
        last:initWatchValue   //设置一个特殊的初始值  以防当新值为undefined时 ，listenerFn不触发
    };

    self.$$watchers.unshift(watcher);

    //防止在listenerFn中调用scope.$watch来增加一个新的watch的时候，由于$$lastDirtyWatch已经记录了上一个
    //watcher,所以，当$$watchers增加一个watcher的时候，脏检查不会检查到新增的一个（因为新增的还没变化过）
    //因此，在新增watcher的时候要把$$lastDirtyWatch的值初始化掉

    //??更好的方法？？  如果用dirtywatch来记录watcher的话，新增的要push到这里面，但是程序如何实现？
    self.$$lastDirtyWatch = null;

    //从setTimeout获得的灵感，返回一个删除函数，当这个函数被调用时，删除这个watcher
    return function(){
        var index = self.$$watchers.indexOf(watcher);
        if(index > -1){
            self.$$watchers.splice(index,1);

            //因为删除一个之后，length-1就会重新到第一个，当前记录的是第一个
            //如果第一个的dirtywatch不变，那么后面的永远执行不到
            //去除短路，确保后面的也能执行到
            self.$$lastDirtyWatch = null;
        }
    }
};

//监视一系列的变化
//这里的listenerFn 接受的参数为watchFns监视到的数组变化
Scope.prototype.$watchGroup = function(watchFns,listenerFn){
    var self = this;
    var newValues = new Array(watchFns.length);
    var oldValues = new Array(watchFns.length);


    //这个想法很好，使用原来的watcher 相当于在一个新的listenerFn中把数据组装成数组
    _.forEach(watchFns,function(watchFn,i){
        self.$watch(watchFn,fnction(newValue,oldValue){
            newValues[i] = newValue;
            oldValues[i] = oldValue;
            listenerFn(newValues,oldValues,self);
        });
    });

};

Scope.prototype.$digest = function(){
    var dirty;
    var TTL = 10;
    this.$$lastDirtyWatch = null;
    this.$beginPhase("$digest");

    //检查是否有setTimeout标识，如果有，立即调用外部延迟函数，并清楚setTimeout
    if(this.$$applyAsyncId){
        //清除
        clearTimeout(this.$$applyAsyncId);
        //全部调用延迟函数
        this.$$flushApplyAsync();
    }


    do{
        //如果在listener function中调用evalAsync,那么会在两次脏检查之间调用
        //如果在watch function中调用，那么会多push一个函数(watch在每次检查时都调用了，但是listener只在
        // !_.isEqual(newValue,oldValue)成立的时候调用，所以最后一次检查的时候listener不会调用)
        //在脏检查之间就调用了延迟函数，因为是shift()方法调用，因此只会执行一次
        while(this.$$asyncQueue.length){
            try{
                var asyncTask = this.$$asyncQueue.shift();
                asyncTask.scope.$eval(asyncTask.expression, asyncTask.locals);
            }catch(e){
                console.log(e);
            }
        }

        //根据检查结果确定是否dirty 如果watch存在变化，则dirty=true
        dirty = this.$$digestOnce();

        if((dirty || this.$$asyncQueue.length) && !(TTL--)){
            throw "10 digest iterations reached";
        }
    }while(dirty || this.$$asyncQueue.length);  //当watch 不再dirty的时候，把列表缓存的延迟执行的函数再执行一遍
                                                //问题是又执行了一遍脏检查，消耗资源
    this.$clearPhase();

    while(this.$$postDigestQueue.length){
        try {
            this.$$postDigestQueue.shift()();
        }catch(e){
            console.log(e);
        }
    }
};


Scope.prototype.$$digestOnce = function(){
    var self = this;
    var newValue,oldValue,valueEq,dirty = false;

    //每次$digest都要'检查一遍 watch list
    _.forEachRight(this.$$watchers,function(watcher){

        try {
            if(watcher){

                // 在watchFn中获取scope中的变量数据
                newValue = watcher.watchFn(self);

                //取出之前保存在watch.last的旧值
                oldValue = watcher.last;

                //比较标识符
                valueEq = watcher.valueEq;

                //如果新值不等于旧值，就要调用listnerFn ，并更新watcher.last
                if (!self.$$areEqual(newValue, oldValue, valueEq)) {

                    //引用比较的时候，不能用原来的引用直接watcher.last = newValue,而要克隆

                    watcher.last = valueEq ? _.cloneDeep(newValue) : newValue;

                    //记录上一次有改变的 watcher
                    //在for循环中，实际上只是记录了最后一个检测到值变动的watcher
                    //在下一次脏检查过程中，只需要执行到这个就可以了
                    //因为其他后面的没有触发脏检查
                    //？？问题  为什么不记录下这些有值变动的，下一次只执行这几个呢？
                    self.$$lastDirtyWatch = watcher;


                    // oldValue === initWatchValue ? newValue:oldValue 的作用？
                    // 隐藏 initWatchValue 防止泄露到对象外
                    watcher.listenerFn(newValue, (oldValue === initWatchValue ? newValue : oldValue), self);
                    dirty = true;

                    //又是同一个watcher? 不再执行了
                } else if (self.$$lastDirtyWatch === watcher) {
                    return false;
                }
            }
        }catch(e){
            console.log(e);
        }
    });

    return dirty;
};

//比较函数，根据valueEq字段来判断是值比较还是“引用比较”(深度的值比较)
Scope.prototype.$$areEqual = function(newValue,oldValue,valueEq){
    if(valueEq){
        return _.isEqual(newValue,oldValue);  //_.isEqual不是引用比较，而是deep compare
    }else{
        return newValue === oldValue || (typeof newValue === 'number' && typeof oldValue === 'number'
            && isNaN(newValue) && isNaN(oldValue));  //值比较，排除NaN
    }
};

//$eval 接受一个function做参数，并立即调用，传入scope作为function的参数，返回任何该function返回的值
//同时接受一个可选参数，也把locals传给function
Scope.prototype.$eval = function(expr,locals){
    return expr(this,locals);
};

//$evalAsync用来将函数延迟到 digest脏检查之前执行
//它不像setTimeout(f,0)，把执行时间交给浏览器，而是通过把需要延迟执行的函数push到队列中，
//当scope脏的时候执行，如果执行到scope内变量不再变化，
Scope.prototype.$evalAsync = function(expr,locals){
    var self = this;
    //判断当前相位 ，如果相位是空，那么增加一个$digest
    //为什么反复判断$$asyncQueue.length?
    //精妙！！！
    // 一开始是判断没有执行且没有任何延迟函数的时候
    // 增加一个延迟函数setTimeout，这个延迟函数不知道什么时间调用，但是肯定在这个$evalAsync以后，
    // 那么至少有一个函数被push到$$asyncQueue中，这个被push进去的函数也许在setTimeout之前被执行调了
    // 所以判断一下是否有必要执行一个新的$digest 以节约资源

    // 通常 我们的想法可能是先push到$$asyncQueue
    // while(!self.$$phase){setTimeout(function(){self.$digest()}} 虽然结果相同，但是资源消耗不同
    // 因为有时候可能不需要调用$digest
    if(!self.$$phase && !self.$$asyncQueue.length){
        setTimeout(function(){
           if(self.$$asyncQueue.length){
               self.$digest();
           }
        },0);
    }
    self.$$asyncQueue.push({scope:self,expression:expr,locals:locals});
};

//$apply 接受一个函数做参数，并调用$eval执行之，完成之后，调用$digest()开始脏检查
Scope.prototype.$apply = function(expr){
    try{
        this.$beginPhase("$apply");
        return this.$eval(expr);
    }
    finally{
        this.$clearPhase();
        this.$digest();
    }
};

//$applyAsync 在digest外部异步调用一个延迟函数,并且延迟调用$digest
//原始动机是处理HTTP响应:任何时候$http获得响应，响应处理函数和$digest都会被调用，
//这意味着每个http响应都要调用$digest，如果http调用频繁，那么资源消耗太大
//$applyAsync可以联合调用这些handler之后只调用一次$digest
Scope.prototype.$applyAsync = function(expr){
    var self = this;
    self.$$applyAsyncQueue.push(function(){
        self.$eval(expr); //放到立即执行函数队列中
    });

    //如果没有setTimeout 那么初始化一个$apply
    //否则，只要把延迟调用函数push到队列中就可以了
    //因为下次延迟调用的时候也可以调用到这些队列中的函数
    if(self.$$applyAsyncId === null){
        self.$$applyAsyncId = setTimeout(function(){
            //只调用了一次$digest  在后面的某个时刻，不要去在意什么时间
            //相当于使用while循环调用$eval后再执行一次$digest
            self.$apply(_.bind(self.$$flushApplyAsync,self));
        },0)
    }
};

//立即调用的代码 重复使用
Scope.prototype.$$flushApplyAsync = function(){
    while(this.$$applyAsyncQueue.length){
        try {
            this.$$applyAsyncQueue.shift()();
        }catch(e){
            console.log(e);
        }
    }
    this.$$applyAsyncId = null;
};

//相位标识
Scope.prototype.$beginPhase = function (phase) {
  if(this.$$phase){
      throw this.$$phase + " already in progress!";
  }
  this.$$phase = phase;
};

//结束相位
Scope.prototype.$clearPhase = function () {
    this.$$phase = null;
};


//function queue called after $digest
Scope.prototype.$postDigest = function(fn){
    this.$$postDigestQueue.push(fn);
};

module.exports = Scope;