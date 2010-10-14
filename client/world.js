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

world.builder = function (app, parent, config) {
    var result = {};
    for (var k in config) {
        var element = config[k];
        if (!world[element.type]) {
            console.log("Unrecognised element ",element.type);
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

world.Router = Class.extend({
    init: function (app, id, parent, config) {
        this.app = app;
        this.id = id;
        this.parent = parent;
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
        
        ctx.fillStyle = "rgba(100,100,120,1.0)";
        ctx.strokeStyle = "rgba(240,240,255,1.0)";
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        
        ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        
    }
});

world.PieBar = Class.extend({
    init: function (app, id, parent, config) {
        this.app = app;
        this.id = id;
        this.parent = parent;
        this.label = config.label;
        this.source = config.source;
        this.value_type = config.value_type;
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
        this.current_value = m.values[0];
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
    
    _render_bar: function (radius, label) {
        var ctx = this.app.ctx;
        var x = this.x;
        var y = this.y;
        var angle = this.angle;
        var arc = this.arc;
        
        ctx.beginPath();
        ctx.translate(x,y);
        ctx.rotate((angle/360.0)*Math.PI*2-(Math.PI/2));
        ctx.arc(0,0,radius,0,(arc/360.0)*Math.PI*2);
        ctx.lineTo(0,0);
        ctx.closePath();
    
        ctx.fill();
        ctx.stroke();
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
    },
    
    render: function () {
        var ctx = this.app.ctx;
        ctx.save();
        
        /* Render scale */
        ctx.fillStyle = "rgba(240,240,255,0.1)";
        ctx.strokeStyle = "rgba(240,240,255,0.3)";
        ctx.lineWidth = 1;
        
        this._render_bar(this.radius, this.label);
        ctx.restore();
        
        ctx.save();
        
        /* Render value */
        ctx.fillStyle = "rgba(240,240,255,0.4)";
        ctx.strokeStyle = "rgba(240,240,255,1.0)";
        ctx.lineWidth = 1;
        
        this._render_bar(this.parent_radius+(this.radius-this.parent_radius)*(this.scale_value()/100.0),'');
        
        ctx.restore();
    }
})