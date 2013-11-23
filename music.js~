//Setting up new collection of links
Links = new Meteor.Collection("links");

if (Meteor.isClient) {

 /*Check if you can put this anywhere else, it looks shit over here.*/
 Template.list.sessID_Gen = function(){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;	
 } 

 Template.list.my_playlist_id = Template.list.sessID_Gen();

//Second value is to keep track of result to play if user doesn't like the first result.
Template.list.search_get= function(str,val){
    var request = gapi.client.youtube.search.list({part:'snippet',q:str});

    request.execute(function(response) {
	    str = JSON.stringify(response.result);
	    str = JSON.parse(str);
            Links.insert({sess:Template.list.my_playlist_id,song_title:str.items[val].snippet.title,videoId:str.items[0].id.videoId,thumbnail:str.items[val].snippet.thumbnails.medium.url,index:val});
    });
}

Router.map(function () {
  //Implies I have a template named tape? That I'm not using... Calling it lists fucks things up.
  this.route('tape', {
    path: '/tape/:_sess',
    before: function(){
	this.subscribe('links',this.params._sess);
    }
  });
});

 //Renew subscription on state change.
 Deps.autorun( function(){
   Meteor.subscribe( "links", Template.list.my_playlist_id);
 });


 Template.search_bar.events({
    'keypress #query' : function (evt,template) {
      // template data, if any, is available in 'this'
      if (evt.which === 13){
                var url = template.find('#query').value;
                $("#query").val('');
		Template.list.search_get(url,0);
                }
       }
  });


  Template.list.my_playlist = function(){
	//After the deep copy in the routing part of the code, the JQuery will not be relevant.
	return Links.find();
  }

  Template.track.events({
	//Fixing the weird delete issue with solution that's both clunky and pretty at the same time!
	'click .destroy' : function (){
		$("#"+this._id).fadeOut('slow',function(){Links.remove(this._id);});
	}
  });
  
}//End of Client

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
    Meteor.publish("links", function(sess_var) {
      return Links.find({sess:sess_var});  //each client will only have links with that _lastSessionId
    });
  });

  
}//End of Server
