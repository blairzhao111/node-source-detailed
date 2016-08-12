// 'Stream.PassThrough' module

'use strict';

module.exports = PassThrough;

const Transform = require('_stream_transform');
const util = require('util');

util.inherits(PassThrough, Transform);

//PassThough is inherited from Transform
function PassThrough(options) {
	if(!(this instanceof PassThrough)){
		return new PassThrough(options);
	}

	Transform.call(this, options);
}

//PassThrough stream is a special case of Transform that does nothing than passing through the data.
PassThrough.prototype._transform = function(chunk, encoding, cb) {
	//do nothing and pass chunk
	cb(null, chunk);
};