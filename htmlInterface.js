var linkHTMLDisplay = function(){
	"strict mode";
	cashDisplay = $("#cash")[0];
	scoreDisplay = $("#score")[0];
	mainWindow.watchRemainingTilesWith(function(value) {
		cashDisplay.textContent = " Left: " + value + " turns";
	});
	mainWindow.watchScoreWith(function(value) {
		scoreDisplay.textContent = " Score: " + value + " cal.";
	});
};