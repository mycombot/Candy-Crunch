/*global console createjs mainWindow linkHTMLDisplayTo $ _ jQuery*/
var startGame = function() {
	"use strict";
	
	var options = {
		preferFlash: false,
		EaselJS_url: 'http://code.createjs.com/easeljs-0.5.0.min.js',
		EaselFL_url: '../EaselFL/build/output/easelfl-cur.min.js',
		SWFObject_url: '../EaselFL/js/swfobject.js',
	};
	createjs.FLSetup.run(onSetupSuccess, onSetupFailure, options);

	function onSetupSuccess(isFL){
		var loadOtherScriptsCount = 0;
		var jsAr = [
			"../tween.js/lib/tweenjs-0.3.0.min.js",
			"../sound.js/lib/soundjs-0.3.0.min.js",
			"../easel.js/src/easeljs/filters/ColorFilter.js" ];
		
		var onAllLoaded = function() {
			if(loadOtherScriptsCount === jsAr.length) {
				console.log('All scripts loaded.');
				mainWindow.start();
				linkHTMLDisplayTo(mainWindow);
			}
		};
		
		jsAr.map(function(js) {
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
				error: function() {console.log('An error occured loading a script via AJAX.');}
				
			});
		});
	}
	
	function onSetupFailure() {console.error('EaselFL failed to load; aborting.');}
};