
/* A Layer simply contains a pile of elements it renders in insertion order */
// TODO: Add z-order

var Element = Receiver.extend({
    init: function () {
        this.children = [];
        this.parent = null;
    },
    
    add: function (element) {
        this.children.push(element);
        element.parent = this;
        return element;
    },
    
    root: function () {
        var c = this;
        while (true) {
            if (c.parent != null) {
                c = c.parent;
            } else {
                return c;
            }
        }
    },
    
    ctx: function () {
        return this.root()._ctx;
    },
    
    render: function () {
        for (var i=0; i<this.children.length; i++) {
            this.children[i].render();
        }
        
    }
})

var Layer = Element.extend({});

var DimLink = Element.extend({
    // Canvas context, array of vectors, x axis length in data, link max mbit/s
    init: function (path, max_mbps) {
        this._super();
        this.path = path;
        this.max_mbps = max_mbps;
        this.vectors = [];
        this.decompose();
        this.error = false;
    },
    
    receive: function (m) {
        if (m.type == 'status') {
            this.error = m.error;
        }
    },
    
    // Internal function decomposes simple path into usable one with rounded corners
    decompose: function () {
        var radius = 20; // Radius of corners
        var step = 5; // Accuracy. Larger steps = simpler path but more blocky
        
        var origin = this.path[0]; // First path position
        var delta = this.path[1].subtract(origin).normalise(); // Unit delta from origin to next step
        
        var new_path = [origin]; // Start new path at origin
        var vectors = [delta]; // Start vector record at first delta

        var pos = origin; // Current position is origin
        
        // Iterate over path decomposing
        for (var i=1; i<this.path.length; i++) {
            next = this.path[i];
            
            if (i!=this.path.length-1) {
                // If we're not at the end, the next delta is calculated
                next_delta = this.path[i+1].subtract(next).normalise();
            } else {
                // Otherwise, just continue with the existing delta
                next_delta = delta;
            }
            
            // Segment length is next-pos
            segment_length = Math.round(next.subtract(pos).size()); // May need to round pos
            
            if (i<this.path.length-1) {
                // Start and mid segments are always one radius shorter for the curve at either end
                segment_length -= radius;
            }
            
            // Do straight-line portion of the segment
            for (var d=0; d<((segment_length)/step); d++) {
                // New pos is old pos + delta*step
                var new_pos = pos.add(delta.multiply(step));
                new_path.push(new_pos);
                this.vectors.push(delta);
                pos = new_pos;
            }
            
            // Do curve portion of segment
            // If we're at the end of the path, don't bother
            if (i != this.path.length-1) {
                
                // Iterate around the corner. We start from 1 because that position has already been built by the straight section
                for (var d=1; d<((radius*2)/step); d++) {
                    // Each step around the corner needs to be step length. This is
                    // simple enough, we just multiply the vector by step
                    var fraction = d / ((radius*2)/step);
                    // Corner delta is the weighted average of the current and next delta
                    var corner_delta = delta.multiply(1-fraction).add(next_delta.multiply(fraction)).normalise();
                    
                    var new_pos = pos.add(corner_delta.multiply(step));
                    
                    this.vectors.push(corner_delta); // Add corner delta to vectors
                    new_path.push(new_pos); // Add new position to path
                    pos = new_pos;
                }
            }
            // Round the position off at the end of each path to avoid...problems
            pos = pos.round();
            delta = next_delta;
        }
        
        this.vectors.push(delta);
        this.path = new_path;
        
    },
    
    render: function () {
        this._super();
        
        // Offset represents a fraction of a full step to move, for interpolated charts
        var scale = 1/(8*1024*1024*this.max_mbps/10);
        var ctx = this.ctx();
        
        
        ctx.save();
        
        ctx.strokeStyle="#777";
        if (this.error) {
            var intensity = 3+2*(Math.sin(new Date().getTime() /500));
            ctx.strokeStyle = "rgba(240,40,0,"+(intensity/10)+")";
            ctx.lineWidth = 6;
            ctx.beginPath();
            
            ctx.moveTo(this.path[0].x+0.5, this.path[0].y+0.5);
            
            for (var i=0; i<this.path.length; i++) {
                ctx.lineTo(this.path[i].x+0.5, this.path[i].y+0.5);
            }
            
            ctx.stroke();
            ctx.strokeStyle="#333";
        }
        
        ctx.beginPath();
        
        // Jump to line start
        ctx.moveTo(this.path[0].x+0.5, this.path[0].y+0.5);
        
        for (var i=0; i<this.path.length; i++) {
            ctx.lineTo(this.path[i].x+0.5, this.path[i].y+0.5);
        }
        
        
        ctx.lineWidth = 2;
        ctx.stroke();
        
        
        ctx.restore();
    }
    
});

