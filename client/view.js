
var View = Class.extend({
    init: function (app, settings) {
        this.app = app;
        this.settings = settings;
        this.modal = null;
        this._frames = [];
        this.fps = 5;
        this.world = null;
        
        // Initialise view
        // Set canvas size
        this.on_resize(null);
        $(window).resize($.proxy(this.on_resize, this));
        
        // Display connecting dialog
        this.on_connecting();
    },
    
    // On resize of window, trigger resize of canvas to match
    on_resize: function (e) {
        // Static supercanvas
        //this.app.canvas.width = 2500;
        //this.app.canvas.height = 1200;
        // Dynamic canvas
        this.app.canvas.width = window.innerWidth;
        this.app.canvas.height = window.innerHeight;

        this.app.real_width = this.app.canvas.width;
        this.app.real_height = this.app.canvas.height;
        // Auto-scaling (static width canvas)
        //this.app.scale = this.app.real_width / this.app.width;
        //this.app.height = this.app.real_height / this.app.scale;
        // No scaling (expanding canvas)
        this.app.width = this.app.real_width;
        this.app.height = this.app.real_height;
    },

    background: function () {
        var ctx = this.app.ctx;
        var width = this.app.width;
        var height = this.app.height;

        ctx.scale(this.app.scale, this.app.scale);
        ctx.save();
        // Clear to grey
        ctx.fillStyle = "#303030";
        ctx.fillRect(0,0,width,height);
        
        // Render grid
        ctx.strokeStyle = "#1f1f1f";
        ctx.lineWidth=0.2;
        ctx.beginPath();
        for (var i=0; i<this.app.width; i+=40) {
            ctx.moveTo(0.5,i+0.5);
            ctx.lineTo(width+0.5,i+0.5);
            ctx.moveTo(i+0.5,0.5);
            ctx.lineTo(i+0.5,height+0.5);
            ctx.fillStyle = "#555";
            ctx.fillText(""+i, i,10);
            ctx.fillText(""+i, 2,i);
        }
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = "black";
        ctx.strokeStyle = "black";
        
    },
    
    // Set up modal dialog explaining connection is in progress
    on_connecting: function () {
        this.modal = $('<div title="Connecting.." style="text-align: center;">Connection to ' + this.settings.wsuri + ' in progress, please wait..<img style="margin: 5px;" src="spinner.gif" /></div>');
        $(this.modal).dialog({modal: true, hide: 'fade', resizable: false, beforeClose: function () { return false; }});
    },
    
    // Remove modal connection dialog
    on_connect: function () {
        this.close_modal();
    },
    
    close_modal: function () {
        if (this.modal) {
            $(this.modal).dialog("option", "beforeClose", function () { return true; });
            $(this.modal).dialog("close");
            this.modal = null;
        }
    },
    
    // Hard fail on disconnect for the moment
    on_disconnect: function () {
        this.close_modal();
        this.modal = $('<div title="Disconnected" style="text-align: center;">Connection to ' + this.settings.wsuri + ' lost</div>');
        $(this.modal).dialog({modal: true, hide: 'fade', resizable: false, beforeClose: function () { return false; }});
    },

    // Fatal error
    on_fatal_error: function (message) {
        this.close_modal();
        this.modal = $('<div title="Fatal error">' + message + '</div>');
        $(this.modal).dialog({modal: true, beforeClose: function () { return false; }});
    },
    
    // Render graphic statistics
    stats: function () {
        var ctx = this.app.ctx;
        
        ctx.save();
        // Render stats
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = '800 20px Neuropol';
        ctx.fillText(Math.round(this.fps)+"fps", 2.5, 30.5);
        
        if (this.app.current_time) {
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            var now = new Date(this.app.current_time*1000);
            var now_time = now.toTimeString().substr(0,8);
            var now_tz = now.toTimeString().substr(9);
            ctx.font = '600 10px Neuropol';
            ctx.fillText("" + now.toDateString(), this.app.width-110, 20.5);
            ctx.font = '600 20px Neuropol';
            ctx.fillText("" + now_time, this.app.width-110, 37.5);
            ctx.fillStyle = "#555";
            ctx.font = '600 9px Neuropol';
            ctx.fillText("" + now_tz, this.app.width-110, 47.5);
            
            //ctx.fillText("" + new Date(this.app.current_time*1000).toLocaleString(), this.app.width-320, 20.5);
        }
        
        ctx.restore();
    },
    
    // Render a frame
    frame: function () {
        // Clear background
        this.app.ctx.font = '600 9px Arial';
        this.app.ctx.save();
        this.background();
        
        // Render world
        if (this.world) {
            this.world.render();
        }
        
        // Recalculate frame statistics
        var now = new Date().getTime();
        
        this._frames.push(now);
        if (this._frames.length > 30) {
            this._frames.shift();
            this.fps = (this._frames.length * 1000.0) / (now - this._frames[0])
        }
        
        // Render overlay
        this.stats();
        
        this.app.ctx.restore();
    }
    
})