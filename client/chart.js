/* Example config:
  
{eth0:
    {
        scale: {
            type: 'LogScale',
            limit: 1073741824, // 1gbit, not useful since full duplex can actually do 2gbit
            input_type: 'bytes',
            output_type 'bits'
        },
        data: {
            sources: [
                {source: 'interface/interface/eth0#0', color: 'green', label: 'in'},
                {source: 'interface/interface/eth0#1', color: 'orange', label: 'out'},
            ]
        },
        render: {
            type: 'ArcBar',
            radius: 24,
            angle: -90,
            arc: 180,
            width: 20,
            label: 'eth0'
        }
    }
}
*/
if (com.p7.chart == undefined) {
    com.p7.chart = {};
}

com.p7.chart.Chart = Class.extend({
    init: function (app, id, prefix, config) {
        this.app = app;
        this.id = id;
        this.prefix = prefix;
        this.c = config;
        
        // Construct scale
        this.scale = new com.p7.scale[this.c.scale.type](this.app, this.c.scale);
        
        console.log("Prefix ",prefix);
        // Construct Stack from sources
        this.data_handler = new com.p7.data.Stack(this.app, prefix, this.c.data);
        
        // Construct Renderer
        this.renderer = new com.p7.render[this.c.render.type](this.app, this.scale, this.data_handler, this.c.render);
    },
    
    render: function () {
        this.renderer.render();
    }
});

