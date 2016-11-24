var renderer, stage;
function start() {
    renderer = PIXI.autoDetectRenderer(800, 600, {backgroundColor : 0x1099bb});
    renderer.smoothProperty = true;
    stage = new PIXI.Container();
    document.body.appendChild(renderer.view);
    (function() {
        init();

        var then = Date.now();
        var fps = 30;
        var interval = 1000/fps;
        (function draw() {
            requestAnimationFrame(draw);
            now = Date.now();
            var dt = now - then;
            if(dt > interval) {
                then = now - (dt % interval);
                update(dt);
                render();
            }
        })();
    })();
}
/**** State logic ***/
var Grid = function(rows, cols, outvalue) {
    this.rows = rows;
    this.cols = cols;
    this.data = new Array(rows * cols);
    this.outvalue = outvalue;
};
Grid.prototype.init = function(fn) {
    for (var i = 0; i < this.rows; i++) {
        for (var j = 0; j < this.cols; j++) {
            var ix = i * this.cols + j;
            this.data[ix] = fn(i, j);
        }
    }
};
Grid.prototype.get = function(i, j) {
    if(i < 0 || j < 0 || i >= this.rows || j >= this.cols)
        return this.outvalue;
    return this.data[i * this.cols + j];
};
Grid.prototype.set = function(i, j, o) {
    if(i < 0 || j < 0 || i >= this.rows || j >= this.cols)
        return;
    this.data[i * this.cols + j] = o;
};
Grid.prototype.clone = function() {
    var o = new Grid(this.rows, this.cols, this.outvalue);
    o.data = this.data.slice();
    return o;
};
// fn transitionfn(i, j, value, grid)
var CellularAutomata = function(grid, transitionfn) {
    this.step_count = 0;
    this.end = false;
    this.grid = grid;
    this.transitionfn = transitionfn;
};
CellularAutomata.prototype.reset = function() {
    this.step_count = 0;
    this.end = false;
};
CellularAutomata.prototype.step = function() {
    var newgrid = [], change = false;
    for (var i = 0; i < this.grid.rows; i++) {
        for (var j = 0; j < this.grid.cols; j++) {
            var ix = i * this.grid.cols + j;
            newgrid.push(this.transitionfn(i, j, this.grid.data[ix], this.grid));
            change = change || newgrid[newgrid.length - 1] != this.grid.data[ix];
        }
    }
    if(change) {
        this.grid.data = newgrid;
        this.step_count++;
    }
    else
        this.end = true;
};
/**** !END State logic ***/

/**** View State ***/
var CAViewState = function(rows, cols, tw, th, cellTexs, time) {
    this.time = time;
    this.elapsed = 0;
    this.rows = rows;
    this.cols = cols;
    this.tw = tw;
    this.th = th;
    this.cellTexs = cellTexs;
    this.tiles = [];
    this.stage = new PIXI.Container();
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            var spr = new PIXI.Sprite();
            spr.x = j * th;
            spr.y = i * tw;
            this.tiles.push(spr);
            this.stage.addChild(spr);
        }
    }
};
CAViewState.prototype.updateNow = function(ca) {
    ca.step();
    for (var i = 0; i < this.rows; i++) {
        for (var j = 0; j < this.cols; j++) {
            var ix = i * this.cols + j,
                val = ca.grid.get(i, j);
            this.tiles[ix].texture = this.cellTexs[val];
        }
    }
};
CAViewState.prototype.update = function(ca, dt) {
    this.elapsed += dt;
    if(this.elapsed > this.time) {
        this.elapsed -= this.time;
        this.updateNow(ca);
    }
};
/**** !END View State ***/


var game = {
    livep : 0.5,
    rows: 60, cols: 60, sz: 10
};
var trans = function(i, j, x, grid) {
    var count = grid.get(i-1, j-1) + grid.get(i-1, j) + grid.get(i-1, j+1) +
                grid.get(i, j-1) + grid.get(i, j+1) +
                grid.get(i+1, j-1) + grid.get(i+1, j) + grid.get(i+1, j+1);
    return ((x == 1 && count >= 3) || (count >= 6))? 1 : 0;
};
var ca, grid, cellTexs, caView;

function genCellTex(col, n) {
    var g = new PIXI.Graphics();
    g.beginFill(col);
    g.drawRect(0, 0, n, n);
    return renderer.generateTexture(g);
}
function init() {
    grid = new Grid(game.rows, game.cols, 1);
    grid.init(function() { return Math.random() > game.livep ? 0 : 1; });
    ca = new CellularAutomata(grid, trans);

    cellTexs = [genCellTex(0x17216a, game.sz), genCellTex(0xaf3636, game.sz)];
    caView = new CAViewState(game.rows, game.cols, game.sz, game.sz, cellTexs, 650);
}
var leftkey = keyboard(37), upkey = keyboard(38), rightkey = keyboard(39), downkey = keyboard(40),
    zkey = keyboard(90), xkey = keyboard(88);

function update(dt) {
    if(!ca.end)
        caView.update(ca, dt);
}
function render() {
    renderer.render(caView.stage);
}
start();
