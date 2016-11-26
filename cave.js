var renderer, stage;
function start() {
    renderer = PIXI.autoDetectRenderer(600, 600, {backgroundColor : 0x1099bb});
    renderer.smoothProperty = true;
    stage = new PIXI.Container();
    document.getElementById('content').appendChild(renderer.view);
    (function() {
        init();

        var then = Date.now();
        var fps = 30;
        var interval = 1000/fps;
        //main loop
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
/**** State logic ****

Grid
Matriz bidimensional, cuando se le pide un valor fuera de rango devuelve uno por defecto
    + cons(rows, cols, out_of_bounds_value)
    + init(fn i, j -> x)
    + get(i, j) -> x
    + set(i, j, x) -> void
    + clone() -> Grid
*/
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
/**
CellularAutomata
Autómata celular
    + cons(Grid, (i, j, x, Grid) -> x)
    + reset() -> ()
    + step() -> ()
    + end() -> Bool
    + step_count :: Int
*/
// fn transitionfn(i, j, value, grid)
var CellularAutomata = function(grid, transitionfn) {
    this.step_count = 0;
    this.isEnd = false;
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
        this.isEnd = true;
};
CellularAutomata.prototype.end = function() {
    return this.isEnd;
};
/**** !END State logic ****/

/**** View State ****

CAViewState
Renderiza/actualiza/controla un autómata celular
    + cons(rows, cols, tile_width, tile_height, cell_textures, update_interval)
    + updateNow(CallularAutomata) -> ()
    + update(CellularAutomata, dt) -> ()
    + stage :: PIXI.Container
*/
var CAViewState = function(rows, cols, tw, th, cellTexs, time, steps) {
    this.time = time;
    this.elapsed = 0;
    this.rows = rows;
    this.cols = cols;
    this.tw = tw;
    this.th = th;
    this.cellTexs = cellTexs;
    this.steps = steps;
    this.step_count = 0;
    this.tiles = [];
    this.stage = new PIXI.Container();
    for (var i = 0; i < rows; i++) {
        for (var j = 0; j < cols; j++) {
            var spr = new PIXI.Sprite();
            spr.x = j * tw;
            spr.y = i * th;
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
    this.step_count++;
};
CAViewState.prototype.update = function(ca, dt) {
    this.elapsed += dt;
    if(this.elapsed > this.time) {
        this.elapsed -= this.time;
        this.updateNow(ca);
    }
};
CAViewState.prototype.end = function() {
    return this.step_count >= this.steps;
};

/**** !END View State ****/

var game = {
    initLiveProbability : 0.45,
    rows: 60, cols: 60,
    //colors: ['#17216a', '#af3636'],
    deadColor: '#17216a',
    aliveColor: '#af3636',
    steps: 5,
    update_interval: 100,
    survivalThreshold: 4,
    birthThreshold: 5
};
var numAliveNeighbours = function(i, j, grid) {
    return grid.get(i-1, j-1) + grid.get(i-1, j) + grid.get(i-1, j+1) +
            grid.get(i, j-1) + grid.get(i, j+1) +
            grid.get(i+1, j-1) + grid.get(i+1, j) + grid.get(i+1, j+1);
}
var trans = function(i, j, x, grid) {
    var count = numAliveNeighbours(i, j, grid);
    return ((x == 1 && count >= game.survivalThreshold) ||
            (x == 0 && count >= game.birthThreshold))*1;
};
var ca, grid, caView;

function genCellTex(col, w, h) {
    var g = new PIXI.Graphics();
    g.beginFill(col);
    g.drawRect(0, 0, w, h);
    return renderer.generateTexture(g);
}
function restartGame() {
    grid = new Grid(game.rows, game.cols, 1);
    grid.init(function() { return (Math.random() <= game.initLiveProbability)*1;});
    ca = new CellularAutomata(grid, trans);

    var cellTexs = [];
    var colors = [game.deadColor, game.aliveColor];
    var sz1 = Math.ceil(renderer.width / game.cols),
        sz2 = Math.ceil(renderer.height / game.rows);
    for (var i = 0; i < colors.length; i++) {
        cellTexs[i] = genCellTex(('0x'+ colors[i].substring(1))*1, sz1, sz2);
    }
    caView = new CAViewState(game.rows, game.cols, sz1, sz2, cellTexs,
        game.update_interval, game.steps);
}
function init() {
    restartGame();
    var timerID = undefined;
    var doRestart = function() {
        clearInterval(timerID);
        timerID = undefined;
        restartGame();
    };
    var scheduleRestart = function(t) {
        return function() {
            if(timerID !== undefined) clearInterval(timerID);
            timerID = setInterval(doRestart, t);
        };
    };
    var gui = new dat.GUI({ autoPlace: false });
    var c;
    c = gui.add(game, 'initLiveProbability', 0, 1).step(0.05);
    c.onChange(scheduleRestart(800));
    c = gui.add(game, 'rows', 3, 200).step(1);
    c.onChange(scheduleRestart(800));
    c = gui.add(game, 'cols', 3, 200).step(1);
    c.onChange(scheduleRestart(800));
    c = gui.addColor(game, 'deadColor');
    c.onChange(scheduleRestart(800));
    c = gui.addColor(game, 'aliveColor');
    c.onChange(scheduleRestart(800));
    c = gui.add(game, 'steps', 1, 100).step(1);
    c.onChange(scheduleRestart(800));
    c = gui.add(game, 'update_interval', 0, 2000).step(100);
    c.onChange(scheduleRestart(800));
    c = gui.add(game, 'survivalThreshold', 0, 8).step(1);
    c.onChange(scheduleRestart(800));
    c = gui.add(game, 'birthThreshold', 0, 8).step(1);
    c.onChange(scheduleRestart(800));
    document.getElementById('content').appendChild(gui.domElement);
    gui.domElement.setAttribute('id', 'gui');
}

function update(dt) {
    if(!caView.end() && !ca.end())
        caView.update(ca, dt);
}
function render() {
    renderer.render(caView.stage);
}
start();
