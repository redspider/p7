var Connection = Class.extend({
    init: function (url) {
        this.version = 1;
        this.url = url;
    },
    
    open: function () {
        this._ws = new WebSocket(this.url);
        this._ws.onopen = function (evt) { this.on_open(evt); }
        this._ws.onclose = function (evt) { this.on_close(evt); }
        this._ws.onmessage = function (evt) { this.on_message(evt); }
        this._ws.onerror = function (evt) { this.on_error(evt); }
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
        var m = JSON.parse(evt);
        console.log(m);
    }
});
