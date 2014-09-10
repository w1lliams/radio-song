'use strict';

var urlLib = require('url'),
    net = require('net'),
	util = require('util'),
	EventEmitter = require('events').EventEmitter;


var Shoutcast = function(url) {
	this.url = urlLib.parse(url);
	// счетчик, сколо прочитано байт до метаданных
	this.readBytes = 0;
	// все что связанно с заголовками
	this.headers = {
		src: '',		// заголовки всыром виде
		isRead: true,	// флаг указывающий что сейчас еще из сокета еще считываются заголовки
		newLineCount: 0
	};

	this.metadata = {
		src: '',
		isRead: false,
		metaint: 0,
		bytesDone: 0,
		length: 0,
		done: false
	};

	this.client = net.connect({
	  port: this.url.port,
	  host: this.url.hostname
	}, this.onConnect.bind(this));
	this.client.setTimeout(3000, this.onTimeout.bind(this));


	this.client
		.on('data', this.onData.bind(this))
	  	.on('end', this.onError.bind(this))
		.on('error', this.onError.bind(this))
		.on('close', this.onError.bind(this))
};
util.inherits(Shoutcast, EventEmitter);

/**
 *
 */
Shoutcast.prototype.onTimeout = function() {
	this.client.destroy();
};

/**
 * 
 */
Shoutcast.prototype.onData = function(data){
	var skip = 0; // сколько занимают байт заголовки в этом блоке
	if(this.headers.isRead)
		for(var i = 0; i < data.length; i++) {
			// если еще не встретили два перехода строки подряд, значит читаем заголовки
			if(this.headers.newLineCount < 2) {
				this.headers.src += String.fromCharCode(data[i]);
				skip++;
				// считаем переходы строк (игнорируя \n)
				if(data[i] == 10)
					this.headers.newLineCount++;
				else if(data[i] != 13)
					this.headers.newLineCount = 0;
			} else {
				this.headers.isRead = false;
				this.processHeaders();
				break;
			}
		}

	// если прочли заголовки
	if(!this.headers.isRead) {
		if(this.metadata.isRead) { // если уже получаем метаданные...
			this.processMetadata(data, 0);
		} else {	// все еще ищем метаданные
			// если в текущем блоке данных уже есть метаданные
			if((data.length + this.readBytes - skip) > this.headers.metaint) {
				this.metadata.isRead = true;
				// номер байта с которого начинаются метаданные
				var startByte = this.headers.metaint - this.readBytes;
				// первый байт метаданных это их размер
				if(data[startByte] == 0) {
					// todo: делать 3 попытки
					readBytes = data.length - startByte - 1;
				} else {
					this.metadata.isRead = true;
					this.metadata.length = data[startByte] * 16;
					this.processMetadata(data, startByte + 1);
				}
			} else
				this.readBytes += data.length - skip;
		}
	}
};

/**
 * 
 */
Shoutcast.prototype.onConnect = function() {
  console.log('client connected');
  this.client.write(
	'GET '+ this.url.path +' HTTP/1.0\r\n' + 
	'Icy-MetaData: 1\r\n' +
	'User-Agent: VLC/2.0.5 LibVLC/2.0.5\r\n' +
	'\r\n'
  );
};

/**
 * 
 */
Shoutcast.prototype.onError = function () {
	if(!this.metadata.done)
		this.emit('error');
};

/**
 * вытаскиваем из заголовков "metaint"
 */
Shoutcast.prototype.processHeaders = function() {
	console.log(this.headers.src);
	var data = this.headers.src.split('\r\n');
	for(var i = 0; i < data.length; i++) {
		var header = data[i].split(':');
		if(header[0] == 'icy-metaint') {
			this.headers.metaint = parseInt(header[1]);
			break;
		}
	}
};


/**
 * получаем из сокета метаданные
 */
Shoutcast.prototype.processMetadata = function(buffer, start) {
	var need = this.metadata.length - this.metadata.bytesDone;
	if((buffer.length - start) >= need) {
		this.metadata.src += buffer.slice(start, start + need).toString();
		this.metadata.done = true;
		this.emit('metadata', this.metadata.src);
		this.client.destroy();
	} else {
		this.metadata.src += buffer.slice(start).toString();
		this.metadata.bytesDone += buffer.length - start;
	}
};



var streamUrl = 'http://chicago.discovertrance.com:9214/;';
streamUrl = 'http://ice.rosebud-media.de:8000/88vier-ogg1.ogg';
var parser = new Shoutcast(streamUrl);
parser.on('metadata', function(metadata) {
	console.log(metadata);
});
parser.on('error', function(){
	console.log('error shoutcast');
});
