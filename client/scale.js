if (com.p7.scale == undefined) {
    com.p7.scale = {};
}

com.p7.scale.type_map = {
    bits: {
        bytes: function (v) { return v / 8; },
        bits: function (v) { return v; }
    },
    bytes: {
        bytes: function (v) { return v; },
        bits: function (v) { return v * 8; }
    },
    value: {
        value: function (v) { return v; }
    }
}

com.p7.scale.Scale = Class.extend({
    // Limit is the top edge of the scale, values will always be limited to that
    // input_type is one of bytes|bits|numeric
    // output_type is one of bytes|bits|numeric
    init: function (app, config) {
        this.app = app;
        this.c = config;
    },
    
    // Scale a value between 0 and 1
    scale: function (value) {
        throw 'Abstract function';
    },
    
    // Provide human readable version of the value
    // Converts from input to output type and gives appropriate postfix,
    // ie 2097152 bytes to 16MBi 
    label: function (value) {
        if (isNaN(value)) {
            return "NaN";
        }
        var mapper = com.p7.scale.type_map[this.c.input_type][this.c.output_type];
        
        if (mapper == undefined) {
            throw "Can't find mapping from " + this.c.input_type + " to " + this.c.output_type;
        }
        
        var v = mapper(value);
        var step = null;
        var symbols = null;
        var symbol = null;
        var dtype = '';
        
        if (this.c.output_type == 'bits' || this.c.output_type == 'bytes') {
            step = 1024;
            symbols = ['','K','M','G','T','P'];
            if (this.c.output_type == 'bits') {
                dtype = 'b';
            } else {
                dtype = 'B';
            }
        } else {
            step = 1000;
            symbols = ['','K','M','B','T','Q'];
        }
        
        if (this.c.output_type == 'value' && v < 10) {
            return ""+v.toFixed(2);
        }
        
        for (var i=0; i<symbols.length; i++) {
            if (v < step*2) {
                return Math.round(v)+symbols[i]+dtype;
            }
            v = v / step;
        }
        console.log("Value is too large to map to known standard figure", value);
        return value;
    },
    
    // Returns a list:
    // [(0, '0Mbi'),(256,'256MBi'),...]
    major_ticks: function () {
        if (this.c.major_ticks == undefined) {
            return [];
        }
        
        return this.c.major_ticks.map(function (e) { return {value: e, label: this.label(e)}; });
    }
});

com.p7.scale.LinearScale = com.p7.scale.Scale.extend({
    scale: function (value) {
        return Math.min(1.0, value / this.c.limit);
    }
});

// Log scale puts the first limit base at 1/3rd, the second at 2/3rds etc
// So for example, using the log scale for (simplified) 1000Mbit gives you:
// 0 = 0.00, 10Mbit = 0.33, 100Mbit = 0.66, 1000Mbit = 1.0
// This is handy for making low values visible on charts
com.p7.scale.LogScale = com.p7.scale.Scale.extend({
    scale: function (value) {
        return Math.min(1.0, Math.log(value+1) / Math.log(this.c.limit));
    }
});
