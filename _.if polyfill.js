if(!_.if) {
	_.mixin({"if": function(Bool, This, That) {
		if(Bool) {return This;}
		else {return That;}
	}});
}