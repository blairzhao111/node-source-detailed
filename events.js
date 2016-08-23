// 'events' module
// 'event' module provides an extremely important type/class: EventEmitter, bascially all node core moduels are built upon this type.
// EventEmitter follows the Observer Pattern (publish/Subscribe).
// Its implementation in node is actually pretty easy because of Javascript first-class function.   
// Every EventEmitter instance has a 'clean' object(an instance of EventHandlers) that is used to 
// store (named event/listener) or (named event/listeners array) as key/value pairs.
// Named Event is just an string that describes and identifies the actual event.
// Listener is a handler function that gets invoked along with proper argument/arguments when its associated event is emitted.
// Listener stores in two different forms: 
//   1. If there is only one listener, then value will be that function in the key/value pair
//   2. If there are multiple listeners for a named event, then an array of listener will be the value in the key/value pair.
// Listeners could be added as normal handler functions that get invokde everytime when event emits. 
// Or they could be wrapped into a one-time invoked functions that get deleted when they are executed at first time.
// When a certain event is emitted, all current registered listeners get invoked synchronously, so the order of listeners matters.

'use strict';

var domain;

//helper type
//constructor for creating an "clean" object used as container for storing event/listener pairs.
//"clean" means EventHandlers.prototype object is the endpoint of prototype chain. There's no links to Object.prototype.
function EventHandlers() {
	EventHandlers.prototype = Object.create(null);
}

//EventEmitter Constructor, in current version this is the only function that 'events' module exposes.
function EventEmitter() {
	//run init function on every new creating instance of EventEmitter or any pass-in object using call/apply
	EventEmitter.init.call(this);
}

//'events' module now only exposes this EventEmitter Constructor function
module.exports = EventEmitter;

//maintains backwards compaibility
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.usingDomains = false;


EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;


//use accessor property to define defaultMaxListeners from all instances of EventEmitter.
var defaultMaxListeners = 10;

Object.defineProperty(EventEmitter, "defaultMaxListeners", {
	enumable: true,
	get: function(){
		return defaultMaxListeners;
	},
	set: function(arg){
		//force global console to be compiled.
		console;
		defaultMaxListeners = arg;
	}
});


/**************************************************************************************
*  Initialization for new created EventEmitter instance, denoted as emitter in docs
*  Four properties get added to every emitter after construction:
*  	emitter.domain, default set to null.
*  	emitter._event, default set to an empty EventHandlers object works as container.
*  	emitter._eventsCount, default set to 0.
*  	emitter._maxListeners, default set to undefined.
*/
//used to initialize new creating EventEmitter instance.
//after running through this initialization function, every instance of EventEmitter should have four properties:
//domain, _event, _eventsCount, _maxListeners
EventEmitter.init = function(){
	//inside this init function, 'this' refers to new creating instance of type EventEmitter

	//domain initialization section
	this.domain = null;
	if(EventEmitter.usingDomains){
		domain = domain || require('domain');
		if(domain.active && !(this instanceof domain.Domain)){
			this.domain = domain.active;
		}
	}

	//event/handlers pairs container initialization section
	//creates local container either this is no _event obj or _event obj is located inside EventEmitter.prototype obj
	if (!this._events || this._events === Object.getPrototypeof(this)._events) {
		this._events = new EventHandlers();
		//count property that belongs to EventEmitter instance to count the number of events.
		this._eventsCount = 0;		
	}

	//creates _maxListeners property in every instance
	this._maxListeners = this._maxListeners || undefined;
}


/************************************************************************
*  Set and Get maxListeners for individual EventEmitter instance.
*  Individual maxListeners setting is managed by _maxListeners property.
*/
//method to set maxListener on individual EventEmitter instance, range from 0 to unlimited...
//invokde on EventEmitter instance, like emitter.setMaxListeners(5)
EventEmitter.prototype.setMaxListeners = function(n){
	//check if argument is a valid argument, if not, throw a TypeError...
	if(typeof n !== 'number' || n<0 || isNaN(n)){
		throw new TypeError('"n" arguments must be a positive number');
	}

	this._maxListeners = n;
	return this; //return instance to enable chaining	
};

//method to retrieve maxListener on individual EventEmitter instance
//invokde on EventEmitter instance, like emitter.getMaxListeners()
EventEmitter.prototype.getMaxListeners = function(){
	//delegate work to private helper function $getMaxListeners
	return $getMaxListeners(this);
};

