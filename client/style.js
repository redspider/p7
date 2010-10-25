com.p7.style = {};

com.p7.style.RGB = Class.extend({
    init: function (red, green, blue) {
        this.r = Math.min(Math.max(0,red),255);
        this.g = Math.min(Math.max(0,green),255);
        this.b = Math.min(Math.max(0,blue),255);
    },
    
    toHSV: function () {
        var r = this.r / 255;
        var g = this.g / 255;
        var b = this.b / 255;
        
        var minv = Math.min(r,g,b);
        var maxv = Math.max(r,g,b);
        var delta = maxv-minv;
        
        var v = maxv;
        var h = 0;
        var s = 0;
        
        if (delta != 0) {
            s = delta / maxv;
            
            var delta_r = (((maxv - r) / 6) + (delta / 2)) / delta;
            var delta_g = (((maxv - g) / 6) + (delta / 2)) / delta;
            var delta_b = (((maxv - b) / 6) + (delta / 2)) / delta;
            
            if (r == maxv) {
                h = delta_b - delta_g;
            } else if (g == maxv) {
                h = (1/3) + delta_r - delta_b;
            } else if (b == maxv) {
                h = (2/3) + delta_g - delta_r;
            }
            
            if (h < 0) { h+= 1; }
            if (h > 1) { h-= 1; }
        }
        
        return new com.p7.style.HSV(h*360, s*100, v*100);
    }
});

com.p7.style.HSV = Class.extend({
    init: function (hue, saturation, value) {
        this.h = Math.min(Math.max(0,hue),360);
        this.s = Math.min(Math.max(0,saturation),100);
        this.v = Math.min(Math.max(0,value),100);
    },
    
    toRGB: function () {
        var h = this.h / 360;
        var s = this.s / 100;
        var v = this.v / 100;
        
        if (s == 0) {
            return new com.p7.style.RGB(v*255, v*255, v*255);
        }
        
        var vh = h * 6;
        var vi = Math.floor(vh);
        var v1 = v * (1 - s);
        var v2 = v * (1 - s * (vh - vi));
        var v3 = v * (1 - s * (1 - (vh - vi)));
        var vr = null;
        var vg = null;
        var vb = null;
        
        if (vi == 0) {
            return new com.p7.style.RGB(v*255, v3*255, v1*255);
        } else if (vi == 1) {
            return new com.p7.style.RGB(v2*255, v*255, v1*255);
        } else if (vi == 2) {
            return new com.p7.style.RGB(v1*255, v*255, v3*255);
        } else if (vi == 3) {
            return new com.p7.style.RGB(v1*255, v2*255, v*255);
        } else if (vi == 4) {
            return new com.p7.style.RGB(v3*255, v1*255, v*255);
        } else {
            return new com.p7.style.RGB(v*255, v1*255, v2*255);
        }
    }
});

com.p7.style.Color = Class.extend({
    init: function (r,g,b,a) {
        this.rgb = new com.p7.style.RGB(r,g,b);
        this.a = a;
    },
    
    toString: function () {
        return "rgba(" + Math.floor(this.rgb.r) + "," + Math.floor(this.rgb.g) + "," + Math.floor(this.rgb.b) +"," + this.a + ")";
    },
    
    darken: function (v) {
        var hsv = this.rgb.toHSV();
        hsv.v -= v;
        hsv.v = Math.max(hsv.v, 0);
        this.rgb = hsv.toRGB();
    },
    
    brighten: function (v) {
        var hsv = this.rgb.toHSV();
        hsv.v += v;
        hsv.v = Math.min(hsv.v, 100);
        this.rgb = hsv.toRGB();
    }
    
});

com.p7.style.colors = {
    ok: new com.p7.style.Color(189,212,121,1),
    warn: new com.p7.style.Color(222,184,126,1),
    alarm: new com.p7.style.Color(212,148,121,1)
};
