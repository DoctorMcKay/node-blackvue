const HTTP = require('http');

module.exports = BlackVue;

/**
 * @param {{ip, port}} [opts]
 * @constructor
 */
function BlackVue(opts) {
	opts = opts || {};
	this._addr = (opts.ip || "10.99.77.1") + ":" + (opts.port || 80);
}

/**
 * Get a list of files that can be downloaded from the camera.
 * @returns {Promise<object>}
 */
BlackVue.prototype.getDownloadableFiles = async function() {
	return new Promise((resolve, reject) => {
		let req = HTTP.get(`http://${this._addr}/blackvue_vod.cgi`, (res) => {
			if (res.statusCode != 200) {
				return reject(new Error("HTTP error " + res.statusCode));
			}

			let body = "";
			res.on('data', (chunk) => {
				body += chunk.toString('utf8');
			});

			res.on('end', () => {
				// parse the response
				let output = {"mp4": [], "gps": [], "3gf": []};
				output.mp4 = body.split("\r\n").filter(line => !!line.match(/^n:/)).map(line => line.split(':')[1].split(',')[0]);

				// find GPS and accelerometer files too
				output.mp4.forEach((path) => {
					if (path.match(/_[NE]F\.mp4/)) {
						// if it's a normal mode or event recording for the front cam, we have GPS/accel data
						let pathWithoutExt = path.replace(/_([NE])F\.mp4/, '_$1');
						output.gps.push(pathWithoutExt + '.gps');
						output['3gf'].push(pathWithoutExt + '.3gf');
					}
				});

				resolve(output);
			});
		});

		req.on('error', reject);
	});
};
