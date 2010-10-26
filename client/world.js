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
            var new_config = $.extend(true, {}, world.templates[config.template].config, config);
            config = new_config;
        }
        
        this.label = config.label;
        this.x = config.x;
        this.y = config.y;
        this.radius = config.radius;
        this.source_prefix = config.prefix;
        //this.children = world.builder(app, this, config.charts);
        this.children = [];
        for (var k in config.charts) {
            console.log(config.charts);
            var chart_config = config.charts[k];
            if (chart_config) {
                this.children.push(new com.p7.chart.Chart(this.app, k, this.source_prefix, chart_config));
            }
        }
        
    },
    
    // Render router
    render: function () {
        var ctx = this.app.ctx;
        
        ctx.save();
        ctx.translate(this.x, this.y);
        
        for (var k in this.children) {
            this.children[k].render();
        }
        
        ctx.restore();
        
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
        ctx.font = '800 9px Arial';
        //ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        //ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(255,255,155,1.0)';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        ctx.beginPath();
        //ctx.strokeText(this.label, this.x,this.y);
        ctx.fillText(this.label, this.x,this.y);
        
        ctx.restore();
        
    }
});
