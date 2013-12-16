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

//The Router after event callback overrides the following line, such that each link is now a mixtape.
Template.list.my_playlist_id = Template.list.sessID_Gen();

//Second parameter is to keep track of result to play if user doesn't like the first result.
Template.list.search_get= function(str,val){
    var request = gapi.client.youtube.search.list({part:'snippet',q:str});

    request.execute(function(response) {
	    str = JSON.stringify(response.result);
	    str = JSON.parse(str);

	   //Ensuring that we found a video and not a channel.
	    if ( (str.items[val].id.kind == "youtube#channel") || (str.items[val].id.kind == "youtube#playlist") ){
		while (str.items[val].id.kind != "youtube#video"){
			//Error checking, you could have an inf loop.
			val = val+1;
		}
	    }
            Links.insert({sess:Template.list.my_playlist_id,song_title:str.items[val].snippet.title,videoId:str.items[val].id.videoId,thumbnail:str.items[val].snippet.thumbnails.medium.url,index:val});
    });
}

//Since the order of playlist has been changed, this iterates through elements in new order, and rets an array of the results.
/* Use cases: param == "videoIds"
 * param == undef => all the collections vars.
 *
 */
Template.list.get_list = function(param){
  var ret = [];
  $( "li.list_element" ).each(function() {
    if($(this).is(':visible')){
	ret.push(   Links.findOne({_id:$(this).attr('id')})   );
    }
  });

  //No input parameters, return the entire thing
  if (typeof param == "undefined"){
    return ret;
  }

  else if (param == "videoIds"){
	var urls = [];
	for (var i = 0; i < ret.length; i++){
		urls[i] = ret[i].videoId;
	}
	return urls;
  }
}



Router.map(function () {
  //Implies I have a template named tape? That I'm not using... Calling it lists fucks things up.
  this.route('tape', {
    path: '/tape/:_sess',
    before: function(){
	this.subscribe('links',this.params._sess);
    },
    after: function(){
	Template.list.my_playlist_id = this.params._sess;
    }
  });
});

 //Renew subscription on state change.
 Meteor.subscribe( "links", Template.list.my_playlist_id);

 Template.search_bar.events({
    'keypress #query' : function (evt,template) {
      // template data, if any, is available in 'this'
      if (evt.which === 13){
                var url = template.find('#query').value;
                $("#query").val('');
		$('#playlist_container').animate({scrollTop: $('#playlist_container')[0].scrollHeight});
		Template.list.search_get(url,0);
                }
       }
  });

  Template.list.my_playlist = function(){
	//After the deep copy in the routing part of the code, the JQuery will not be relevant.
	return Links.find();
  }

  Template.list.events({
	'click .destroy' : function (){
		Session.set("to_delete",this._id);	
		$("#"+Session.get("to_delete")).fadeOut('slow',function(){
			Links.remove(Session.get("to_delete"));
		});
	}
  });

  Template.unremovable_track.events({
	'click .unremovable' : function (){
		var videoId_local = this.videoId;
		var index = $.inArray(videoId_local,Template.globalvar);
		console.log(Template.globalvar);
		console.log(videoId_local);
		console.log(index);
		player.loadPlaylist(Template.globalvar,index);
	}
  });
  
  Template.player.my_playlist = function(){
	//After the deep copy in the routing part of the code, the JQuery will not be relevant.
	return Links.find();
  }


  Template.header.events({
	'click #generate_button': function (evt, template){
		//bad code below:
		Template.globalvar = Template.list.get_list("videoIds");		
		generatePlaylist(Template.globalvar);

		$("#playlist").css('display','none',1000);//Check that this last argument works. 
		$("#player").fadeIn(1000);
		$("#close_player").fadeIn(1000);
	

		/*Things to hide*/
		$("#play").hide();
		$("#query").hide();
		$("#share").fadeOut(1000);
		$("#playlist_container").fadeOut(1000);

		$('body').animate({backgroundColor: 'rgb(53,53,53)'}, 'slow');$('#title').animate({color: '#fff'}, 'slow');$('#query').fadeOut('slow');

	}
  });


  Template.header.events({
	'click #close_player': function (evt, template){		
		player.stopVideo();
		$("#player").fadeOut(500);
		$("#close_player").hide();
		$("#playlist").css('display','block');

		/*Things that must reappear*/
		$("#query").show();
		$("#share").fadeIn(1000);
		$("#play").fadeIn(1000);		
		$("#playlist_container").fadeIn(1000);

		$('body').animate({backgroundColor: '#fff'}, 'slow');$('#title').animate({color: '#000'}, 'slow');$('#query').fadeIn('slow')

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
