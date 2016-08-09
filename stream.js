'use strict';

module.exports = Stream;

const EventEmitter = require('events');
const util = require('util');

//now Stream.prototype's [[prototype]] is pointing to EventEmitter.prototype
util.inherits(Stream, EventEmitter);
//store references to differernt types of stream on Stream. 
Stream.Readable = require('_stream_readable');
Stream.Writable = require('_stream_writable');
Stream.Duplex = require('_stream_duplex');
Stream.Transform = require('_stream_transform');
Stream.PassThrough = require('_stream_passthrough');

//backward compatibility
Stream.Stream = Stream;

// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

//Stream type Constructor
//An stream instance is an instance of EventEmitter.
function Stream() {
	//call super constructor
	EventEmitter.call(this);
}

Stream.prototype.pipe = function(dest, options) {
	var source = this;

	//listener for 'data' event
	function ondata(chunk){
		//check if dest is a writable stream.
		if(dest.writable){
			//if dest is currently unwritable, pause source stream. 
			if(dest.write(chunk) === false && source.pause){
				source.pause();
			}
		}
	}

	//register ondata listener to 'data' event on source stream.
	source.on('data', ondata);


	//listener for 'drain' event
	function ondrain(){
		//if source is a readable stream and dest is drained, resume source stream.
		if(source.readable && source.resume){
			source.resume();
		}
	}

	//register ondrain listener to 'drain' event on dest stream.
	dest.on('drain', ondrain);


  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
	if(!dest._isStdio && (!options || options.end !== false)){
		source.on('end', onend);
		source.on('close', onclose);
	}

	var didOnEnd = false;
	//listener for 'close' event
	function onend() {
		if (didOnEnd) { return; }

		didOnEnd = true;
		dest.end();
	}

	//listener for 'close' event
	function onclose() {
		if(didOnEnd) { return; }
		didOnEnd = true;

		if(typeof dest.destroy === 'function'){
			dest.destroy();
		}
	}

	//error handling, if there is no extra error listener in source/dest, throw the error.
	function onerror(error){
		cleanup();
		if(EventEmitter.listenerCount(this. 'error') === 0){
			throw error;
		}
	}

	source.on('error', onerror);
	dest.on('error', onerror);

	//cleanup function to clean up all pipe related listeners.
	function cleanup(){
		source.removeListener('data', ondata);
		dest.removeListener('drain', ondrain);

		source.removeListener('end', onend);
		source.removeListener('close', onclose);

		source.removeListener('error', onerror);
		dest.removeListener('error', onerror);

		source.removeListener('end', cleanup);
		source.removeListener('close', cleanup);

		dest.removeListener('close', cleanup);
	}

	//if source and dest reach 'end'/'close', clean up all pipe releated resources by calling cleanup listener.
	source.on('end', cleanup);
	source.on('close', cleanup);

	dest.on('close', cleanup);


	dest.emit('pipe', source);

	return dest;
}

