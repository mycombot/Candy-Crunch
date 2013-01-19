/*global createjs console _*/// Thought we'd give jslint a try. What an annoying, useful program.
//Chromium: Run with --allow-file-access-from-files. Apparently it'll be fine in production.
mainWindow = function() {
	"use strict";
	
	//CONFIG
	var score = 10;
	
	var money = 50000;
	var destructionCost = 1000;
	
	var difficulty = 2;
	var minimumTileMatchCount = 2;
	
	var gameOver = false;
	
	//SETUP
	var canvas = document.getElementById('main');
	var stage = new createjs.Stage(canvas);
	
	stage.enableMouseOver();
	
	var Width = canvas.width;                 var Height = canvas.height;
	var tileWidth = 32;                       var tileHeight = 32;
	var xTiles = Math.floor(Width/tileWidth); var yTiles = Math.floor(Height/tileHeight);
	
	//The 'tile' object exists to make coordinating an object less of a chore.
	//var tileClickEvent = false;
	var getNewTile = function(){
		var tilePrototype = new createjs.Bitmap("images/tile-base.png");
		var lemon = new createjs.Bitmap("images/cc-by-sa/ails english/I_C_Lemon.png");
		var cherry = new createjs.Bitmap("images/cc-by-sa/ails english/I_C_Cherry.png");
		var oildrum = new createjs.Bitmap("images/cc-by-sa/ails english/E_Metal03.png");
		
		//TODO: tilePrototype's image may not have loaded from disk yet. Make sure they have.
		//Perhaps something to do with pausing the event loop before the first 'cycle' could work?
		
		var int = 0.75;
		var yellow = new createjs.ColorFilter(1,1,int,1);
		var red = new createjs.ColorFilter(1,int,int,1);
		
		//We'll be returning a composite type, here. It'll 'union' the layers together, and with map() the tiles should never 'fall apart'.
		//I'd prefer to have it so that when you set a property, the property was instead set in all children, and read from the 'base' tile only. However, my javascript-fu is weak, and I don't know how to do this well enough to make it work with easel.js. We will just go with mapping over the list of children (bits) for now.
		return function(type, row, column, index) { //x/y/z, z optional.
			var tileBackground = tilePrototype.clone();
			tileBackground.cache(0 ,0, tileBackground.image.width || tileWidth, tileBackground.image.height || tileHeight); //TODO: Once the previous todo is fixed, remove the check against tileWidth/height.
			var tileIcon;
			switch(type) {
			case "lemon":
				tileIcon = lemon.clone();
				tileBackground.filters = [yellow];
				break;
			case "cherry":
				tileIcon = cherry.clone();
				tileBackground.filters = [red];
				break;
			case "oildrum":
				tileIcon = oildrum.clone();
				break;
			}
			
			tileBackground.updateCache();
			
			var bits = [tileBackground, tileIcon];
			var indexOffset = 0;
			bits.map(function(bit) {
				if(index===undefined) {
					stage.addChild(bit);
				} else {
					stage.addChildAt(bit, index + indexOffset);
					indexOffset += 1;
				}
				bit.xFromTile = function(x) {return x*tileWidth;};
				bit.yFromTile = function(y) {return y*tileWidth;};
				bit.x = bit.xFromTile(row);
				bit.y = bit.yFromTile(column);
			});
			
			var tileToReturn = {
				cost: 1000,
				type: type,
				tile: tileBackground,
				icon: tileIcon,
				bits: bits,
				x:row, y:column
			};
			
			gamefield[row][column] = tileToReturn;
			return tileToReturn;
		};
	}();
	
	var gamefield = _
	.range(xTiles)
	.map(function() {
		return _
		.range(yTiles)
		.map(function() {
			return null;
		});
	});
	
	var frame = xTiles+yTiles; //It use to load from the top down, but I decided I wanted it to load from the bottom up. So... run time backwards, but we have to start with the right amount of time.
	var turn = 0;
	
	//Various modes of the game.
	var spawnTiles = null;
	var gameplay = null;
	
	var getRandomTileType = function() {
		var tileTypes = ['cherry', 'lemon',].slice(0,difficulty);
		return tileTypes[_.random(0,tileTypes.length-1)];
	};
	
	spawnTiles = function() {
		var rowsSpawnedPerFrame = 3;
		
		var spawnRow = function() {
			frame -= 1;
			if(frame < xTiles*2) {
				_.range(frame)
				.filter(function(row) {
					return row < xTiles && frame-1-row < yTiles; //Clip corners as we grow to the triange to the second half of the square.
				})
				.map(function(row) {
					var tile = getNewTile(getRandomTileType(), row, frame-1-row);
					tile.bits.map(function(bit){ //We'll animate the tile coming in like this. One of the nice things about separating the tile x from the tile graphics' xs is that it turns out that they're actually two different things that merely look the same. The tile's x is used for logic. It's where the tile /should be treated as being/, and is also the tile's index in the game grid. (This helps us in a few cases, so we don't have to go looking for it and check every tile in the game.) This frees the graphics' xs to go shooting around, and in general be animated and laggy. Good stuff.
						bit.alpha = 0;
						bit.y = bit.yFromTile(tile.y)-100;
						createjs.Tween.get(bit)
						.to({alpha:1, y:bit.yFromTile(tile.y)}, 500, createjs.Ease.cubicIn);
					});
				});
			} else {
				createjs.Ticker.removeListener(spawnTiles);
				createjs.Ticker.addListener(gameplay);
			}
		};
		_(rowsSpawnedPerFrame).times(spawnRow);
	};
	
	gameplay = function() {
		//put 'oil flow' animation in here
	};
	
	//MOUSE
	var pixToTile = function(dist, tsize) {
		return Math.floor(dist/tsize);
	};
	
	var endMouseEvent = function(evt) {
		evt.nativeEvent.preventDefault();
		evt.nativeEvent.stopPropagation();
	};
	
	var selectedColor = function() { //Sort of
		var int = -50;
		var filter1 = new createjs.ColorFilter(1,1,1,1,int,int,int,0); //r,g,b,a,ro,go,bo,ao. Yep. :|
		return filter1;
	}();
	
	//I'm not sure if it's guaranteed, but we'll assume every mouse down event has a corresponding mouse up event sometime in the future.
	var selectedObjects = [];
	stage.onMouseDown = function(evt) { //Register which tile we're over.
		if(evt.nativeEvent.which==1) {
			var overTileX = pixToTile(evt.stageX, tileWidth);
			var overTileY = pixToTile(evt.stageY, tileHeight);
			if(overTileX >= xTiles || overTileY >= yTiles) {return;}
			var selectedObject = gamefield[overTileX][overTileY];
			
			selectedObjects = [selectedObject];
			selectedObject.tile.filters.push(selectedColor);
			selectedObject.tile.updateCache();
			
			endMouseEvent(evt);
		}
	};
	
	stage.onMouseMove = function(evt) { //Add more tiles as we move.
		if(evt.nativeEvent.which==1) {
			var overTileX = pixToTile(evt.stageX, tileWidth);
			var overTileY = pixToTile(evt.stageY, tileHeight);
			if(overTileX >= xTiles || overTileY >= yTiles) {return true;} //If we aren't over a tile, then abort the function.
			var selectedObject = gamefield[overTileX][overTileY];
			
			if(!_.contains(selectedObjects, selectedObject)) {
				var adjacentXY = _.find(selectedObjects, function(adj){
					var comp_x = Math.abs(adj.x - selectedObject.x);
					var comp_y = Math.abs(adj.y - selectedObject.y);
					return comp_x === 1 && comp_y === 0 || comp_x === 0 && comp_y === 1;
				});
				if(selectedObject.type == _.head(selectedObjects).type && adjacentXY) {
					selectedObjects.push(selectedObject);
					selectedObject.tile.filters.push(selectedColor);
					selectedObject.tile.updateCache();
				}
			}
			
			endMouseEvent(evt);
		}
	};
	
	stage.onMouseUp = function(evt) { //And, finally, remove tiles, recompute stuff, add new tiles.
		if(evt.nativeEvent.which==1) {
			if(selectedObjects.length < minimumTileMatchCount) { //Reset.
				selectedObjects.map(function(obj) {
					obj.tile.filters.pop();
					obj.tile.updateCache();
				});
			} else { //Remove object from play, shuffle objects above it down a space, and spawn new objects at the top.
				money -= destructionCost; //Destruction is a flat-rate buisiness. This provides incentive to do more complicated destroys.
				
				
				var columnsAffected = {}; //Will be a [] later.
				selectedObjects.map(function(obj) {
					obj.bits.map(function(bit) { //Ease out existing objects and remove them from stage.
						var easeOutTime = 200;
						createjs.Tween.get(bit)
						.to({alpha:0, y:bit.y+5}, easeOutTime, createjs.Ease.cubicOut)
						.call(stage.removeChild, bit, stage);                          //This has no effect.
						setTimeout(function() {stage.removeChild(bit);}, easeOutTime); //So we'll do it manually.
					});
					columnsAffected[obj.x] = true;
					gamefield[obj.x][obj.y] = null;
				});
				columnsAffected = _.keys(columnsAffected)/*.map(function(key) {
						return parseInt(key, 10);
					})*/; //As long as we've got assasinine type conversions we might as well roll with it.
				
				columnsAffected.map(function(x) {
					_.range(yTiles-1, -1, -1).map(function(y) {
						var tile = gamefield[x][y];
						if(tile) {
							var newY = gamefield[x].lastIndexOf(null);
							if(newY > y) {
								tile.bits.map(function(bit) {
									createjs.Tween.get(bit)
									.to(
										{y:bit.yFromTile(newY)},
										Math.sqrt(Math.abs(tile.y-newY)*50000), //Maybe add 50*tile here, to add in a bit of inital inertia simulation. Break up blocks falling down on top of other falling blocks a bit.
										createjs.Ease.cubicIn); //bounceOut also works nicely here, but it's a bit distracting.
								});
								tile.y = newY;
								gamefield[x][y] = null;
								gamefield[tile.x][tile.y] = tile;
							}
						}
					});
					_.range(0, gamefield[x].lastIndexOf(null)+1).map(function(y) {
						var tile = getNewTile(getRandomTileType(), x, y, 0); //This is probably a least-efficient way to insert zorders, since I think it bumps up all existing zorders for each overlay on each added tile. Ohhh well.
						tile.bits.map(function(bit) {
							bit.alpha = 0;
							createjs.Tween.get(bit)
							.wait(50*y) //"Matrix-style"
							.to({alpha:1}, 500, createjs.Ease.cubicIn);
						});
					});
				});
			}
			
			//Before we destroy this, deal with these objects' destruction.
			selectedObjects=[];
			endMouseEvent(evt);
		}
	};
	
	createjs.Ticker.addListener(stage);
	createjs.Ticker.addListener(spawnTiles);
	
	return {
		score: function() {return score;},
		money: function() {return money;},
		gameOver: function() {return gameOver;}
	};
}();