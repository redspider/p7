/*
            'world': {
                'macbook': {
                    'type': 'router',
                    'label': 'macbook',
                    'x': 120,
                    'y': 120,
                    'size': 40,
                    'charts': {
                        'cpu': {
                            'type': 'percentage',
                            'label': 'cpu',
                            'source': 'macbook.cpu'
                        }
                    }
                }
            }
*/

var world = {};

world.templates = {};

world.builder = function (app, parent, config) {
    var result = {};
    for (var k in config) {
        var element = config[k];
        if (!world[element.type]) {
            console.log("Unrecognised element ",element.type);
            continue;
        }
        if (element.type != 'Template') {
            continue;
        }
        console.log("Found template",element);
        
        result[k] = new world[element.type](app, k, parent, element);
    }
    for (var k in config) {
        var element = config[k];
        if (!world[element.type]) {
            console.log("Unrecognised element ",element.type);
            continue;
        }
        if (element.type == 'Template') {
            continue;
        }
        
        result[k] = new world[element.type](app, k, parent, element);
    }
    return result;
}

world.World = Class.extend({
    init: function (app, config) {
        this.app = app;
        this.scene = world.builder(this.app, this, config);
    },
    
    render: function () {
        for (var k in this.scene) {
            this.scene[k].render();
        }
    }
});

world.Template = Class.extend({
    init: function (app, id, parent, config) {
        this.app = app;
        this.id = id;
        this.parent = parent;
        this.config = config;
        console.log("Template", config);
        world.templates[id] = this;
        console.log("Templates",world.templates);
    },
    
    render: function () {}
});

world.Router = Class.extend({
    init: function (app, id, parent, config) {
        this.app = app;
        this.id = id;
        this.parent = parent;
        
        if (config.template) {
            for (var k in world.templates[config.template].config) {
                if (config[k] == undefined) {
                    config[k] = world.templates[config.template].config[k];
                }
            }
        }
        
        this.label = config.label;
        this.x = config.x;
        this.y = config.y;
        this.radius = config.radius;
        this.children = world.builder(app, this, config.charts);
    },
    
    // Render router
    render: function () {
        var ctx = this.app.ctx;
        
        for (var k in this.children) {
            this.children[k].render();
        }
        
        ctx.save();

        /*        
        ctx.fillStyle = "rgba(100,100,120,1.0)";
        ctx.strokeStyle = "rgba(240,240,255,1.0)";
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        
        ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
        */
        ctx.font = '600 9px sans-serif';
        ctx.fillStyle = 'rgba(250,230,180,1.0)';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.fillText(this.label, this.x,this.y);
        
        ctx.restore();
        
    }
});


