if (com.p7.data == undefined) {
    com.p7.data = {};
}

// Todo: think about alarms. Maybe as a separate class?
com.p7.data.Stack = Class.extend({
    // Expects config as:
    // {sources: [{source: '...', label: 'user', color: 'green'},...]}
    init: function (app, prefix, config) {
        this.app = app;
        this.c = config;
        this.prefix = prefix;
        this.sources = {};
        this._values = {};
        
        // Create source map
        for (var i in this.c.sources) {
            var s = this.c.sources[i];
            if (prefix) {
                s.source = prefix + s.source;
            }
            s.position = i;
            this.sources[s.source] = s;
            this._values[s.source] = {
                interval: 1,
                received: new Date().getTime(),
                current: 0,
                last: 0
            };
            var source_for = s.source;
            this.app.subscribe(this._source_core(s.source), $.proxy(function (m){ this.data.on_message(this.source,m); }, {data: this, source: s.source}));
        }
    },
    
    // Source manipulation routines
    // Get the core part of the source, ie
    // monitor1/interfaces/interfaces/eth0,0 => monitor1/interfaces/interfaces/eth0
    _source_core: function (s) {
        var index = s.indexOf(',');
        if (index == -1) {
            return s;
        }
        return s.substr(0,index);
    },

    // Get the sub part of the source, ie
    // monitor1/interfaces/interfaces/eth0,10 => 10
    _source_sub: function (s) {
        var index = s.indexOf(',');
        if (index == -1) {
            return 0;
        }
        return parseInt(s.substr(index+1));
    },
    
    // Returns sum of current values
    sum: function () {
        // WHERE THE FUCK IS THE SUM() FUNCTION??
        var sum = 0;
        var vals = this.smooth_values();
        for (var i=0; i<vals.length; i++) {
            if (vals[i]) {
                sum+=vals[i];
            }
        }
        return sum;
    },
    
    // Returns sum of all values, for use with auto-scaling or alarms
    full_sum: function () {
        var sum = 0;
        var vals = this.all_values();
        for (var i=0; i<vals.length; i++) {
            if (vals[i]) {
                sum+=vals[i];
            }
        }
        return sum;
    },
    
    // Receives a source message
    on_message: function (source_for, m) {
        // Find source
        var source = this.sources[source_for];
        // Current values
        var value = $.extend({},this._values[source_for]);
        
        // Message value
        var msgval = m.values[this._source_sub(source_for)];
        var sub = this._source_sub(source_for);
        
        // What type of value is it?
        if (msgval[0] == 0) {
            // If it's a counter, we have to subtract from the previous counter value
            // and divide by time difference to get the useful value
            if (value.last_raw_value == undefined) {
                // If last value is null then we can't guess, default to 0
                value.last_raw_value = msgval[1];
                value.last_raw_time = m.time;
                value.current_raw_value = msgval[1];
                value.last = 0;
                value.current = 0;
            } else {
                // Otherwise, do the math
                //var interval = Math.max(m.time - value.last_raw_time,0.1); // Never let the interval be less than 0.1
                var interval = m.interval;
                value.last_raw_value = value.current_raw_value;
                value.last_raw_time = m.time;
                value.current_raw_value = msgval[1];
                value.last = value.current;
                value.current = (value.current_raw_value - value.last_raw_value) / interval;
            }
        } else {
            // If it's a gauge, things are much easier. Much easier
            value.last = value.current || 0;
            value.current = msgval[1];
            // That easy.
        }
        // Interval value for smoothing (in SECONDS)
        value.interval = m.interval;
        value.received = new Date().getTime();
        
        
        // WOW have I fucked this something chronic
        // The object dump for value says it's fine, the value.current value is buggered
        // same thing seems to happen during smooth, something scope dependent or something?
        if (isNaN(value.current)) {
            console.log(value,value.current,m,msgval);
            throw 'Current value is invalid';
        }
        
        this._values[source_for] = value;
        
    },
    
    // Returns a list of value attributes
    // [{label: X, color: Y},..]
    attributes: function () {
        var result = [];
        for (var k in this.c.sources) {
            if (this.c.sources[k].visible || this.c.sources[k].visible == undefined) {
                result.push(this.c.sources[k]);
            }
        }
        return result;
    },
    
    // Returns a list of all values:
    // [V,V,V,V]
    all_values: function () {
        var result = [];
        for (var k in this._values) {
            result.push(this._values[k].current);
        }
        return result;
    },
    
    // Returns a list of values:
    // [V,V,V,V]
    values: function () {
        var result = [];
        for (var k in this._values) {
            if (this.sources[k].visible || this.sources[k].visible == undefined) {
                result.push(this._values[k].current);
            }
        }
        return result;
    },
    
    // Returns a list of values smoothed across time:
    // [V,V,V,V]
    smooth_values: function () {
        var now = new Date().getTime();
        
        var result = [];
        for (var k in this._values) {
            if (!(this.sources[k].visible || this.sources[k].visible == undefined)) {
                continue;
            }
            var e = $.extend({}, this._values[k]);
            var time_fraction = (now - e.received)/(e.interval * 1000.0);
            if (time_fraction > 1) {
                // Clamp time value
                time_fraction = 1.0;
            }
            if (isNaN(time_fraction)) {
                throw 'Time fraction went NaN';
            }
            result.push(e.last + (e.current-e.last) * time_fraction);
        }
        
        return result;
    }
});