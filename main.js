/*global createjs console _ $ averageRGB iTiles iMode iScore iMoves iTime*/// JSLint is good at catching errors, but it has it's own, strange, ideas about style.
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
			if(!_.contains([undefined, "hor", "ver", "point", "like"], isBonus) && undefined !== isBonus) { //_.contains doesn't work in ie8 with undefined.
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
			
			tileToReturn.xFromTile = function(x) {return (typeof x === 'number' ? x : tileToReturn.tileX) * tileWidth;};
			tileToReturn.yFromTile = function(y) {return (typeof y === 'number' ? y : tileToReturn.tileY) * tileHeight;};
			
			tileToReturn.tileX = x;
			tileToReturn.tileY = y;
			tileToReturn.x = tileToReturn.xFromTile();
			tileToReturn.y = tileToReturn.yFromTile();
			
			tileToReturn.isBonus = !!isBonus;
			tileToReturn.bonuses = [];
			
			tileToReturn.remove = function() { //Note: Only call if you've actually added this tile to the stage.
				gamefield[tileToReturn.tileX][tileToReturn.tileY] = null;
				tileContainer.removeChild(tileToReturn);
			};
			
			if(type!==undefined || linesInDir(tileToReturn, 'h').length < 2 && linesInDir(tileToReturn, 'v').length < 2) {
				tileContainer.addChild(tileToReturn);
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
		return !noInput && !paused;
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
			(!_.contains(['h', 'v'], direction) ?
				function() {
					console.warn('Bad direction: \''+direction+'\' (Should be either \'h\' or \'v\'.)');
					throw('bad direction');
					} :
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
					effectContainer.removeChild(selectionIndicator);
					selectionIndicator = null;
				}
			} else {
				if(tile){
					selectionIndicator = spriteSheetA.clone();
					selectionIndicator.sourceRect = new createjs.Rectangle(0, 145, 71, 71),
					selectionIndicator.regY = 4;
					effectContainer.addChild(selectionIndicator);
					selectionIndicator.x = tile.xFromTile();
					selectionIndicator.y = tile.yFromTile();
				}
			}
		}
	};
	
	
	var switchTiles = function(a,b) {
		noInput = true;
		noSwitch = true;
		if(hintBounce.tiles.length) stopHighlightingMatches();
		
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
				if((a.index < 0 || b.index < 0) && b.index != a.index) {
					removeTilesByIndex(a,b);
					if(mode === 'turns') remainingTiles.add(-1);
				} else if(	aMatches[0].length > 1 || //[TILES]: see if we made any matches.
							aMatches[1].length > 1 || //1 because we want 2 or more tiles matches, 2 because it doesn't include the switched tile, so 3 alltogether.)
							bMatches[0].length > 1 || //Refactor: This test is somewhat duplicated. Perhaps we could compute the filtered removeMatches earlier and test it's length?
							bMatches[1].length > 1) { //[TILES]: Perhaps removes the tiles, and all that that entails with regards to bonuses generated and bonuses used.
					removeMatches([[a, aMatches], [b, bMatches]].filter(function(matchPair) { //At least one is good, but we need to not pass along the other one if it's not good. So, we'll filter the list.
							return matchPair[1][0].length > 1 || matchPair[1][1].length > 1;
						}));
					if(mode === 'turns') remainingTiles.add(-1);
					stopHighlightingMatches();
				} else { //[TILES]: Or perhaps switch the tiles back.
					a.tileX = b.tileX;			a.tileY = b.tileY;
					gamefield[a.tileX][a.tileY] = a;
					b.tileX = holder.tileX;		b.tileY = holder.tileY;
					gamefield[b.tileX][b.tileY] = b;
								
					noInput = false; //Enable input early, it'll feel more responsive.
					
					var tween;
					tween = createjs.Tween.get(a)
						.to({x:a.xFromTile(), y:a.yFromTile()}, 350, createjs.Ease.cubicInOut); //Tomorrow -- recompute these based on tile positions, they're sliding around.
					tween = createjs.Tween.get(b)
						.to({x:b.xFromTile(), y:b.yFromTile()}, 350, createjs.Ease.cubicInOut);
					
					hintBounce.id = window.setTimeout(function() {
						if(hintBounce.tiles.length) highlightPotentialMatches(hintBounce.tiles);
						noSwitch = false;
					}, tween.duration+25); //Something seems to need to run first; no clue what.
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
				if(_.contains(newTile.bonuses, 'like')) newTile.index = -1;
			if(tweenCount === 0 && callback) callback();
			});
		};
		
		var fireballLife = 700;
		var fireballDistance = 700; //Should be larger than the game board plus the fireball.
		var fireballStretch = 0.7;
		var animateFireballs = function(source_tile, fireballs) {
			fireballs.map(function(fireball) {
				fireball.sourceRect = new createjs.Rectangle(234, 512, 63, 43);
				console.log(fireball);
				fireball.regX = fireball.sourceRect.width/2; fireball.regY = fireball.sourceRect.height/2;
				fireball.x = source_tile.x + tileWidth/2; fireball.y = source_tile.y + tileHeight/2;
				effectContainer.addChild(fireball);
				createjs.Tween.get(fireball)
					.to({
							x: fireball.x+fireball.escapeVector[0]*fireballDistance,
							y: fireball.y+fireball.escapeVector[1]*fireballDistance,
							scaleX: 1+fireballStretch,
							scaleY: 1-fireballStretch
						}, fireballLife, createjs.Ease.linear)
					.call(function() {
						effectContainer.removeChild(fireball);
					});
			});
		};
		
		var spawnBonusEffects = function(tiles) {
			tiles.map(function(tile) {
				tile.bonuses.map(function(bonusName) {
					var fireballs;
					switch(bonusName) {
						case 'hor':
							console.log(bonusName);
							fireballs = [spriteSheetA.clone(), spriteSheetA.clone()];
							fireballs[1].rotation = 180;
							fireballs[0].escapeVector = [-1,0];
							fireballs[1].escapeVector = [1,0];
							animateFireballs(tile, fireballs);
							break;
						case 'ver':
							console.log(bonusName);
							fireballs = [spriteSheetA.clone(), spriteSheetA.clone()];
							fireballs[0].rotation = 270;
							fireballs[1].rotation = 90;
							fireballs[0].escapeVector = [0,1];
							fireballs[1].escapeVector = [0,-1];
							animateFireballs(tile, fireballs);
							break;
						case 'point':
							console.log(bonusName);
							var explosion = spriteSheetA.clone();
							explosion.sourceRect = new createjs.Rectangle(0, 512, 234, 210);
							explosion.regX = explosion.sourceRect.width/2; explosion.regY = explosion.sourceRect.height/2;
							explosion.x = tile.x + tileWidth/2; explosion.y = tile.y + tileHeight/2;
							explosion.alpha = 1;
							explosion.scaleX = 0.5; explosion.scaleY = 0.5;
							effectContainer.addChild(explosion);
							createjs.Tween.get(explosion)
								.to({
									alpha: 0,
									scaleX: 1.5, scaleY: 1.5
								}, 500, createjs.Ease.circOut)
								.call(function() {
									effectContainer.removeChild(explosion);
								});
							break;
						case 'like':
							console.log(bonusName, 'TODO: Lightning to index ' + tile.matchedWithIndex + '.');
							break;
						default:
							console.warn('spawnBonusEffects was passed a tile with a bonus of type \'' + bonusName + '\', which isn\'t a valid bonus.');
							throw "bad effect name";
					}
				});
			});
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
				noSwitch = false;
				if(remainingTiles.value() <= 0) {
					runGameOver();
				} else {
					checkForPotentialMatches();
				}
				return;
			}
			
			stopHighlightingMatches();
			stopFutureMatchHighlight();
			
			var newBonuses = [];
			var tilesToRemove = [];
			if(matches[0][1].length || matches.length > 1) {
				newBonuses = matches.map(function(matchPair) {
					return getBonus(matchPair[0], matchPair[1]);
					}).filter(function(bonus) {return bonus;});
				
				matches.map(function(matchPair) {
					tilesToRemove = tilesToRemove.concat(
						matchPair[1][0].length > 1 ? matchPair[1][0] : [],
						matchPair[1][1].length > 1 ? matchPair[1][1] : [],
						matchPair[0]);
				});
			} else { //This mode is the one where we remove all the tiles of a certain type.
				tilesToRemove = tilesToRemove.concat(matches[0][0], matches[0][1]);
				gamefield.map(function(column) {
					tilesToRemove = tilesToRemove.concat(column.filter(function(tile) {
						return tile.index === matches[0][1].index;
					}));
				});
			}
			//console.log(tilesToRemove);
			
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
			
			spawnBonusEffects(bonusesToApply.filter(function(tile) {return tile.bonuses.length;}));
			
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
	
	
	var removeTilesByIndex = function(a,b) { // a xor b is a chocolate-covered candy (one with index -1)
		if(a.index > b.index) { //Let's have the "a" object be the chocolate-covered one.
			var tmp = a;
			a = b;
			b = tmp;
		}
		a.matchedWithIndex = b.index;
		removeMatches([[a, b]]);
	};
	
	
	var fallSpeed = 400000;
	var fallTiles = function(callback) {
		var tweenCount = 0;
		var scoreDelta = 0;
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
							Math.sqrt(Math.abs(tile.tileY-newY)*fallSpeed), //Maybe add 50*tile here, to add in a bit of inital inertia simulation. Break up blocks falling down on top of other falling blocks a bit.
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
			scoreDelta += lastY;
			
			_.range(0, lastY).map(function(y) {
				var tile = getNewTile(x, y, undefined, _.random(numTileTypes)); //Specify false, random number to allow matches to be made by sheer chance, I think.
				gamefield[x][y] = tile;
				var targetY = tile.y;
				tile.y -= lastY*tileHeight;
				tweenCount += 1;
				createjs.Tween.get(tile)
					.to(
						{y:targetY},
						Math.sqrt(Math.abs(lastY)*fallSpeed),
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
		
		score.add(scoreDelta*10);
		if(tweenCount === 0 && callback) callback();
	};
	
	
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
	
	
	var checkForPotentialMatches = function() {
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
								var clusterPassed =
								(undefined === _.find(_.pluck(cluster, 'index'), function(index) {
									return index != targetTileType;
								})) &&
								(undefined === _.find(_.pluck(cluster, 'rotation'), function(rotation) { //We can't bounce the rotated tiles. This may cause a mis-called game over, but the chances are slim -- and we need to see if we even ever want to rotate pieces. (The solution is to manually rotate the graphic, I think. Rotation is bad in easeljs for our purposes.)
									return rotation;
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
			if(hintBounce.id !== 0) {
				console.warn("hintBounce.id is " + hintBounce.id + ", must be 0. An existing function may already be scheduled, and must be cleared first.");
				throw "uncleared hintBounce.id";
			}
			var matches = getPotentialMatches();
			
			if(matches) {
				hintBounce.id = window.setTimeout(function() {
					highlightPotentialMatches(matches);
					hintBounce.tiles = matches;
				}, hintBounce.timeout);
			} else {
				var conf = window.confirm('No more matches can be made. Shall I shuffle the board?');
				if(conf) {
					gamefield = _.shuffle(gamefield).map(function(column) { //Not a /good/ shuffle, but given the number of times the player will encounter it it shouldn't matter.
						return _.shuffle(column);
					});
				} else {
					window.alert("The previous dialog will pop up in half a minute if you can't find a match.");
					hintBounce.id = window.setTimeout(checkForPotentialMatches, 30000); //30 seconds
				}
				return 0;
			}
		};
	}();
	
	
	var highlightingPotentialMatches = false;
	var highlightPotentialMatches = function(matches) {
		if(!matches) {
			matches = hintBounce.tiles;
			if(!matches.length) {
				checkForPotentialMatches();
			}
		}
		if(highlightingPotentialMatches === false) {
			if(noInput) {
				hintBounce.tiles = matches;
				hintBounce.id = window.setTimeout(highlightPotentialMatches, 1000);
				return;
			}
			highlightingPotentialMatches = true;
			matches.map(function(tile) {
				if(!createjs.Tween.hasActiveTweens(tile)) {
					tile.regX = tile.regX || 0;           tile.regY = tile.regY || 0;	//This seems to be getting undefined somewhere.
					tile.regXBeforeHighlight = tile.regX; tile.regYBeforeHighlight = tile.regY;
					tile.regX += tileWidth / 2;           tile.regY += tileHeight;
					tile.x += tileWidth / 2;              tile.y += tileHeight;
					
					var targetY = tile.regY;
					var tween = createjs.Tween.get(tile, {loop:true})
						.to(
							{scaleX:1.15, scaleY:0.85},
							200,
							createjs.Ease.sineOut)
						.to(
							{scaleX:1.0, scaleY:1.0},
							200,
							createjs.Ease.sineIn)
						.to(
							{regY: tile.regY+6},
							175,
							createjs.Ease.sineOut)
						.to(
							{regY: tile.regY},
							175,
							createjs.Ease.sineIn);
					//tile.tween = tween; //[BOUNCE]
				} else {
					console.log('Skipped doing bounce; object already had tween.');
				}
			});
		}
	};
	
	var stopHighlightingMatches = function() {
		//if(highlightingPotentialMatches === true) {
			highlightingPotentialMatches = false;
			hintBounce.tiles.map(function(tile) {
				//tile.tween.loop = false; //[BOUNCE] We have to end this here-and-now, because it will conflict with the switching animation otherwise.
				createjs.Tween.removeTweens(tile);
				tile.regX = tile.regXBeforeHighlight; tile.regY = tile.regYBeforeHighlight;
				delete tile.regXBeforeHighlight;      delete tile.regYBeforeHighlight;
				tile.x = tile.xFromTile();            tile.y = tile.yFromTile();
				tile.scaleX = 1; tile.scaleY = 1;
				//delete tile.tween; //[BOUNCE]
			});
			window.clearTimeout(hintBounce.id);
			hintBounce.id = 0;
		//}
	};
	
	var stopFutureMatchHighlight = function() {
		hintBounce.tiles = [];
		window.clearTimeout(hintBounce.id);
		hintBounce.id = 0;
	};
	
	
	var runGameOver = function() {
		paused = true;
		createjs.Ticker.setPaused(true);
		gameStatus.set('finished');
		window.setTimeout(function(){
			window.alert("Game Over.\nYour score is " + score.value() + " points!");
		}, 100);
	};
	
	
	var drawText = function (displayText, x, y, size, gradientColours) {
		var vPad = size/4;
		var tailDepth = size/4;
		var outlineSize = size/(100/7.5);
		var position = $(canvas).offset();
		var jCanvas = $("<canvas>");
		
		if(jCanvas[0].getContext) {
			var gfx = jCanvas[0].getContext('2d');
			gfx.font = size+'pt candy';
			var textWidth = gfx.measureText(displayText).width + size/4 + outlineSize*2;
			var textHeight = size+vPad*2+tailDepth;
			//position.left -= textWidth/2 - x;
			//position.top -= textHeight/2 - y;
			jCanvas
				.attr({'width':textWidth,'height':textHeight})
				.css({
					"position": "absolute",
					//"background": "yellow",
					"transform": "translate("+(-textWidth/2+x)+"px, "+(-textHeight/2+y)+"px)"
				})
				.css(position);
				
			gfx.font = size+'pt candy';
			gfx.lineCap = 'round';
			gfx.lineWidth = outlineSize*2+2; //Thin black outline. Makes it pop.
			gfx.strokeStyle = '#000000';
			gfx.strokeText(displayText,  outlineSize, size+vPad);
			gfx.lineWidth = outlineSize*2; //Brown outline.
			gfx.strokeStyle = '#391A00';
			gfx.strokeText(displayText,  outlineSize, size+vPad);
			var gradient = gfx.createLinearGradient(0, vPad, 0, vPad+size+tailDepth); //Fill the interior of the text with a gradient.
			gradient.addColorStop(0, gradientColours[0]);
			gradient.addColorStop(1, gradientColours[1]);
			gfx.fillStyle=gradient;
			gfx.fillText(displayText, outlineSize, size+vPad);
			gfx.lineWidth = outlineSize/2; //Draw an outline of white to make it 'glow'.
			gfx.strokeStyle = 'rgba(255,255,255,0.1)';
			gfx.strokeText(displayText,  outlineSize, size+vPad);
			gfx.lineWidth = outlineSize/3; //Glows should be brighter near the center, so draw a thinner outline of white.
			gfx.strokeText(displayText,  outlineSize, size+vPad);
			
			jCanvas.appendTo("body");
			return jCanvas;
		} else {
			var averageColour = averageRGB(gradientColours[0],gradientColours[1]);
			var jPar = $("<p>"); //For IE8.
			jPar.text(displayText)
				.css({
					"font-size": size,
					"position": "absolute",
					"color": "#"+averageColour,
					/*"background": "yellow",*/
					"font-family": "comic sans ms",
					"filter": "glow(color=391A00,strength=10)"
				})
				.appendTo("body")
				.offset({
					left: position.left + x - jPar.width()/2,
					top: position.top + y - jPar.height()/2 });
			console.log(jPar.width());
		}
	};
	
	
	
	
	
// →→→ Initial Setup ←←←
	var canvas = document.getElementById('main');
	
	var stage = new createjs.Stage(canvas);
	stage.snapToPixel = true;
	stage.enableMouseOver();
	if(createjs.Touch) {
		createjs.Touch.enable(stage, true); //'True' here disables multi-touch. Good.
	}
	createjs.Ticker.addListener(stage);
	
	var spriteSheetA = new createjs.Bitmap("images/CC_Sprite_Sheet.png");
	
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
	
	var numTileTypes = (typeof iTiles !== 'undefined' && iTiles || 6) - 1;
	var mode = typeof iMode !== 'undefined' && iMode || 'turns'; //turns, time
	
	var score = watchableCounter(
		typeof iScore !== 'undefined' && iScore || 0);
	var remainingTiles = watchableCounter(
		typeof iMoves !== 'undefined' && iMoves || 15);
	var remainingTime = watchableCounter(
		typeof iTime !== 'undefined' && iTime || 180);
	
	var gameStatus = watchableCounter('playing'); //playing, finished
	delete gameStatus.add; //Can't 'add' to the game status as it's a string; use set instead.
	
	var tileContainer = new createjs.Container();    stage.addChild(tileContainer);
	var effectContainer = new createjs.Container();  stage.addChild(effectContainer);
	var overlayContainer = new createjs.Container(); stage.addChild(overlayContainer);
	
	var gamefield = makeField();
	gamefield.map(function(row, row_count) {
		row.map(function(tile, column_count) {
			gamefield[row_count][column_count] = getNewTile(row_count, column_count);
		});});
	
	var paused = false;
	var noInput = false;	//We'll set this to true when we're animating the board, so that we don't select objects that get removed accidentally.
	var noSwitch = false;
	
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
			_.range(3).map(function() {
				match = twist(match); matches.push(match);
			});
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
		timeout: 4000,
		id: 0,
		tiles: [],
	};
	checkForPotentialMatches();
	
	if(mode === 'time') {
		var numSeconds = remainingTime.value();
		_.range(1, numSeconds).map(function(passed) {
			window.setTimeout(function() {
				remainingTime.set(numSeconds-passed);
			}, passed*1000);
		});
		window.setTimeout(function() {
			remainingTime.set(0);
			runGameOver();
		}, numSeconds*1000);
	}
	
	drawText('Test.', Width/2, Height/2, 100, ["#F8DB63", "#CF8A09"], 0);
	
	
	
	
// →→→ EVENTS ←←←
	
	stage.onMouseDown = function(evt) {
		console.log('mouse down event received ', evt);
		if(isRightButton(evt.nativeEvent.which)) { //1 is the left mouse button. We won't use right because I think that doesn't play nicely with EaselFL.
			if(canInput()) {
				var overTileX = pixToTile(evt.stageX, tileWidth);
				var overTileY = pixToTile(evt.stageY, tileHeight);
				var newSelectedObject = gamefield[overTileX][overTileY];
				
				//console.log(newSelectedObject);
				
				if(tilesAreAdjacent(newSelectedObject, selectedObject)) {
					if(!noSwitch) {
						switchTiles(newSelectedObject, selectedObject);
						selectObject();
					}
				} else { //We won't deselect if we click on the same tile because it'll play awkwardly with fat fingers double-tapping on touchscreens.
					selectObject(newSelectedObject);
				}
			}
			return swallowMouseEvent(evt);
		}
		
		// Debug code. If we middle-click, it sets the tile to an orange candy.
		// var overTileX = pixToTile(evt.stageX, tileWidth);
		// var overTileY = pixToTile(evt.stageY, tileHeight);
		// gamefield[overTileX][overTileY].remove();
		// gamefield[overTileX][overTileY] = getNewTile(overTileX, overTileY, undefined, 1);
	};
	
	
	stage.onMouseMove = function(evt) {
		if(isRightButton(evt.nativeEvent.which)) {
			if(canInput()) {
				var overTileX = pixToTile(evt.stageX, tileWidth);
				var overTileY = pixToTile(evt.stageY, tileHeight);
				var over = gamefield[overTileX][overTileY];
				
				if(tilesAreAdjacent(over, selectedObject)) {
					if(!noSwitch) {
						switchTiles(over, selectedObject);
						selectObject();
					}
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