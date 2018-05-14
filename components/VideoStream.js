const Events = require('events');
const Util = require('util');

Util.inherits(VideoStream, Events.EventEmitter);

module.exports = VideoStream;

/**
 * @param {ClientRequest} req
 * @param {Readable} rawStream
 * @param {string} boundary
 * @constructor
 * @private
 */
function VideoStream(req, rawStream, boundary) {
	this._req = req;
	this._stream = rawStream;
	this._boundary = Buffer.from(boundary, 'ascii');
	this._setup();
}

/**
 * @private
 */
VideoStream.prototype._setup = function() {
	let buf = Buffer.alloc(0);
	let pos;

	this._stream.on('data', (chunk) => {
		buf = Buffer.concat([buf, chunk]);
		while ((pos = buf.indexOf(this._boundary)) != -1) {
			// we have a complete frame, and it ends at `pos`
			this.emit('frame', buf.slice(0, pos));
			buf = buf.slice(pos + this._boundary.length);
		}
	});

	this._stream.on('error', (err) => {
		// not critical enough to crash really
	});

	this._stream.on('end', () => {
		this.emit('end');
	});
};

/**
 * Stop the stream.
 */
VideoStream.prototype.end = function() {
	this._req.abort();
};
