/*
function clean(collection) {
    if(collection) {
        // clean items
        _.each(collection.find().fetch(), function(item){
            collection.remove({_id: item._id});
        });
    }

}*/

//Setting up a collection of urls
Links = new Meteor.Collection("links");

if (Meteor.isClient) {
  //"Subscribing" to server's published data
   Meteor.subscribe("links");

  Template.hello.events({
    'click #MyButton' : function () {
      // template data, if any, is available in 'this'
      if (typeof console !== 'undefined')
		var find = Links.find({sess:Meteor.default_connection._lastSessionId}).fetch();
		console.log(find);
    }
  });

  //Songs from session
	Template.list_of_links.my_playlist = function () {
	  //return Links.find({sess: Meteor.default_connection._lastSessionId});
	  return Links.find();
	};
	
	Template.search_bar.events({
	//http://stackoverflow.com/a/13945912/765409
    'keypress #query' : function (evt,template) {
      // template data, if any, is available in 'this'
      if (evt.which === 13){
		var url = template.find('#query').value;
		//Find a nicer way of clearing shit.
		$("#query").val('');
		Links.insert({sess:Meteor.default_connection._lastSessionId,youtube_link:url});
		console.log(url);
		//Add to database.
	}
    }
  });  
  
  }

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
	Meteor.publish("links", function() {
        //return Links.find({sess:Meteor.default_connection._lastSessionId});
		return Links.find();
    });
  });
}
