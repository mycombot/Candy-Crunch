/*global createjs console _ $ iTiles iMode*/// JSLint is good at catching errors, but it has it's own, strange, ideas about style.
//Chromium: Run with --allow-file-access-from-files. It'll be fine in production, once we get it on a remote server.

/* === PROGRAM OVERVIEW ===
startNewGame, defined in this file, is called by load game.js when all the required framework files have been loaded. Its return value is set to mainWindow, there, and that is used to hook the HTML display (defined in htmlInterface.js) into the internal score and x remaining vars. (We can't use object.watch, even with a shim, because in ie8 it's unshimable.) However, the object.watch idea is still valid, so we'll just use the clunkier, hand-rolled watchWith provided by watchableCounter. This file relies upon a <canvas> id'd as 'main' in index.html. htmlInterface.js relies on some text id'd as 'score' and 'money'.
This means that you can say stuff like "mainWindow.watchScoreWith(function(foo) {console.log('new value: ' + foo)})" after the game has been initialized, over in htmlInterface.js.
*/

startNewGame = function() {
	"use strict";
	
// →→→ Definitions ←←←
	var watchableCounter = function(initial_value) {
		var counter = initial_value;
		var watchers = [];
		var runWatchers = function(counter) {
			watchers.map(function(watcher){
				watcher(counter);
			});
		};
		return {
			add: function(amount) {
				counter += amount;
				if(amount !== 0) {
					runWatchers(counter);
				}
			},
			set: function(amount) {
				if(counter !== amount) {
					runWatchers(amount);
				}
				counter = amount;
			},
			value: function() {return counter;},
			watchWith: function(watcher) {
				watchers.push(watcher);
				watcher(counter); //Call the watcher when it's set, because in our context we'll want to update the score/remaining counters as soon as we start the game.
			},
		};
	};
	
	
	var makeField = function() {
		return _.range(xTiles)
		.map(function() {
			return _
			.range(yTiles)
			.map(function() {
				return null;
			});
		});
	};
	
	
	var getNewTile = function(){
		var tiles = {
			normal: [
				new createjs.Bitmap("images/tile-1.png"),
				new createjs.Bitmap("images/tile-2.png"),
				new createjs.Bitmap("images/tile-3.png"),
				new createjs.Bitmap("images/tile-4.png"),
				new createjs.Bitmap("images/tile-5.png"),
				new createjs.Bitmap("images/tile-6.png") ],
			bonus: [
				new createjs.Bitmap("images/bonus-tile-1.png"),
				new createjs.Bitmap("images/bonus-tile-2.png"),
				new createjs.Bitmap("images/bonus-tile-3.png"),
				new createjs.Bitmap("images/bonus-tile-4.png"),
				new createjs.Bitmap("images/bonus-tile-5.png"),
				new createjs.Bitmap("images/bonus-tile-6.png") ],
			
			};
			
		return function getNewTileInternal (x,y, isBonus, type) { //x/y are in terms of tiles from the origin.
			var tileIndex = !isBonus ? _.random(numTileTypes) : type;
			var tileToReturn = !isBonus ? tiles.normal[tileIndex].clone() : tiles.bonus[tileIndex].clone();
			tileToReturn.index = tileIndex; //Because new tiles are cloned from the prototypes, we can't set the index in the prototype.
			
			tileToReturn.xFromTile = function(x) {return _.if(typeof x === 'number', x, tileToReturn.tileX) * tileWidth;};
			tileToReturn.yFromTile = function(y) {return _.if(typeof y === 'number', y, tileToReturn.tileY) * tileHeight;};
			
			tileToReturn.tileX = x;
			tileToReturn.tileY = y;
			tileToReturn.x = tileToReturn.xFromTile();
			tileToReturn.y = tileToReturn.yFromTile();
			
			tileToReturn.isBonus = !!isBonus;
			tileToReturn.bonuses = [];
			
			tileToReturn.remove = function() { //Note: Only call if you've actually added this tile to the stage.
				gamefield[tileToReturn.tileX][tileToReturn.tileY] = null;
				stage.removeChild(tileToReturn);
			};
			
			if(isBonus || linesInDir(tileToReturn, 'h').length < 2 && linesInDir(tileToReturn, 'v').length < 2) {
				stage.addChild(tileToReturn);
				return tileToReturn;
			} else {
				//console.log('Adding tile, failed no-3s test. Retrying.');
				return getNewTileInternal(x,y);
			}
		};
	}();
	
	
	var pixToTile = function(dist, tsize) {
		return Math.floor(dist/tsize);
	};
	
	var canInput = function() { //Returns true if we have time left or moves left.
		return _.if(mode === 'turns', remainingTiles.value(), remainingTime.value()) && !noInput;
	};
	
	var linesInDir = function(tile, direction) {
		_.if(!_.contains(['h', 'v'], direction),
			function() {
				console.warn('Bad direction: \''+direction+'\' (Should be either \'h\' or \'v\'.)');
				throw('bad direction');
				},
			function() {} )();
		var vecs = direction === 'h' ? [[-1,0],[1,0]] : [[0,-1],[0,1]];
		return [].concat(lineInDir(tile, vecs[0]), lineInDir(tile, vecs[1]));
	};
	var lineInDir = function(tile, vector) {
		var nextTile = gamefield[tile.tileX+vector[0]] && gamefield[tile.tileX+vector[0]][tile.tileY+vector[1]];
		if(nextTile && nextTile.index === tile.index) {
			return lineInDir(nextTile, vector).concat(nextTile);
		} else {
			return [];
		}
	};
	
	
	
	
	
// →→→ Initial Setup ←←←
	var canvas = document.getElementById('main');
	
	var stage = new createjs.Stage(canvas);
	stage.snapToPixel = true;
	stage.enableMouseOver();
	createjs.Ticker.addListener(stage);
	
	var numTileTypes = (typeof iTiles !== 'undefined' && iTiles || 6) - 1;
	var mode = typeof iMode !== 'undefined' && iMode || 'turns';
	if(numTileTypes < 3) {
		console.warn('You have specified fewer than four tile types via iTiles. This pretty much guarantees that a board with fewer than three similar tile types in a row can\'t be generated. Instead of recursing to death, an error will be thrown now to save you a few moments.'); //Three will work... for a while, at least. Two just crashes when we try to generate the board.
		throw "too few tiles";
	}
	
	var Width = canvas.width;                 var Height = canvas.height;
	var tileWidth = 71;                       var tileHeight = 63;
	var xTiles = Math.floor(Width/tileWidth); var yTiles = Math.floor(Height/tileHeight);
	
	// var mouseX = 0; var mouseY = 0;
	var selectedObject = null;
	var selectionIndicator = null;
	
	var score = watchableCounter(0);
	var remainingTiles = watchableCounter(15);
	var remainingTime = watchableCounter(180);
	var gameStatus = watchableCounter('playing');
	delete gameStatus.add; //Can't 'add' to the game status as it's a string; use set instead.
	
	var gamefield = makeField();
	gamefield.map(function(row, row_count) {
		row.map(function(tile, column_count) {
			gamefield[row_count][column_count] = getNewTile(row_count, column_count);
		});});
	
	var noInput = false;	//We'll set this to true when we're animating the board, so that we don't select objects that get removed accidentally.
	
// →→→ LOGIC ←←←
	var selectObject = function(tile) {
		if(selectedObject !== tile) {
			selectedObject = tile;
			if(selectionIndicator) {
				if(tile) {
					selectionIndicator.x = tile.xFromTile();
					selectionIndicator.y = tile.yFromTile();
				} else {
					stage.removeChild(selectionIndicator);
					selectionIndicator = null;
				}
			} else {
				if(tile){
					selectionIndicator = new createjs.Bitmap("images/tile selector.png");
					stage.addChild(selectionIndicator);
					selectionIndicator.x = tile.xFromTile();
					selectionIndicator.y = tile.yFromTile();
				}
			}
		}
	};
	
	
	var switchTiles = function(a,b) {
		noInput = true;
		
		var holder = {};
		holder.tileX = b.tileX;		holder.tileY = b.tileY; //[TILES]: Switch tiles…
		b.tileX = a.tileX;			b.tileY = a.tileY;
		gamefield[b.tileX][b.tileY] = b;
		a.tileX = holder.tileX;		a.tileY = holder.tileY;
		gamefield[a.tileX][a.tileY] = a;
		
		createjs.Tween.get(a)
			.to({x:b.x, y:b.y}, 250, createjs.Ease.cubicInOut);
		createjs.Tween.get(b)
			.to({x:a.x, y:a.y}, 250, createjs.Ease.cubicInOut)
			.call(function() {
				var aMatches = [linesInDir(a, 'h'), linesInDir(a, 'v')];
				var bMatches = [linesInDir(b, 'h'), linesInDir(b, 'v')];
				if(		aMatches[0].length > 1 || //[TILES]: see if we made any matches.
						aMatches[1].length > 1 || //1 because we want 2 or more tiles matches, 2 because it doesn't include the switched tile, so 3 alltogether.)
						bMatches[0].length > 1 || //Refactor: This test is somewhat duplicated. Perhaps we could compute the filtered removeMatches earlier and test it's length?
						bMatches[1].length > 1) { //[TILES]: Perhaps removes the tiles, and all that that entails with regards to bonuses generated and bonuses used.
					removeMatches([[a, aMatches], [b, bMatches]].filter(function(matchPair) { //At least one is good, but we need to not pass along the other one if it's not good. So, we'll filter the list.
							return matchPair[1][0].length > 1 || matchPair[1][1].length > 1;
						}));
					// removeMatches(searchForMatches()); //Slower than the above way, not that it matters. Since we did the first way first, lets just leave it in.
				} else { //[TILES]: Or perhaps switch the tiles back.
					a.tileX = b.tileX;			a.tileY = b.tileY;
					gamefield[a.tileX][a.tileY] = a;
					b.tileX = holder.tileX;		b.tileY = holder.tileY;
					gamefield[b.tileX][b.tileY] = b;
								
					noInput = false; //Enable input early, it'll feel more responsive.
					createjs.Tween.get(a)
						.to({x:a.xFromTile(), y:a.yFromTile()}, 350, createjs.Ease.cubicInOut); //Tomorrow -- recompute these based on tile positions, they're sliding around.
					createjs.Tween.get(b)
						.to({x:b.xFromTile(), y:b.yFromTile()}, 350, createjs.Ease.cubicInOut);
				}
			});
	};
	
	
	var removeMatches = function() {
		var getBonus = function(tile, matches) {
			var bonus = {x:tile.tileX, y:tile.tileY, index:tile.index, types:[]};
			if(matches[0].length > 2) {
				bonus.types.push('hor');
			}
			if(matches[1].length > 2) {
				bonus.types.push('ver');
			}
			if(matches[0].length > 1 && matches[1].length > 1) {
				bonus.types.push('point');
			}
			
			if(bonus.types.length) {
				tile.transmuteToBonus = true;
				return bonus;
			} else {
				return;
			}
		};
		
		var removeMatchingTilesAndAddBonuses = function(tilesToRemove, bonuses, callback) { //Callback will either be run immeadiatly, if there were no tiles to be removed, or when the tiles that need to be removed have finished tweening out.
			var tweenCount = 0;
			tilesToRemove.map(function(matchedTile){
				if(!matchedTile.transmuteToBonus) {
					createjs.Tween.get(matchedTile)
						.to({alpha:0}, 200, createjs.Ease.cubicIn)
						.call(matchedTile.remove)
						.call(function() {
							tweenCount -= 1;
							if(tweenCount === 0) {
								if(callback) callback();
								tweenCount -= 1;
							}
						});
					tweenCount += 1;
					} else {
						matchedTile.remove(); //Remove the tile now, we'll replace it with a bonus tile later this function. Can't fade out because then the removal process would wipe the board entry of the bonus tile.
					}
				});
			
			bonuses.map(function(bonusTile) {
				var newTile = getNewTile(bonusTile.x, bonusTile.y, true, bonusTile.index);
				gamefield[bonusTile.x][bonusTile.y] = newTile;
				newTile.bonuses = bonusTile.types;
				
			if(tweenCount === 0 && callback) callback();
			});
		};
		
		var fallTiles = function(callback) {
			var tweenCount = 0;
			_.range(xTiles).map(function(x) {
				_.range(yTiles-1, -1, -1).map(function(y) {
					var tile = gamefield[x][y];
					if(tile) {
						var newY = gamefield[x].lastIndexOf(null);
						if(newY > y) {
							tweenCount += 1;
							createjs.Tween.get(tile)
							.to(
								{y:tile.yFromTile(newY)},
								Math.sqrt(Math.abs(tile.tileY-newY)*400000), //Maybe add 50*tile here, to add in a bit of inital inertia simulation. Break up blocks falling down on top of other falling blocks a bit.
								createjs.Ease.bounceOut) //bounceOut also works nicely here, but it's a bit distracting.
								.call(function() {
									tweenCount -= 1;
									if(tweenCount === 0) {
										if(callback) callback();
										tweenCount -= 1;
									}
								});
							tile.tileY = newY;
							gamefield[x][y] = null;
							gamefield[tile.tileX][tile.tileY] = tile;
						}
					}
				});
				_.range(0, gamefield[x].lastIndexOf(null)+1).map(function(y) {
					var tile = getNewTile(x, y); //Specify false, random number to allow matches to be made by sheer chance, I think.
					gamefield[x][y] = tile;
					tile.alpha = 0;
					tweenCount += 1;
					createjs.Tween.get(tile)
						.wait(200)
						.call(function() {
							tweenCount -= 1;
							if(tweenCount === 0) {
								if(callback) callback();
								tweenCount -= 1;
							}
						})
						.wait(50*y+200) //"Matrix-style", fade in from the top.
						.to({alpha:1}, 500, createjs.Ease.cubicIn);
				});
			});
			if(tweenCount === 0 && callback) callback();
		};
		
		var tilesAffectedByBonus = function(tile) {
			//console.log(tile.bonuses);
			var affectedTiles = [];
			if(_.contains(tile.bonuses, 'hor')) {
				_.range(xTiles).map(function(x) {
					var match = gamefield[x][tile.tileY];
					if(match) affectedTiles.push(match);
				});
			}
			if(_.contains(tile.bonuses, 'ver')) {
				_.range(yTiles).map(function(y) {
					var match = gamefield[tile.tileX][y];
					if(match) affectedTiles.push(match);
				});
			}
			if(_.contains(tile.bonuses, 'point')) {
				_.range(-1,2).map(function(x) {
					_.range(-1,2).map(function(y) {
						var match = gamefield[tile.tileX+x] && gamefield[tile.tileX+x][tile.tileY+y];
						if((x || y) && match) affectedTiles.push(match);
					});
				});
			}
			return affectedTiles;
		};
		
		return function removeMatchesInternal(matches) { //Matches is a list of lists containing in order the 'key' object and the other objects which made up the match (a list containing row/column match).
			if(!matches.length) {
				noInput = false;
				return;
			}
			
			var newBonuses = matches.map(function(matchPair) {
				return getBonus(matchPair[0], matchPair[1]);
				}).filter(function(bonus) {return bonus;});
			
			var tilesToRemove = [];
			matches.map(function(matchPair) {
				tilesToRemove = tilesToRemove.concat(
					matchPair[1][0].length > 1 ? matchPair[1][0] : [],
					matchPair[1][1].length > 1 ? matchPair[1][1] : [],
					matchPair[0]);
			});
			
			var bonusesToApply = [];
			(function computeBonusRemoves (toCheck, first) {
				if(first) first();
				var last = _.last(toCheck);
				var init = _.initial(toCheck);
				if(last && !_.find(tilesToRemove, function(tile) {return tile.tileX === last.tileX && tile.tileY === last.tileY;}) ) {
					if(!_.find(tilesToRemove, function() {})) {
						tilesToRemove.push(last);
					}
					bonusesToApply.push(last),
					computeBonusRemoves(!last.isBonus ? init : init.concat(tilesAffectedByBonus(last)));
				} else if(init.length) {
					computeBonusRemoves(init);
				}
			})(tilesToRemove, function() {tilesToRemove=[];});
			
			removeMatchingTilesAndAddBonuses(
				tilesToRemove,
				newBonuses,
				function () {
					fallTiles(function() {
						removeMatchesInternal(searchForMatches());
					});
				} );
			
			//Spawn bonus candies, remove tiles that should be removed, including tiles affected by a bonus being removed.
			//Check for additional removable matches and remove them using this function.
		};
	}();
	
	var searchForMatches = function () {
		var matchesFound = _
			.flatten(
				makeField().map(function(column, x) {
					return column.map(function(row, y) { //We scan for intersection bonuses first because we wouldn't want to miss one because a line bonus had already spoken for it. (Only when the first tile was ⇱ would the intersection be counted.)
						var target = gamefield[x][y];
						if(target) {
							var hline = linesInDir(target, 'h');
							var vline = linesInDir(target, 'v');
							if(hline.length > 1 && vline.length > 1) {
								[].concat(target, hline, vline).map(function(tile) {tile.searchForMatchesMatched=true;} );
								return [target, [hline, vline]];
							}
						}
					});
				}),
				true)
			.filter(function(potMatch) {return potMatch;})
			.concat(
				_.flatten(
					makeField().map(function(column, x) {
						return column.map(function(row, y) {
							var target = gamefield[x][y];
							if(target && !target.searchForMatchesMatched) {
								var hline = linesInDir(target, 'h');
								var vline = linesInDir(target, 'v');
								[].concat(target, hline, vline).map(function(tile) {tile.searchForMatchesMatched=true;} );
								if(hline.length > 1) return [target, [hline, []]];
								if(vline.length > 1) return [target, [[], vline]];
							}
						});
					}),
					true)
				.filter(function(potMatch) {return potMatch;}));
		
		gamefield.map(function(row) {
			row.map(function(tile) {
				delete tile.searchForMatchesMatched;
			});
		});
		
		return matchesFound;
	};
	
	var tilesAreAdjacent = function(a,b) {
		return a && b &&
		1 === _.reduce([
				Math.abs(a.tileX - b.tileX), //We sum both x and y distance to make sure we didn't go kitty-corner (or worse).
				Math.abs(a.tileY - b.tileY),
			], function(a,b) {return a+b;}, 0);
	};


	var swallowMouseEvent = function(evt) {
		// mouseX = evt.stageX; mouseY = evt.stageY;
		evt.nativeEvent.preventDefault();
		evt.nativeEvent.stopPropagation();
	};
	
	
	stage.onMouseDown = function(evt) {
		if(evt.nativeEvent.which===1) { //1 is the left mouse button. We won't use right because I think that doesn't play nicely with EaselFL.
			if(canInput()) {
				var overTileX = pixToTile(evt.stageX, tileWidth);
				var overTileY = pixToTile(evt.stageY, tileHeight);
				var newSelectedObject = gamefield[overTileX][overTileY];
				
				if(tilesAreAdjacent(newSelectedObject, selectedObject)) {
					switchTiles(newSelectedObject, selectedObject);
					selectObject();
				} else { //We won't deselect if we click on the same tile because it'll play awkwardly with fat fingers double-tapping on touchscreens.
					selectObject(newSelectedObject);
				}
			}
			swallowMouseEvent(evt);
		}
	};
	
	
	stage.onMouseMove = function(evt) {
		if(evt.nativeEvent.which===1) {
			if(canInput()) {
				var overTileX = pixToTile(evt.stageX, tileWidth);
				var overTileY = pixToTile(evt.stageY, tileHeight);
				var over = gamefield[overTileX][overTileY];
				
				if(tilesAreAdjacent(over, selectedObject)) {
					switchTiles(over, selectedObject);
					selectObject();
				}
			}
			swallowMouseEvent(evt);
		}
	};
	
	
	return {
		watchScoreWith: score.watchWith,
		watchRemainingTilesWith: remainingTiles.watchWith,
		watchRemainingTimeWith: remainingTime.watchWith,
		watchGameStatus: gameStatus.watchWith,
		mode: function() {return mode;},
	};
};