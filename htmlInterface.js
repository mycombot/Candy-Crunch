var linkHTMLDisplay = function(){
	"strict mode";
	cashDisplay = $("#cash")[0];
	scoreDisplay = $("#score")[0];
	if(mainWindow.mode() === 'turns') {
		mainWindow.watchRemainingTilesWith(function(value) {
			console.log('turns' + value);
			cashDisplay.textContent = " Left: " + value + (value !== 1 ? " turns" : " turn");
		});
	} else if(mainWindow.mode() === 'time') {
		mainWindow.watchRemainingTimeWith(function(value) {
			cashDisplay.textContent = " Time Left: " + Math.floor(value/60) + ":" + (value%60 < 10 ? '0' + value%60 : value%60);
		});
	} else {
		cashDisplay.textContent = "error";
		console.warn('mainWindow.mode is \'' + mainWindow.mode() + '\', should be either \'turns\' or \'time\'.');
		console.error('bad mode value');
	}
	mainWindow.watchScoreWith(function(value) {
		scoreDisplay.textContent = " Score: " + value;
	});
};