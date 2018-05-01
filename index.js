const FS = require('fs');
const HTTP = require('http');
const URL = require('url');

module.exports = BlackVue;

/**
 * @param {{[ip], [port]}} [opts] - Options
 * @constructor
 */
function BlackVue(opts) {
	opts = opts || {};
	this._addr = (opts.ip || "10.99.77.1") + ":" + (opts.port || 80);
}

/**
 * Get a list of files that can be downloaded from the camera.
 * @param {{[timeout]}} [opts] - Options
 * @returns {Promise<{mp4, gps, 3gf}>}
 */
BlackVue.prototype.getDownloadableFiles = async function(opts) {
	opts = opts || {};

	return new Promise((resolve, reject) => {
		let timeoutMs = opts.timeout || 10000;
		let timeout = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);

		let req = HTTP.get(`http://${this._addr}/blackvue_vod.cgi`, (res) => {
			clearTimeout(timeout);

			if (res.statusCode != 200) {
				return reject(new Error("HTTP error " + res.statusCode));
			}

			let body = "";

			res.on('data', (chunk) => {
				body += chunk.toString('utf8');
				clearTimeout(timeout);
				timeout = setTimeout(() => reject(new Error("Timed out while receiving data")), timeoutMs);
			});

			res.on('end', () => {
				clearTimeout(timeout);

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

/**
 * Get metadata for a downloadable file
 * @param {string} path
 * @param {{[timeout]}} [opts] - Options
 * @return {Promise<{size, length}>}
 */
BlackVue.prototype.getFileMetadata = async function(path, opts) {
	opts = opts || {};

	return new Promise((resolve, reject) => {
		let timeoutMs = opts.timeout || 10000;
		let timeout = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);

		let httpReq = URL.parse(`http://${this._addr}${path}`);
		httpReq.method = "HEAD";
		let req = HTTP.request(httpReq, (res) => {
			clearTimeout(timeout);

			if (res.statusCode != 200) {
				return reject(new Error("HTTP error " + res.statusCode));
			}

			res.on('data', nop);

			return resolve(getMetadataFromHeaders(res.headers, path));
		});

		req.end();
		req.on('error', reject);
	});
};

/**
 * Get a download stream for a file on the camera.
 * @param {string} path
 * @returns {Promise<{metadata, stream}>}
 */
BlackVue.prototype.downloadFileStream = async function(path) {
	return new Promise((resolve, reject) => {
		let req = HTTP.get(`http://${this._addr}${path}`, (res) => {
			if (res.statusCode != 200) {
				return reject(new Error(res.statusCode == 204 ? "Empty file" : ("HTTP error " + res.statusCode)));
			}

			return resolve({
				"metadata": getMetadataFromHeaders(res.headers, path),
				"stream": res
			});
		});

		req.on('error', reject);
	});
};

BlackVue.prototype.downloadFileToDisk = async function(remotePath, localPath, progressListener) {
	let req = await this.downloadFileStream(remotePath);

	return new Promise((resolve, reject) => {
		let file = FS.createWriteStream(localPath);
		req.stream.pipe(file);

		let bytesDownloaded = 0;
		let startTime = Date.now();
		let timeout = setTimeout(() => reject(new Error("Timed out while receiving data")), 20000);
		let lastProgressEmit = 0;
		let progressTimeout = setTimeout(emitProgress, 1000);

		req.stream.on('data', (chunk) => {
			bytesDownloaded += chunk.length;
			emitProgress();
			clearTimeout(timeout);
			timeout = setTimeout(() => reject(new Error("Timed out while receiving data")), 20000);
		});

		req.stream.on('end', () => {
			resolve();
			clearTimeout(timeout);
			clearTimeout(progressTimeout);
		});

		req.stream.on('error', (err) => {
			FS.unlink(localPath, () => {
				reject(err);
			});
		});

		function emitProgress() {
			if (!progressListener) {
				return;
			}

			if (Date.now() - lastProgressEmit < 250) {
				return; // only emit progress at most once every 250ms
			}

			lastProgressEmit = Date.now();
			let elapsed = Date.now() - startTime;
			let speed = Math.round(bytesDownloaded / (elapsed / 1000));
			let eta = Math.round((req.metadata.size - bytesDownloaded) / speed);

			progressListener({
				"metadata": req.metadata,
				"bytesDownloaded": bytesDownloaded,
				"elapsed": Math.floor(elapsed / 1000),
				"eta": eta,
				"speed": speed
			});

			clearTimeout(progressTimeout);
			progressTimeout = setTimeout(emitProgress, 1000);
		}
	});
};

// private

function getMetadataFromHeaders(headers, path) {
	let meta = {"size": null, "length": null};
	if (headers['content-length']) {
		meta.size = parseInt(headers['content-length'], 10);
	}

	if (headers['last-modified']) {
		// it seems that instead of using timezones properly, the camera just sets GMT to the local time
		let lastModified = new Date(headers['last-modified']);
		let startTime = new Date(path.replace(/.*\/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_.*/, '$1-$2-$3 $4:$5:$6 GMT'));
		meta.length = Math.round((lastModified - startTime) / 1000);
	}

	return meta;
}

function nop() { }
