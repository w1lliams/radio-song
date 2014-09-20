# Radio Song
This lib allows to grab/parse song titles from the radio (shoutcast/icecast) stream.

## Installation & Usage

``` bash
npm install radio-song
```

``` javascript
var Reader = require('radio-song');

var reader = new Reader('<stream-url>')
   
reader.on('metadata', function(songName) {
  ...
});
parreaderser.on('error', function(e){
  ...
});
```
