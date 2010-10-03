var Connection = Class.extend({
    init: function (url) {
        this.version = 1;
        this.url = url;
    },
    
    open: function () {
	var conn = this;
        this._ws = new WebSocket(this.url);
        this._ws.onopen = function (evt) { conn.on_open(evt); }
        this._ws.onclose = function (evt) { conn.on_close(evt); }
        this._ws.onmessage = function (evt) { conn.on_message(evt); }
        this._ws.onerror = function (evt) { conn.on_error(evt); }
    },
    
    on_open: function () {
        console.log("Connection opened");
    },
    on_close: function () {
        console.log("Connection closed");
    },
    on_error: function () {
        console.log("Connection error",evt);
    },
    
    on_message: function (evt) {
	console.log(evt);
        var m = JSON.parse(evt.data);
        console.log(m);
	if (m.type == 'p7.welcome') {
		this._ws.send(JSON.stringify({type: 'p7.authenticate', version: 1, username: 'quack'}));
	}
    }
});
