/* Basic vector class */
var Vector = Class.extend({
    init: function (x,y) {
        this.x = x;
        this.y = y;
    },
    
    size: function () {
        return Math.abs(Math.sqrt(this.x*this.x+this.y*this.y));
    },
    
    normalise: function () {
        var size = this.size();
        return new Vector(this.x/size, this.y/size);
    },
    
    round: function () {
        return new Vector(Math.round(this.x), Math.round(this.y));
    },
    
    add: function (v) {
        return new Vector(this.x+v.x, this.y+v.y);
    },
    
    subtract: function (v) {
        return new Vector(this.x-v.x, this.y-v.y);
    },
    
    multiply: function (n) {
        return new Vector(this.x*n, this.y*n);
    },
    
    divide: function (n) {
        return new Vector(this.x/n, this.y/n);
    }
});