function $getMaxListeners(that) {
	//if there is no specific setting for individual EventEmitter instance, return general default setting for entire EventEmitter type
	if(that._maxListeners === undefined){
		return EventEmitter.defaultMaxListeners;
	}
	//else return maxListeners setting for individual EventEmitter instance that gets invoked on...
	return that._maxListeners;	
}

/**********************************************************************************************************
*  Emit method, emit a named event on emitter and all listeners to that event get called synchronously.
*  When there are more than one listener for any specific event, Listeners are not getting invoked directly when that event gets emitted. 
*  A copy of listeners array gets created and copied listeners get called one by one.
*/
// Quote from the source code comment:
// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.

//cases when no argument is passed to the listeners 
function emitNone(handlers, isFn, self) {
	if(isFn){
		//only one listener registered for the event.
		handlers.call(self);
	}else {
		//more than one listener, in this case there is an array of listeners
		//invoke all registered listeners synchronously.
		var len = handlers.length;
		var listeners = arrayClone(handlers, len);
		for(var i=0; i< len; ++i){
			listeners[i].call(self);
		}
	}
}

//cases when there is only one argument passed to the listeners 
function emitOne(handlers, isFn, self, arg1) {
	if(isFn){
		handlers.call(self, arg1);
	}else{
		var len = handlers.length;
		var listeners = arrayClone(handlers, len);
		for (var i = 0; i < listeners.length; ++i) {
			listeners[i].call(self, arg1);
		}
	}
}

//cases when there are two arguments passed to the listeners 
function emitTwo(handlers, isFn, self, arg1, arg2) {
	if(isFn){
		handlers.call(self, arg1, arg2);
	}else{
		var len = handlers.length;
		var listeners = arrayClone(handlers, len);
		for (var i = 0; i < listeners.length; ++i) {
			listeners[i].call(self, arg1, arg2);
		}
	}
}

//cases when there are three arguments passed to the listeners 
function emitThree(handlers, isFn, self, arg1, arg2, arg3) {
	if(isFn){
		handlers.call(self, arg1, arg2, arg3);
	}else{
		var len = handlers.length;
		var listeners = arrayClone(handlers, len);
		for (var i = 0; i < listeners.length; ++i) {
			listeners[i].call(self, arg1, arg2, arg3);
		}
	}
}

//cases when there is an array of arguments passed to the listeners 
function emitMany(handlers, isFn, self, args) {
	if(isFn){
		//chnage form call method to apply from an array of arguments
		handlers.apply(self, args);
	}else{
		var len = handlers.length;
		var listeners = arrayClone(handlers, len);
		for (var i = 0; i < listeners.length; ++i) {
			listeners[i].apply(self, args);
		}
	}
}

//emit method, it does three things: check error, handle domain and call listeners. 
//error event is special. If an error event occurs and no error listener has registered yet, that error would be thrown. Otherwise, emits like other events.
EventEmitter.prototype.emit = function(type){
	var er, handler, len, args, i, events, domain;
	var needDomainExit = false;
	var doError = (type === 'error'); //check if an error event

	events = this._events;
	if(events){
		//only set doError to true when an error event gets emitted and this's no registered error listener.
		doError = (doError && events.error == null);
	}else if(!doError){
		//when emitter does't have any listeners and event is not an error event, simply returning false indicated no listener gets called.
		return false;
	}

	domain = this.domain;

	//when error and no error event listener, then throw error.
	if(doError){
		//gets second arguments
		er = arguments[1];
		if(domain){
		//when there is domain
			if(!er){
				//if no second arguments passed in, creating a new one.
				er = new Error('Uncaught, unspecified "error" event');
			}
			er.domainEmitter = this;
			er.domain = domain;
			er.domainThrown = false;
			domain.emit('error', er);
		}else if(er instanceof Error){
		//no domain and er is an instance of Error obj, simply throw it.
			throw err;
		}else {
		//no domain and er is not an Error obj. Then creating a new error obj with info and throw it.
			var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
			err.context = er;
			throw err;
		}
		return false;
	}

	handler = events[type]; //references to listener/listeners for given event type

	//no registered listener found for given event type, then return false.
	if(!handler){
		return false;
	}

	if(domain && this !== process){
		domain.enter();
		needDomainExit = true;
	}

	//check one listener function or listeners array
	var isFn = (typeof handler === 'function');
	len = arguments.length;
	//invoke listener/listeners based on arguments length
	switch (len) {
		//fast cases
		case 1: 
			emitNone(handler, isFn, this);
			break;
		case 2: 
			emitOne(handler, isFn, this, arguments[1]);
			break;
		case 3: 
			emitTwo(handler, isFn, this, arguments[1], arguments[2]);
			break;
		case 4: 
			emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
			break;
		//slower
		default:
			args = new Array(len - 1);
			for(i = 1; i < len; i++){
				args[i-1] = arguments[i];
			}
			emitMany(handler, isFn, this, args);
	}

	if(needDomainExit){
		domain.exit();
	}

	return true;
};

