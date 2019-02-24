Function.prototype.inheritsFrom = function(parentClassOrObject) { 
    if(parentClassOrObject.constructor == Function) { 
        //Normal Inheritance 
        this.prototype = new parentClassOrObject;
        this.prototype.constructor = this;
        this.prototype.parent = parentClassOrObject.prototype;
    } 
    else { 
        //Pure Virtual Inheritance 
        this.prototype = parentClassOrObject;
        this.prototype.constructor = this;
        this.prototype.parent = parentClassOrObject;
    } 
    return this;
}

function getRandom(min, max) {
    return Math.random() * (max - min) + min;
}

function getRandomInt(min, max) {
    return Math.round(Math.random() * (max - min) + min);
}

function clamp01(value) {
  return Math.min(Math.max(value, 0), 1);
}