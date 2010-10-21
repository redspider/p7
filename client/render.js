if (com.p7.render == undefined) {
    com.p7.render = {};
}

com.p7.render.Render = Class.extend({
    // 
    init: function (app, scale, data, config) {
        this.app = app;
        this.data = data;
        this.scale = scale;
        this.c = config;
    },
    
    // Render data according to data, into scale
    render: function (data) {
        throw 'Abstract function';
    },
    
    // Get color
    color: function (name, i, alpha) {
        if (name) {
            var color = com.p7.style.color[name];
            return color.substr(0,color.length-2)+alpha+")";
        }
        return "rgba(200,200,200,"+alpha+"1)";
    },
    
    // Normalize an angle (in radians)
    normalize_angle: function (r) {
        while (r < 0) {
            r+=Math.PI*2;
        }
        return r % (Math.PI*2)
    }
});

com.p7.render.ArcBar = com.p7.render.Render.extend({
    
    // Draw an arc bar at radius, from-to. From and To are specified in fractions of 360deg
    _segment: function (radius, from, to) {
        var ctx = this.app.ctx;
        ctx.save();
        
        ctx.beginPath();
        
        // Start angle in radians
        var start = (this.c.angle/360.0)*Math.PI*2;
        // Size in radians
        var size = (this.c.arc/360)*Math.PI*2;
        
        // Draw an arc from-to
        // We rotate back 90deg (so we start from 12 oclock), then forward start angle, then to From
        ctx.rotate(-Math.PI/2+start+size*from);
        // Draw arc to end
        ctx.arc(0,0,radius,0,size*(to-from));
        // Rotate to end because we're lazy
        ctx.rotate(size*(to-from));
        // Draw line outwards
        ctx.lineTo(radius+this.c.width);
        // Arc backwards
        ctx.arc(0,0,radius+this.c.width,0,-size*(to-from),1);
        // Rotate back because we're SO lazy
        ctx.rotate(-size*(to-from));
        // Draw line inwards
        ctx.lineTo(radius,0);
        
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    },
    
    _label: function (radius, fraction, label) {
        var ctx = this.app.ctx;
        ctx.save();
        
        // Start angle in radians
        var start = (this.c.angle/360.0)*Math.PI*2;
        // Size in radians
        var size = (this.c.arc/360)*Math.PI*2;
        
        // Draw an arc from-to
        // We rotate back 90deg (so we start from 12 oclock), then forward start angle, then to From
        var position = this.normalize_angle(-Math.PI/2+start+size*fraction);
        ctx.rotate(position);
        ctx.font = '800 9px sans-serif';
        ctx.fillStyle = 'rgba(250,230,180,1.0)';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        
        ctx.translate(radius+this.c.width/2,0);
        
        // Check to see if we've rotated upside-down
        if (position > 0 && position < Math.PI) {
            ctx.rotate(-Math.PI/2);
        } else {
            ctx.rotate(Math.PI/2);
        }
        
        // Commented section renders a dim background box around the text to make it
        // easier to read
        //var w = ctx.measureText(label).width;
        //ctx.fillStyle = 'rgba(0,0,0,0.4)';
        //ctx.fillRect(-w/2-3,-4,w+6,8);
        ctx.fillStyle = 'rgba(100,100,100,1.0)';
        ctx.fillText(label, 0,0);
      
        ctx.restore();  
    },
    
    render: function () {
        var ctx = this.app.ctx;
        ctx.save();
        if (this.c.x && this.c.y) {
            ctx.translate(this.c.x, this.c.y);
        }
        
        // Render background
        
        ctx.save();
        
        ctx.fillStyle = "rgba(0,0,0,0.4)";
        ctx.strokeStyle = "rgba(0,0,0,1)";
        ctx.lineWidth = 1;
        
        this._segment(this.c.radius,0,1.0);
        
        ctx.restore();
        
        ctx.save();
        ctx.lineWidth = 1;
        
        var values = this.data.smooth_values();
        var attrs = this.data.attributes();
        var offset = 0;
        
        
        // Render each value stacked on the other
        for (var i=0; i<values.length; i++) {
            ctx.fillStyle = this.color(attrs[i].color,i,1);
            ctx.strokeStyle = this.color(attrs[i].color,i,0.5);
            this._segment(this.c.radius, this.scale.scale(offset), this.scale.scale(values[i]+offset));
            offset += values[i];
        }
        
        if (this.c.width > 5) {
            this._label(this.c.radius, 0.5, this.scale.label(this.data.sum()));
        }
        
        ctx.restore();
        
        ctx.restore();
    }
})