var Link = Element.extend({
    // Canvas context, array of vectors, x axis length in data, link max mbit/s
    init: function (path, history, max_mbps) {
        this._super();
        this.path = path;
        this.history = history;
        this.max_mbps = max_mbps;
        this.flow_in = [];
        this.flow_out = [];
        this.vectors = [];
        this.decompose();
        
        this.offset = 0;
        this.delta = 0;
        
        for (var i=0; i<this.history; i++) {
            this.flow_in.push(0);
            this.flow_out.push(0);
        }
    },
    
    // If we get a message, check its type and reset the right flow
    receive: function (m) {
        if (m.type == 'bits_per_second_in') {
            this.flow_in = [];
            this.offset = 0;
            this.delta = 1.0 / this.root().fps;
            var hi = m.history.length-this.history;
            for (var i=this.history-1; i>=0; i--) {
                if (m.history[hi+i]) {
                    this.flow_in.push(m.history[hi+i].bits_per_second);
                } else {
                    this.flow_in.push(0);
                }
            }
        } else if (m.type == 'bits_per_second_out') {
            this.flow_out = [];
            var hi = m.history.length-this.history;
            for (var i=0; i<this.history; i++) {
                if (m.history[hi+i]) {
                    this.flow_out.push(m.history[hi+i].bits_per_second);
                } else {
                    this.flow_out.push(0);
                }
            }
        }
    },
    
    // Internal function decomposes simple path into usable one with rounded corners
    decompose: function () {
        var radius = 20; // Radius of corners
        var step = 5; // Accuracy. Larger steps = simpler path but more blocky
        
        var origin = this.path[0]; // First path position
        var delta = this.path[1].subtract(origin).normalise(); // Unit delta from origin to next step
        
        var new_path = [origin]; // Start new path at origin
        var vectors = [delta]; // Start vector record at first delta

        var pos = origin; // Current position is origin
        
        // Iterate over path decomposing
        for (var i=1; i<this.path.length; i++) {
            next = this.path[i];
            
            if (i!=this.path.length-1) {
                // If we're not at the end, the next delta is calculated
                next_delta = this.path[i+1].subtract(next).normalise();
            } else {
                // Otherwise, just continue with the existing delta
                next_delta = delta;
            }
            
            // Segment length is next-pos
            segment_length = Math.round(next.subtract(pos).size()); // May need to round pos
            
            if (i<this.path.length-1) {
                // Start and mid segments are always one radius shorter for the curve at either end
                segment_length -= radius;
            }
            
            // Do straight-line portion of the segment
            for (var d=0; d<((segment_length)/step); d++) {
                // New pos is old pos + delta*step
                var new_pos = pos.add(delta.multiply(step));
                new_path.push(new_pos);
                this.vectors.push(delta);
                pos = new_pos;
            }
            
            // Do curve portion of segment
            // If we're at the end of the path, don't bother
            if (i != this.path.length-1) {
                
                // Iterate around the corner. We start from 1 because that position has already been built by the straight section
                for (var d=1; d<((radius*2)/step); d++) {
                    // Each step around the corner needs to be step length. This is
                    // simple enough, we just multiply the vector by step
                    var fraction = d / ((radius*2)/step);
                    // Corner delta is the weighted average of the current and next delta
                    var corner_delta = delta.multiply(1-fraction).add(next_delta.multiply(fraction)).normalise();
                    
                    var new_pos = pos.add(corner_delta.multiply(step));
                    
                    this.vectors.push(corner_delta); // Add corner delta to vectors
                    new_path.push(new_pos); // Add new position to path
                    pos = new_pos;
                }
            }
            // Round the position off at the end of each path to avoid...problems
            pos = pos.round();
            delta = next_delta;
        }
        
        this.vectors.push(delta);
        this.path = new_path;
        
    },
    
    // Internal function renders one or the other side of the flow
    render_flow: function (data, side, offset, scale) {
        // Dataset, 1 for right/bottom, -1 for left/top, motion offset
        var path_step = (this.path.length-1) / this.history; // Path step per history unit
        var ctx = this.ctx();
        
        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        
        for (var i = 0; i<this.history-1; i++) {
            var value = data[i];
            var vi = (i+(1-offset))*path_step; // Approximate index into path/vector arrays
            
 
            var min_vi = Math.max(Math.floor(vi),0);
            var max_vi = Math.min(Math.ceil(vi),this.path.length-1);
            
            var pos1 = this.path[min_vi];
            var pos2 = this.path[max_vi];
            
            
 
            // A better algorithm would be to calculate the full position for each vectorpoint
            // then do the weight averaging. This just needs a shuffle around and should give smoother
            // cornering
 
            // Calculate simple interpolated position and vector
            try {
                var position = pos1.add(pos2.subtract(pos1).multiply(vi%1));
            } catch (e) {
                console.log(e,this.root().fps,vi,min_vi,max_vi,this.path.length, path_step, offset);
            }
            var vector = this.vectors[min_vi].multiply(vi%1).add(this.vectors[max_vi].multiply(1-vi%1));
 
 
 
            if (!value) {
                ctx.lineTo(position.x+0.5, position.y+0.5);
                continue;
            }

            ctx.lineTo(position.x+0.5+side*(value * scale * vector.y), position.y+0.5+(-side)*(value * scale * vector.x));            
        }
        
        // Walk back along the actual path
        for (var i=this.path.length-1; i>=0; i--) {
            ctx.lineTo(this.path[i].x+0.5, this.path[i].y+0.5);
        }
        
        ctx.closePath();
    },
    
    render: function () {
        this._super();
        // Offset represents a fraction of a full step to move, for interpolated charts
        var scale = 1/(8*1024*1024*this.max_mbps/10);
        var ctx = this.ctx();
        
        ctx.save();
        
        ctx.fillStyle = "rgba(180,255,0,0.6)";
        this.render_flow(this.flow_in, 1, 1-this.offset, scale);
        ctx.fill();
        
        ctx.fillStyle = "rgba(255,180,0,0.6)";
        this.render_flow(this.flow_out, -1, this.offset, scale);
        ctx.fill();
        
        
        ctx.strokeStyle = "rgba(240,240,240,1)";
        ctx.beginPath();
        // Jump to line start
        ctx.moveTo(this.path[0].x+0.5, this.path[0].y+0.5);
        
        for (var i=0; i<this.path.length; i++) {
            ctx.lineTo(this.path[i].x+0.5, this.path[i].y+0.5);
        }
        
        ctx.lineWidth = 2;
        ctx.stroke();

        this.offset += this.delta;
        if (this.offset >1) {
            this.offset = 1;
        }
        
        ctx.restore();
    }
    
});

