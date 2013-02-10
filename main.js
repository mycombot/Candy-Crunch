/*global createjs console _ $ iTiles iMode*/// JSLint is good at catching errors, but it has it's own, strange, ideas about style.
//Chromium: Run with --allow-file-access-from-files. It'll be fine in production, once we get it on a remote server.

/* === PROGRAM OVERVIEW ===
startNewGame, defined in this file, is called by load game.js when all the required framework files have been loaded. Its return value is set to mainWindow, there, and that is used to hook the HTML display (defined in htmlInterface.js) into the internal score and x remaining vars. (We can't use object.watch, even with a shim, because in ie8 it's unshimable.) However, the object.watch idea is still valid, so we'll just use the clunkier, hand-rolled watchWith provided by watchableCounter. This file relies upon a <canvas> id'd as 'main' in index.html. htmlInterface.js relies on some text id'd as 'score' and 'money'.
This means that you can say stuff like "mainWindow.watchScoreWith(function(foo) {console.log('new value: ' + foo)})" after the game has been initialized, over in htmlInterface.js.
*/

startNewGame = function() {
	"use strict";
	
// →→→ Function Definitions ←←←
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
		var tileSourceRects = { //sourceRect is not cloned when we clone the bitmap. We must define sourceRects instead of bitmaps.
			normal: [
				new createjs.Rectangle(360, 5,   71, 63),
				new createjs.Rectangle(432, 5,   71, 63),
				new createjs.Rectangle(360, 75,  71, 63),
				new createjs.Rectangle(432, 75,  71, 63),
				new createjs.Rectangle(360, 147, 71, 63),
				new createjs.Rectangle(432, 147, 71, 63) ],
			hor: [
				new createjs.Rectangle(144, 220, 71, 63),
				new createjs.Rectangle(288, 220, 71, 63),
				new createjs.Rectangle(71,  147, 71, 63),
				new createjs.Rectangle(215, 147, 71, 63),
				new createjs.Rectangle(215, 220, 71, 63),
				new createjs.Rectangle(144, 147, 71, 63) ],
			ver: [ //Twist these 90°.
				new createjs.Rectangle(144, 220, 71, 63),
				new createjs.Rectangle(288, 220, 71, 63),
				new createjs.Rectangle(71,  147, 71, 63),
				new createjs.Rectangle(215, 147, 71, 63),
				new createjs.Rectangle(215, 220, 71, 63),
				new createjs.Rectangle(144, 147, 71, 63) ],
			point: [
				new createjs.Rectangle(360, 220, 71, 63),
				new createjs.Rectangle(432, 220, 71, 63),
				new createjs.Rectangle(360, 290, 71, 63),
				new createjs.Rectangle(432, 290, 71, 63),
				new createjs.Rectangle(360, 362, 71, 63),
				new createjs.Rectangle(432, 362, 71, 63) ],
			like: [ //Offset this to 147. (+3)
				new createjs.Rectangle(288, 145, 71, 69),
				new createjs.Rectangle(288, 145, 71, 69),
				new createjs.Rectangle(288, 145, 71, 69),
				new createjs.Rectangle(288, 145, 71, 69),
				new createjs.Rectangle(288, 145, 71, 69),
				new createjs.Rectangle(288, 145, 71, 69) ],
			
			};
			
		return function getNewTileInternal (x,y, isBonus, type) { //x/y are in terms of tiles from the origin. type is the index of the bitmap. isBonus can be undefined or the type of bonus.
			if(!_.contains([undefined, "hor", "ver", "point", "like"], isBonus)) {
				console.warn("isBonus is '" + isBonus + "', shouldn't be.");
				throw "bad isBonus value";
			}
			
			var tileIndex = type===undefined ? _.random(numTileTypes) : type;
			var tileToReturn = spriteSheetA.clone();
			tileToReturn.sourceRect = !isBonus ? tileSourceRects.normal[tileIndex].clone() : tileSourceRects[isBonus][tileIndex].clone();
			
			if(isBonus === "ver") {
				tileToReturn.rotation = 90;
				tileToReturn.regY = tileWidth-4;
				tileToReturn.regX = 4;
			} else if(isBonus === "like") {
				tileToReturn.regY = 3;
			}
			
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
			
			if(type!==undefined || linesInDir(tileToReturn, 'h').length < 2 && linesInDir(tileToReturn, 'v').length < 2) {
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
	
	
	var linesInDir = function() {
		var lineInDir = function(tile, vector) {
			var nextTile = gamefield[tile.tileX+vector[0]] && gamefield[tile.tileX+vector[0]][tile.tileY+vector[1]];
			if(nextTile && nextTile.index === tile.index) {
				return lineInDir(nextTile, vector).concat(nextTile);
			} else {
				return [];
			}
		};
		return function(tile, direction) {
			_.if(!_.contains(['h', 'v'], direction),
				function() {
					console.warn('Bad direction: \''+direction+'\' (Should be either \'h\' or \'v\'.)');
					throw('bad direction');
					},
				function() {} )();
			var vecs = direction === 'h' ? [[-1,0],[1,0]] : [[0,-1],[0,1]];
			return [].concat(lineInDir(tile, vecs[0]), lineInDir(tile, vecs[1]));
		};
	}();
	
	
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
					selectionIndicator = spriteSheetA.clone();
					selectionIndicator.sourceRect = new createjs.Rectangle(0, 145, 71, 71),
					selectionIndicator.regY = 4;
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
			if(matches[0].length > 3 || matches[1].length > 3) {
				bonus.types = ['like'];
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
			tilesToRemove.map(function(matchedTile){ //Remove matching tiles (passed in).
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
			
			bonuses.map(function(bonusTile) { //Add any bonus tiles we need to as a result of the matches. (Tiles are passed in.)
				var newTile = getNewTile(bonusTile.x, bonusTile.y, _.head(bonusTile.types), bonusTile.index);
				gamefield[bonusTile.x][bonusTile.y] = newTile;
				newTile.bonuses = bonusTile.types;
				
			if(tweenCount === 0 && callback) callback();
			});
		};
		
		var speed = 400000;
		var fallTiles = function(callback) {
			var tweenCount = 0;
			_.range(xTiles).map(function(x) { //Tiles falling down to fill gaps left by replaced tiles.
				_.range(yTiles-1, -1, -1).map(function(y) {
					var tile = gamefield[x][y];
					if(tile) {
						var newY = gamefield[x].lastIndexOf(null);
						if(newY > y) {
							tweenCount += 1;
							createjs.Tween.get(tile)
							.to(
								{y:tile.yFromTile(newY)},
								Math.sqrt(Math.abs(tile.tileY-newY)*speed), //Maybe add 50*tile here, to add in a bit of inital inertia simulation. Break up blocks falling down on top of other falling blocks a bit.
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
				var lastY = gamefield[x].lastIndexOf(null)+1; //Tiles added to replace tiles matched.
				_.range(0, lastY).map(function(y) {
					var tile = getNewTile(x, y); //Specify false, random number to allow matches to be made by sheer chance, I think.
					gamefield[x][y] = tile;
					var targetY = tile.y;
					tile.y -= lastY*tileHeight;
					tweenCount += 1;
					createjs.Tween.get(tile)
						.to(
							{y:targetY},
							Math.sqrt(Math.abs(lastY)*speed),
							createjs.Ease.bounceOut)
						.call(function() {
							tweenCount -= 1;
							if(tweenCount === 0) {
								if(callback) callback();
								tweenCount -= 1;
							}
						});
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
		//evt.nativeEvent.stopImmediatePropagation();
		return false;
	};
	
	
	var isRightButton = function(which) { //Takes a mouse button, returns true if it's the one we accept input from. (0 if on tablet, 1 if on computer) This assumes a touch-enabled device won't accept mouse input, which might be a dangerous assumption.
		return createjs.Touch.isSupported() ? which === 0 : which === 1;
	};
	
	
	var checkForMatches = function() {
		var getPotentialMatches = function() {
			var order = _(_.range(numTileTypes+1)).shuffle();
			var foundObjects = false;
			_.find(order, function(targetTileType) {
				return _(_.shuffle(potentialMatches)) //This way, we'll look for different potential matches each time and educate our player.
					.find(function(matchMask) {
						//Arrays might not be zero-indexed, but start at 1 instead.
						var mmLength = matchMask.length;
						var mmHeight = matchMask[0].length;
						
						_.find(_.range(xTiles-mmLength), function(xOffset) {
							_.find(_.range(yTiles-mmHeight), function(yOffset) {
								var cluster = _.flatten(
									gamefield
										.slice(xOffset,xOffset+mmLength)
										.map(function(column, colCount) {
											return column
											.slice(yOffset, yOffset+mmHeight)
											.filter(function(tile, rowCount) {
												return matchMask[colCount][rowCount];
											});
										}),
									true);
								var clusterPassed = (undefined === _.find(_.pluck(cluster, 'index'), function(index) {
									return index != targetTileType;
								}));
								if(clusterPassed) foundObjects = cluster;
								return foundObjects;
							});
							return foundObjects;
						});
						return foundObjects;
					});
				});
			return foundObjects;
		};
		
		return function () {
			var potentialMatches = getPotentialMatches();
			
			if(potentialMatches) {
				var hintFunctionID = window.setTimeout(function() {
					potentialMatches.map(function(match) {match.rotation = 15;});
				}, hintBounce.timeout);
				return hintFunctionID;
			} else {
				window.confirm('No more matches can be made. Shall I shuffle the board?');
				gamefield = _.shuffle(gamefield).map(function(column) { //Not a /good/ shuffle, but given the number of times the player will encounter it it won't matter.
					return _.shuffle(column);
				});
				return 0;
			}
		};
	}();
	
	var stopHighlightingMatches = function() {
		//TODO: This.
	};
	
	
	
	
	
// →→→ Initial Setup ←←←
	var canvas = document.getElementById('main');
	
	var stage = new createjs.Stage(canvas);
	stage.snapToPixel = true;
	stage.enableMouseOver();
	createjs.Touch.enable(stage, true); //'True' here disables multi-touch. Good.
	createjs.Ticker.addListener(stage);
	
	var spriteSheetA = new createjs.Bitmap("images/CC_Sprite_Sheet.png");
	
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
	
	var potentialMatches = function(unrotatedMatches) {
		var twist = function(match) {
			var newMatch = [];
			match.map(function(column, x) {
				column.map(function(num, y) {
					y = column.length-y;
					newMatch[y] = newMatch[y] ? newMatch[y] : [];
					newMatch[y][x] = num;
				});
			});
			return newMatch;
		};
		
		var matches = [];
		unrotatedMatches.map(function(match) {
			matches.push(match);
			match = twist(match); matches.push(match);
			match = twist(match); matches.push(match);
			match = twist(match); matches.push(match);
		});
		return matches;
	}([ [
			[1,1,0,1]
		], [
			[1,1,0],
			[0,0,1]
		], [
			[0,0,1],
			[1,1,0]
		], [
			[1,0,1],
			[0,1,0]
		] ])
	.map(function(matchBlock) { //The rotation bit seems to be offsetting by 1 sometimes. Trim undefined first elements.
		if(matchBlock[0] === undefined) matchBlock = _.tail(matchBlock);
		return matchBlock.map(function(matchLine) {
			if(matchLine[0] === undefined) matchLine = _.tail(matchLine);
			return matchLine;
		});
	});
	/* //Cleaner debugging info.
	potentialMatches.map(function(match, index) {
		console.log(index + ':');
		match.map(function(match) {
			console.log(match.map(function(a) {
				return a ? '▓' : '░';
			}).reduce(function(a,b) {
				return a + b;
			}));
		});
	});
	*/
	
	var hintBounce = {
		timeout: 100,
		id: 0,
		tiles: false
	};
	checkForMatches();
	
	
	
	
	
// →→→ EVENTS ←←←
	
	stage.onMouseDown = function(evt) {
		if(isRightButton(evt.nativeEvent.which)) { //1 is the left mouse button. We won't use right because I think that doesn't play nicely with EaselFL.
			if(canInput()) {
				var overTileX = pixToTile(evt.stageX, tileWidth);
				var overTileY = pixToTile(evt.stageY, tileHeight);
				var newSelectedObject = gamefield[overTileX][overTileY];
				
				//console.log(newSelectedObject);
				
				if(tilesAreAdjacent(newSelectedObject, selectedObject)) {
					switchTiles(newSelectedObject, selectedObject);
					selectObject();
				} else { //We won't deselect if we click on the same tile because it'll play awkwardly with fat fingers double-tapping on touchscreens.
					selectObject(newSelectedObject);
				}
			}
			return swallowMouseEvent(evt);
		}
		/*
		var overTileX = pixToTile(evt.stageX, tileWidth);
		var overTileY = pixToTile(evt.stageY, tileHeight);
		gamefield[overTileX][overTileY].remove();
		gamefield[overTileX][overTileY] = getNewTile(overTileX, overTileY, undefined, 1);
		*/
	};
	
	
	stage.onMouseMove = function(evt) {
		if(isRightButton(evt.nativeEvent.which)) {
			if(canInput()) {
				var overTileX = pixToTile(evt.stageX, tileWidth);
				var overTileY = pixToTile(evt.stageY, tileHeight);
				var over = gamefield[overTileX][overTileY];
				
				if(tilesAreAdjacent(over, selectedObject)) {
					switchTiles(over, selectedObject);
					selectObject();
				}
			}
			return swallowMouseEvent(evt);
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