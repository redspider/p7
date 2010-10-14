var Connection = Class.extend({
    init: function (url, username, password) {
        this.version = 1;
        this.url = url;
    },
 
    on_auth_challenge: function (challenge) {
        // When implemented in production, this method should be overridden to prompt the user
        // for a username and password.
        return {username: 'guest', password: HMAC_SHA256_MAC(challenge,'guest')};
    },
    
    send: function (m) {
        this._ws.send(JSON.stringify(m));
    },
    
    open: function () {
	var conn = this;
        this._ws = new WebSocket(this.url);
        this._ws.onopen = function (evt) { conn.on_open(evt); }
        this._ws.onclose = function (evt) { conn.on_close(evt); }
        this._ws.onmessage = function (evt) { conn.on_basic_message(evt); }
        this._ws.onerror = function (evt) { conn.on_error(evt); }
    },
    
    on_open: function () {
    },
    on_close: function () {
    },
    on_error: function () {
    },
    on_message: function () {
    },
    
    on_basic_message: function (evt) {
        var m = JSON.parse(evt.data);
        
	if (m.type != 'p7.time') { console.log(m); }

	if (m.type == 'p7.welcome') {
            var c = this.on_auth_challenge(m.challenge);
            this.send({type: 'p7.authenticate', version: 1, username: c.username, password: c.password});
            return;
	}
        
        if (m.type == 'p7.time') {
            this.current_time = m.time;
            return;
        }
	

        this.on_message(m);
    }
});