world.OldAbsPieBar = Class.extend({
    init: function (app, id, parent, config) {
        this.app = app;
        this.id = id;
        this.parent = parent;
        this.label = config.label;
        this.value_limit = config.value_limit;
        this.source = config.source;
        this.arc = config.arc;
        this.angle = config.angle;
        this.x = config.x || this.parent.x;
        this.y = config.y || this.parent.y;
        this.radius = config.radius;
        this.parent_radius = config.parent_radius || this.parent.radius;

        this.old_value = 0;
        this.current_value = 0;
        
        if (this.source) {
            this.app.subscribe(this.source, $.proxy(this.on_message, this));
        }
        
    },
    
    on_message: function (m) {
        this.old_value = this.current_value;
        this.current_value = m.values[0][1];
        this.current_time = new Date().getTime();
        this.expected = (m.expected - m.time)*1000.0;
    },
    
    // Scales value so that it hits current value at the expected point of the next message
    scale_value: function () {
        var now = new Date().getTime();
        var time_fraction = (now-this.current_time)/this.expected;
        if (time_fraction > 1) {
            time_fraction = 1.0;
        }
        return this.old_value + (this.current_value-this.old_value) * time_fraction;
    },
    
    fraction_value: function () {
        return this.scale_value() / this.value_limit;
    },
    
    _render_bar: function (radius) {
        var ctx = this.app.ctx;
        var x = this.x;
        var y = this.y;
        var angle = this.angle;
        var arc = this.arc;
        
        ctx.save();
        
        ctx.beginPath();
        ctx.translate(x,y);
        ctx.rotate((angle/360.0)*Math.PI*2-(Math.PI/2));
        ctx.arc(0,0,radius,0,(arc/360.0)*Math.PI*2);
        ctx.lineTo(0,0);
        ctx.closePath();
    
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    },
    
    _render_label: function (radius, label) {
        var ctx = this.app.ctx;
        var x = this.x;
        var y = this.y;
        var angle = this.angle;
        var arc = this.arc;
        
        ctx.save();
        ctx.beginPath();
        ctx.translate(x,y);
        ctx.rotate((angle/360.0)*Math.PI*2-(Math.PI/2));
        ctx.rotate(((arc/360.0)*Math.PI*2)/2);
        ctx.fillStyle = 'rgba(200,200,200,1.0)';
        ctx.textBaseline = 'middle';
        
        if (angle > 180) {
            /* Text will end up upside down, need to be sneaky */
            ctx.translate(radius+10,0);
            ctx.rotate(Math.PI);
            ctx.textAlign = 'end';
            ctx.fillText(label, 0, 0);
        } else {
            ctx.fillText(label, radius+10, 0);
        }
        ctx.restore();
    },
    
    nice_value: function (v) {
        if (v < 10) {
            return v.toFixed(2);
        }
        if (v < 1024) {
            return Math.round(v);
        }
        if (v < (5*1024*1024)) {
            return Math.round(v/1024) + "KB"
        }
        if (v < (5*1024*1024*1024)) {
            return Math.round(v/(1024*1024)) + "MB"
        }
        if (v < 1024*1024*1024*1024) {
            return Math.round(v/(1024*1024*1024)) + "GB"
        }
    },
    
    render: function () {
        var ctx = this.app.ctx;
        ctx.save();
        
        /* Render scale */
        ctx.fillStyle = "rgba(240,240,255,0.1)";
        ctx.strokeStyle = "rgba(240,240,255,0.3)";
        ctx.lineWidth = 1;
        
        this._render_bar(this.radius);
        this._render_label(this.radius, this.label);
        ctx.restore();
        
        ctx.save();
        
        /* Render value */
        ctx.fillStyle = "rgba(240,240,255,0.4)";
        ctx.strokeStyle = "rgba(240,240,255,1.0)";
        ctx.lineWidth = 1;
        
        this._render_bar(this.parent_radius+(this.radius-this.parent_radius)*(this.fraction_value()),'');
        this._render_label(this.parent_radius, this.nice_value(this.scale_value()));
        
        ctx.restore();
    }
});