/*
*	Attach event listener(function) to specified named event.
*	Listeners could have two forms:
*   1. Every time listener, gets invoked every time when associate event emits, remove this kind of listener needs explicits call removal methods.
*      Add through on(), addListener() and prependListener() methods	
*	2. One time listener, gets invoked only once then removed from the emitter
*	   Add through once() and prependOnceListener() methods
*/
//helper function that actually appends or prepends listeners to emitter.
function _addListener(target, type, listener, prepend) {
	var m;    //store the number of maxListeners of emitter instance 
	var events; //references to _events object of invoked emitter
	var existing; //references to listener/listeners array of given event type

	if(typeof listener !== 'function'){
		throw new TypeError('"listener" argument must be a function');
	}

	events = target._events;
	if(!events){
		//if no _events obj, creating one for the emitter and also reset _eventsCount counter.
		events = target._events = new EventHandlers();
		target._eventsCount = 0;
	}else{
		// To avoid recursion in the case that type === "newListener"! Before
		// adding it to the listeners, first emit "newListener".
		if(events.newListener){
		//If there are any listeners for 'newListener' event, emit 'newListener' event
			target.emit('newListener', type, listener.listener?listener.listener:listener);
		
	      	// Re-assign `events` because a newListener handler could have caused the
	      	// this._events to be assigned to a new object
	      	events = target._events;
		}

		existing = events[type];
	}

	if(!existing){
		//if no listener has registered for given event type
		existing = events[type] = listener;
		//update event counter 
		++target._eventsCount;
	}else{
		if(typeof existing === 'function'){
			//only have one listener attached
			existing = events[type] = prepend ? [listener, existing] : [existing, listener];
		}else{
			//already have an array of listeners
			if(prepend){
				existing.unshift(listener);
			}else{
				existing.push(listener);
			}
		}
	}

	//check for listener leak
	if(!existing.warned){
		m = $getMaxListeners(target);
		if(m && m > 0 && existing.length > m){
			existing.warned = true;
			//process.emitWarning() and process.on("warning") are new added to the node-v6,
			//checkout this post for more details:
			//https://medium.com/@jasnell/introducing-process-warnings-in-node-v6-3096700537ee#.xtezd21hr
	        process.emitWarning('Possible EventEmitter memory leak detected. ' +
	                            `${existing.length} ${type} listeners added. ` +
	                            'Use emitter.setMaxListeners() to increase limit');
		}
	}

	return target; //return emitter obj to enable chaining.
}

//appends new listener to the given type of event
EventEmitter.prototype.addListener = function addListener(type, listener){
	return _addListener(this, type, listener, false);
};

//alias to addListener method
EventEmitter.prototype.on = EventEmitter.prototype.addListener;

//prepends new listener to the given type of event
EventEmitter.prototype.prependListener = function prependListener(type, listener) {
	return _addListener(this, type, listener, true);
};

//helper function to return an once listener wrapper function that wraps actual listener.
//Actual listener function is referenced through wrapperFunction.listener property.
function _onceWrap(target, type, listener) {
	//fired variable gets preserved through closure.
	var fired = false;
	function g() {
		//remove wrapper function 
		target.removeListener(type, g);
		//if haven't fired, fire actual listener function.
		if(!fired){
			fired = true;
			listener.apply(target, arguments);
		}
	}
	//preserve reference to actual listener function through listener property on wrapper
	g.listener = listener;
	return g;
}

//appends once wrapper function returned by invoking _onceWrap() function to emitter
EventEmitter.prototype.once = function once(type, listener){
	if(typeof listener !== 'function'){
		throw new TypeError('"listener" argument must be a function');
	}
	this.on(type, _onceWrap(this, type, listener));
	return this;
};

//prepends once wrapper function returned by invoking _onceWrap() function to emitter
EventEmitter.prototype.prependOnceListener = function prependOnceListener(type, listener){
	if(typeof listener !== 'function'){
		throw new TypeError('"listener" argument must be a function');
	}
	this.prependListener(type, _onceWrap(this, type, listener));
	return this;	
};

