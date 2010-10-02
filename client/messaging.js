// Singleton broadcast target registrar
var targets = {};

/* A Broadcast is a message broadcast point. Classes with the receive method
  can subscribe to it and receive messages whenever one is sent to the broadcast
*/

var Broadcast = Class.extend({
    init: function(id) {
        targets[id] = this;
        this.subscribers = [];
    },
    
    send: function(m) {
        for (var i=0; i<this.subscribers.length; i++) {
            this.subscribers[i].receive(m);
        }
    },
    
    add_subscriber: function (o) {
        this.subscribers.push(o);
    }
});

/* Convenience class for receiving. You don't have to use it but it's handy */

var Receiver = Class.extend({
    subscribe: function (broadcast) {
        broadcast.add_subscriber(this);
    },
    receive: function (m) {
        console.log("Receiver unimplemented");
    }
})

/* A BroadcastHistory is a converter that takes messages from Broadcasts it is
  subscribed to, and aggregates them into a history, which it then relays out
  again to its own subscribers. Used for taking single-value sources like bits-per-second
  and turning them into 50-element datasets for use with an areachart */
var BroadcastHistory = Broadcast.extend({
    init: function (id, keep) {
        this._super(id);
        this.keep = keep;
        this.history = [];
    },

    subscribe: function (broadcast) {
        broadcast.add_subscriber(this);
    },
    
    receive: function (m) {
        if (this.history.length > this.keep) {
            this.history.shift();
        }
        this.history.push(m);
        
        this.send({'type': m.type, 'history': this.history});
    }
});


/* A BroadcastTypecast takes an untyped message and turns it into a typed one
  suitable for use with an Element. Normally the messages would arrive in the
  system already typed, but sometimes (during testing etc) you want to use
  an untyped source like random or sine */


var BroadcastTypecast = Broadcast.extend({
    init: function (id, type, multiplier) {
        this._super(id);
        this.type = type;
        this.multiplier = multiplier;
    },

    subscribe: function (broadcast) {
        broadcast.add_subscriber(this);
    },
    
    receive: function (m) {
        if (this.type == 'bits_per_second_in' || this.type == 'bits_per_second_out') {
            this.send({
                'type': this.type,
                'bits_per_second': m.value * this.multiplier
            });
        }
    }
});