var NodeBar = Element.extend({
    init: function (node, radius, angle, arc, label) {
        this._super();
        this.node = node;
        this.radius = radius;
        this.angle = angle;
        this.arc = arc;
        this.label = label;
        this.value = 0;
        this.old_value = 0;
        this.offset = 0;
        this.delta = 0;
    },
    
    receive: function (m) {
        this.offset = 0;
        if (m.value != null) {
            this.old_value = this.value;
            this.value = m.value;
            this.delta = 1/this.root().fps;
        }
    },
    
    _render_bar: function (radius, label) {
        var ctx = this.ctx();
        var x = this.node.x;
        var y = this.node.y;
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
        this._super();
        var ctx = this.ctx();
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
        
        this._render_bar(this.node.radius+(this.radius-this.node.radius)*(this.old_value + ((this.value-this.old_value)*this.offset)),'');
        
        ctx.restore();
        
        this.offset += this.delta;
        if (this.offset > 1) {
            this.offset = 1;
        }
        
    }
    
})

var Node = Element.extend({
    init: function (x, y, radius) {
        this._super();
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.bars = [];
        this.error = false;
    },
    
    receive: function (m) {
        if (m.type == 'status') {
            this.error = m.error;
        }
    },
    
    render: function () {
        this._super();
        var ctx = this.ctx();
        
        ctx.save();
        for (var i=0; i<this.bars.length; i++) {
            this.bars[i].render();
        }
        ctx.restore();
        ctx.save();
        
        if (this.error) {
            var intensity = 3+2*(Math.sin(new Date().getTime() /500));
            ctx.strokeStyle = "rgba(240,40,0,"+(intensity/10)+")";
            ctx.lineWidth = 6;
            ctx.beginPath();
            
            ctx.arc(this.x,this.y,this.radius+6,0,Math.PI*2);
            ctx.closePath();
            
            ctx.stroke();
        }
        
        ctx.fillStyle = "rgba(100,100,120,1.0)";
        ctx.strokeStyle = "rgba(240,240,255,1.0)";
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        
        ctx.arc(this.x,this.y,this.radius,0,Math.PI*2);
        ctx.closePath();
        
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    },
    
    add_bar: function (radius, angle, arc, label) {
        return this.add(new NodeBar(this, radius, angle, arc, label));
    }
    
    
});


