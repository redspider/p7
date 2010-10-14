function frame(app) {
    app.view.frame();
    setTimeout(frame, 40, app);
}

var App = Class.extend({
    
    init: function (canvas, settings) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.settings = settings;
        this.width = 800;
        this.scale = 1;
        this.current_time = null;
        this.subscribers = {};
        
        // Model
        //this.model = new Model(settings);
        
        // View
        this.view = new View(this, settings);
        
        // Run frame
        frame(this);
        
        // Communications
        this.websocket = new WebSocket(settings.wsuri);
        this.websocket.onopen = $.proxy(this.on_connect, this);
        this.websocket.onclose = $.proxy(this.on_disconnect, this);
        this.websocket.onerror = $.proxy(this.on_error, this);
        this.websocket.onmessage = $.proxy(this.on_message, this);
        
    },
    
    on_connect: function (e) {
        this.view.on_connect();
    },
    
    on_disconnect: function (e) {
        this.view.on_disconnect();
    },
    
    on_error: function (e) {
        console.log("Connection error",e);
        this.view.on_fatal_error(e);
    },
    
        
    // Return username and password blanks at the moment
    on_auth_challenge: function (challenge) {
        return {username: 'guest', password: HMAC_SHA256_MAC(challenge,'guest')};
    },
    
    send: function (m) {
        this.websocket.send(JSON.stringify(m));
    },
    
    // Basic message handling
    on_message: function (e) {
        var m = JSON.parse(e.data);
        
	if (m.type == 'p7.welcome') {
            var c = this.on_auth_challenge(m.challenge);
            this.send({type: 'p7.authenticate', version: 1, username: c.username, password: c.password});
            return;
	}
        
        if (m.type == 'p7.configure') {
            // Build world
            this.rebuild_world(m.config.world);
        }
        
        if (m.type == 'p7.time') {
            this.current_time = m.time;
            return;
        }
        
        if (m.type == 'p7.s') {
            var subscribers = this.subscribers[m.source];
            if (subscribers) {
                for (var i in subscribers) {
                    subscribers[i](m);
                }
            }
        }
        
    },
    
    rebuild_world: function (config) {
        this.view.world = new world.World(this, config);
    },
    
    subscribe: function (source, callback) {
        if (!this.subscribers[source]) {
            // New source, subscribe to it
            this.subscribers[source] = [];
            console.log("Subscribing to ", source);
            this.send({type: 'p7.subscribe', source: source});
        }
        this.subscribers[source].push(callback);
    }
    
})