world.ArcBar = Class.extend({
    init: function (app, id, parent, config) {
        this.app = app;
        this.id = id;
        this.parent = parent;
        this.label = config.label;
        this.value_limit = config.value_limit;
        this.source = config.source;
        this.arc = config.arc;
        this.angle = config.angle;
        this.x = config.x || this.parent.x;
        this.y = config.y || this.parent.y;
        this.radius = config.radius;
        this.width = config.width;
        this.parent_radius = config.parent_radius || this.parent.radius;
        this.alarm = config.alarm;

        this.old_value = 0;
        this.current_value = 0;
        this.last_counter_value = null;
        this.current_counter_value = null;
        this.alarm_status = false;
        
        if (this.source) {
            this.app.subscribe(this.source, $.proxy(this.on_message, this));
        }
        
    },
    
    on_message: function (m) {
        this.old_value = this.current_value;
        if (m.values[0][0] == 0) {
            // Counter message, subtract from the old value, divide by time difference
            if (this.last_counter_value == null) {
                // No last counter value, so we start at 0 to avoid nasty infinities
                this.last_counter_value = m.values[0][1];
                this.current_counter_value = m.values[0][1];
                this.current_value = 0;
            } else {
                // yay kinda
                this.last_counter_value = this.current_counter_value;
                this.current_counter_value = m.values[0][1];
                // Fix to use previous message time instead of interval
                this.current_value = (this.current_counter_value - this.last_counter_value)/(m.expected-m.time);
            }
        } else {
            // Gauge message, just use the current value
            this.current_value = m.values[0][1];
        }
        
        this.current_time = new Date().getTime();
        this.expected = (m.expected - m.time)*1000.0;
        if (this.current_value >= this.alarm) {
            this.alarm_status = true;
        } else {
            this.alarm_status = false;
        }
    },
    
    // Scales value so that it hits current value at the expected point of the next message
    scale_value: function () {
        var now = new Date().getTime();
        var time_fraction = (now-this.current_time)/this.expected;
        if (time_fraction > 1) {
            time_fraction = 1.0;
        }
        return this.old_value + (this.current_value-this.old_value) * time_fraction;
    },
    
    fraction_value: function () {
        return this.scale_value() / this.value_limit;
    },
    
    _render_bar: function (radius, fraction) {
        var ctx = this.app.ctx;
        var x = this.x;
        var y = this.y;
        var angle = this.angle;
        var arc = this.arc;
        
        ctx.save();
        
        ctx.translate(x,y);
        ctx.beginPath();
        
        var endpoint = fraction*(this.arc/360.0)*Math.PI*2;
        
        //ctx.arc(0,0,radius,endpoint);
        ctx.rotate(-Math.PI/2+((this.angle/360.0)*Math.PI*2));
        ctx.arc(0,0,radius,0,endpoint);
        ctx.rotate(endpoint);
        ctx.lineTo(radius+this.width,0);
        ctx.arc(0,0,radius+this.width,0,-endpoint,1);
        ctx.rotate(-endpoint);
        ctx.lineTo(radius,0);
        
        
        /*
        ctx.rotate(-endpoint);
        ctx.lineTo(0,-radius-10);
        ctx.arc(0,0,radius+10,-endpoint);
        ctx.rotate(endpoint);
        ctx.lineTo(-radius,0);
        
        */
        ctx.closePath();
    
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    },
    
    _render_label: function (radius, fraction, label) {
        var ctx = this.app.ctx;
        var x = this.x;
        var y = this.y;
        var angle = this.angle;
        var arc = this.arc;
        
        ctx.save();
        
        ctx.font = '600 9px sans-serif';
        ctx.translate(x,y);
        ctx.beginPath();
        
        var endpoint = fraction*(this.arc/360.0)*Math.PI*2;
        
        ctx.rotate(-Math.PI/2+((this.angle/360.0)*Math.PI*2));
        ctx.rotate(endpoint+Math.PI/2);
        
        ctx.fillStyle = 'rgba(200,200,200,1.0)';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.translate(0,-radius-8);
        if (this.angle >= 90) {
            ctx.rotate(Math.PI);
        }
        /*
        if (angle > 180) {
            ctx.translate(radius+10,0);
            ctx.rotate(Math.PI);
            ctx.textAlign = 'end';
            ctx.fillText(label, 0, 0);
        } else {
            ctx.fillText(label, radius+10, 0);
        }
        */
        ctx.fillText(label, 0,0);
        
        ctx.restore();
    },
    
    nice_value: function (v) {
        if (v < 10) {
            return v.toFixed(2);
        }
        if (v < 1024) {
            return Math.round(v);
        }
        if (v < (5*1024*1024)) {
            return Math.round(v/1024) + "KB"
        }
        if (v < (5*1024*1024*1024)) {
            return Math.round(v/(1024*1024)) + "MB"
        }
        if (v < 1024*1024*1024*1024) {
            return Math.round(v/(1024*1024*1024)) + "GB"
        }
    },
    
    render: function () {
        var ctx = this.app.ctx;
        ctx.save();
        
        /* Render scale */
        if (this.alarm_status) {
            var intensity = 3+2*(Math.sin(new Date().getTime() /500));
            ctx.fillStyle = "rgba(240,40,0,"+(intensity/40)+")";
            ctx.strokeStyle = "rgba(0,0,0,0.3)";
        } else {
            ctx.fillStyle = "rgba(0,0,0,0.1)";
            ctx.strokeStyle = "rgba(0,0,0,0.3)";
        }
        ctx.lineWidth = 1;
        
        this._render_bar(this.radius,1);
        //this._render_label(this.radius, 1, this.label);
        ctx.restore();
        
        ctx.save();


        if (this.alarm_status) {
            var intensity = 3+2*(Math.sin(new Date().getTime() /500));
            ctx.fillStyle = "rgba(240,40,0,"+(intensity/10)+")";
            ctx.strokeStyle = "rgba(240,40,0,"+(intensity/5)+")";
        } else {
            ctx.fillStyle = "rgba(240,240,255,0.2)";
            ctx.strokeStyle = "rgba(0,0,0,0.3)";
        }

        ctx.lineWidth = 1;
        
        this._render_bar(this.radius, this.fraction_value());
        if (this.width > 10) {
            this._render_label(this.radius, 0.5, this.nice_value(this.scale_value()));
        }
        
        ctx.restore();
    }
})