var Cloud = Element.extend({
    init: function (x, y, width, height, radius) {
        this._super();
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.radius = radius;
        this.bars = [];
    },
    
    render: function () {
        this._super();
        var ctx = this.ctx();
        var x = this.x;
        var y = this.y;
        var radius = this.radius;
        var width = this.width;
        var height = this.height;
        
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(this.x + this.radius, this.y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.strokeStyle="rgba(255,255,255,0.8)";
        ctx.fillStyle="#333";
        ctx.lineWidth=5;
        ctx.stroke();
        ctx.fill();
        ctx.restore();
    }
});

var Display = Element.extend({
    init: function (ctx, width, height) {
        this._super();
        
        this._ctx = ctx;
        this.fps = 5;
        this.frames = 0;
        this.start = new Date().getTime();
        this.width = width;
        this.height = height;
        this.layers = [];
    },
    
    clear: function () {
        var ctx = this.ctx();
        ctx.save();
        
        // Clear to grey
        ctx.fillStyle = "#303030";
        ctx.fillRect(0,0,this.width,this.height);
        
        // Render grid
        ctx.strokeStyle = "#1f1f1f";
        ctx.lineWidth=0.2;
        ctx.beginPath();
        for (var i=0; i<Math.max(this.height,this.width); i+=40) {
            ctx.moveTo(0.5,i+0.5);
            ctx.lineTo(this.width+0.5,i+0.5);
            ctx.moveTo(i+0.5,0.5);
            ctx.lineTo(i+0.5,this.height+0.5);
            ctx.fillStyle = "#777";
            ctx.fillText(""+i, i,10);
            ctx.fillText(""+i, 2,i);
        }
        ctx.stroke();
        ctx.closePath();

        // Render logo        
        ctx.fillStyle = "#444";
        ctx.font = '800 30px sans-serif';
        ctx.fillText("p7.a", 30.5, 40.5);
        
        // Render stats
        ctx.fillStyle = "#564";
        ctx.font = '800 20px sans-serif';
        ctx.fillText(Math.round(this.fps)+"fps", 480.5, 40.5);
        ctx.restore();
        
        this.frames+=1;
        this.fps = this.frames / (((new Date().getTime()+1)-this.start)/1000);
        if (this.fps < 1) {
            this.fps = 1;
        }
        if (this.fps > 50) {
            this.fps = 50;
        }
    }
});