/*
* Removal method for removing listener/listeners for emitter.
* removeListener aims for removing single listener from emitter
* removeAllListener aims for removing all listeners(not provide a type) or removing all listeners for a given type(provide a type). 
*/
EventEmitter.prototype.removeListener = function removeListener(type, listener) {
	var list, events, position, i, originalListener;

	if(typeof listener !== 'function'){
		throw new TypeError('"listener" argument must be a function');
	}

	events = this._events;
	if(!events){
		return this;
	}

	list = events[type];
	if(!list){
		return this;
	}

	//when there is only one listener or one oncewrap listener for given event
	if(list === listener || (list.listener && list.listener===listener)){
		if(--this._eventsCount === 0){
			this._events = new EventHandlers();
		}else{
			delete events[type];
			if(events.removeListener){
				this.emit('removeListener', type, list.listener || listener);
			}
		}
	}else if(typeof list !== 'function'){
	//when there is a listener array from given event type.
		position = -1;

		//check from back to front in listener array,
		//if find match, break and keep track of match's index in array.
		for(i = list.length; i-- > 0;){
			if(list[i] === listener || list[i].listener === listener){
				//get original listener from onceWrapper listener
				originalListener = list[i].listener;
				position = i;
				break;
			}
		}

		//no listener matches given listener reference 
		if(position < 0){
			return this;
		}

		if(list.length === 1){
			//matched listener is the only remaining listener in this listener array.
			list[0] = undefined;
			if(--this._eventsCount === 0){
				this._events = new EventHandlers();
				return this;
			}else{
				delete events[type];
			}
		}else {
			//remove matched listener from listener array.
			spliceOne(list, position);
		}

		//if there are any listeners from 'removeListener' event, 
		//emit event and fire listeners one by one.
		if(events.removeListener){
			this.emit('removeListener', type, originalListener || listener);
		}
	}
	
	return this;
};

EventEmitter.prototype.removeAllListeners = function removeAllListeners(type) {
	var listeners, events;

	events = this._events;
	if(!events){
		return this;
	}

	//if there are no listeners listening to 'removeListener' event
	if(!events.removeListener){
		if(arguments.length === 0) {
			this._events = new EventHandlers();
			this._eventsCount = 0;
		}else if(events[type]) {
			if(--this._eventsCount === 0){
				this._events = new EventHandlers();
			}else{
				delete events[type];
			}
		}
		return this;
	}

	//there is/are listener/listeners for 'removeListener' event
	//when no event is specified.
	if(arguments.length === 0){
		var keys = Object.keys(events);
		for(var i = 0, key; i < keys.length; ++i){
			key = keys[i];
			if(key === 'removeListener'){continue;}
			this.removeAllListeners(key);
		}
		this.removeAllListeners('removeListener');
		this._events = new EventHandlers();
		this._eventsCount = 0;
		return this;
	}

	listeners = events[type];

	if(typeof listeners === 'function'){
		this.removeListener(type, listeners);
	}else if(listeners) {
		//LIFO order, removal starts from recently appended listener
		do {
			this.removeListener(type, listeners[listeners.length - 1]);
		}while(listeners[0]);
	}

	return this;
};

//get listener arrays from given event type, if there's no listener, an empty array would be returned.
EventEmitter.prototype.listeners = function listeners(type) {
	var evlistener;
	var ret;
	var events = this._events;

	if(!events){
		ret = [];
	}else{
		evlistener = events[type];
		if(!evlistener) {
			ret = [];
		}else if (typeof evlistener === 'function'){
			ret = [evlistener];
		}else {
			ret = arrayClone(evlistener, evlistener.length);
		}
	}

	return ret;
};


/*
* Count the number of listener for given event on emitter
* Provide two ways, once works as method to emitter instance, another works as function attached in EventEmitter object.
*/

EventEmitter.listenerCount = function(emitter, type) {
	if(typeof emitter.listenerCount === 'function'){
		return emitter.listenerCount(type);
	}else{
		return listenerCount.call(emitter, type);
	}
};

EventEmitter.prototype.listenerCount = function listenerCount(type) {
	var events = this._events;
	var evlistener;

	if(events){
		evlistener = events[type];

		if(typeof evlistener === 'function') {
			return 1;
		}else if (evlistener){
			return evlistener.length;
		}
	}

	return 0;
};

//get all currently listed events in emitter
EventEmitter.prototype.eventNames = function eventNames() {
	//use ES6 Reflect to all events returned in an array
	return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};


/*
* Two utility functions used by previous code.
*/
//util function for splice element from array in given index
// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
	for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1){
			list[i] = list[k];
	}
    
  	list.pop();
}

//util function for clone an array of listeners
function arrayClone(arr, i) {
	var copy = new Array(i);
	while(i>=0){
		copy[i] = arr[i];
		i--;
	}
	return copy;
}


