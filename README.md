# blackvue

This is a module to interact with BlackVue dashcams over their local Wi-Fi interface. It cannot use the BlackVue Cloud
to connect to a camera over the Internet. Consequently, the machine using this module needs to be connected to the Wi-Fi
signal broadcast by the camera, or otherwise able to connect to it.

This requires Node.js v8 or later. All applicable methods are `async`.

### Constructor
- `opts` - An object containing zero or more of the following properties
    - `ip` - The IP address of the camera. You probably don't need to set this. Defaults to `10.99.77.1`.
    - `port` The HTTP port. You almost definitely don't need to set this. Defaults to `80`.

Constructs a new instance of the BlackVue client. Example:

```js
const BlackVue = require('blackvue');
let bv = new BlackVue();
```

### getDownloadableFiles()

Returns a Promise which is resolved by an object with these properties:
- `mp4` - An array of video files
- `gps` - An array of GPS data files
- `3gf` - An array of accelerometer data files

Each element in each array is a string containing the path relative to the camera's root where the file can be
downloaded.

### getFileMetadata(path)
- `path` - The string path to the file (from `getDownloadableFiles`)

Returns a Promise which is resolved by an object with these properties:
- `size` - The file size in bytes
- `length` - The approximate length of time covered by this file, in seconds. This is measured by taking the difference of the timestamp in the filename and the `Last-Modified` header, so it's usually off by a second or two.

### downloadFileStream(path)
- `path` - The string path to the file (from `getDownloadableFiles`)

Returns a Promise which is resolved by an object with these properties:
- `metadata` - The metadata for the file, in the same format as `getFileMetadata`
- `stream` - The stream of the file

### downloadFileToDisk(remotePath, localPath[, progressListener])
- `remotePath` - The string path to the file (from `getDownloadableFiles`)
- `localPath` - The string path where the file should be written (the directory must exist)
- `progressListener` - An optional function which will be called periodically with progress updates. It takes a single object argument with these properties:
    - `metadata` - The metadata for the file, in the same format as `getFileMetadata`
    - `bytesDownloaded` - The number of bytes downloaded
    - `eta` - The estimated time to completion, in seconds

Returns a Promise which is resolved with no data when the download is complete.
