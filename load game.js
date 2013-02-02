"use strict";
var startGame = function() {
	var options = {
		preferFlash: false,
		EaselJS_url: 'http://code.createjs.com/easeljs-0.5.0.min.js',
		EaselFL_url: '../EaselFL/build/output/easelfl-cur.min.js',
		SWFObject_url: '../EaselFL/js/swfobject.js',
	}
	createjs.FLSetup.run(onSetupSuccess, onSetupFailure, options);
	
	function onSetupFailure() {
		console.error('EaselFL failed to load; aborting.');
	}

	function onSetupSuccess(isFL){
		var loadOtherScriptsCount = 0;
		var loadOtherScripts = function() {
			var jsAr = new Array();
			jsAr[0] = "../tween.js/lib/tweenjs-0.3.0.min.js";
			jsAr[1] = "../sound.js/lib/soundjs-0.3.0.min.js";
			jsAr[2] = "../easel.js/src/easeljs/filters/ColorFilter.js";
			
		var onAllLoaded = function() {
			if(loadOtherScriptsCount === jsAr.length) {
				console.log('All scripts loaded.');
				mainWindow.start();
				linkHTMLDisplayTo(mainWindow);
			}
		};
		
		for (var i = 0; i < jsAr.length; i++) {
				var js = jsAr[i]; 
				console.log('getting ' + js);
				$.ajax({
					async: false,
					type: "GET",
					url: js,
					dataType: 'text',

					success: function(data){
						jQuery.globalEval(data);
						loadOtherScriptsCount += 1;
						onAllLoaded();
					},
					
					error: function(data) {
						console.log('An error occured loading a script via AJAX.');
					}
					
				});
			}
		}();
	}
}