//Setting up new collection of links
Links = new Meteor.Collection("links");

if (Meteor.isClient) {


/*PART I: SESSION ID GENERATION ----------------------------------------------------------------------------------------------------------*/
 /*Check if you can put this anywhere else, it looks shit over here.*/

Template.list.sessID_Gen = function(){
	//need to get id from server

	Meteor.call('get_count', function(err,message){
	//alert(err);
		console.log("this is count: "+message);
		var id = (message).toString(30);
		var filler = "00000";
		/*Check if there is already an id assigned, this will differentiate
		  whether it's a brand new session or a shared sess*/
		if (Template.list.my_playlist_id){
			console.log("There already exists a playlist id");
		}
		else{
			Template.list.my_playlist_id = [filler.slice(0,5-id.length),id].join('');
			console.log("I just created a playlist id");	
		}
		console.log("SESSIDGEN FIRST");
		console.log("sessID: "+Template.list.my_playlist_id);
		Meteor.subscribe("links", Template.list.my_playlist_id);
	});
}

//The Router after event callback overrides the following line, such that each link is now a mixtape.


Meteor.startup(function (){
//lock screen until gapi loads
$("#loading_modal").modal('show');

Router.map(function () {
  //Implies I have a template named tape? That I'm not using... Calling it lists fucks things up.
  this.route('tape', {
    path: '/tape/:_sess',
    before: function(){
	Template.list.my_playlist_id = this.params._sess;
	console.log("ROUTING FIRST");
	 console.log("subscribing to sess inside route: " + this.params._sess);
	this.subscribe('links',this.params._sess);
	console.log("after my sessid is " + Template.list.my_playlist_id);
    }
  });
});
	Template.list.sessID_Gen();	//generate sessionID on pageload
});



/*PART II: YOUTUBE API AND CONTROL FUNCTIONS -----------------------------------------------------------------------------------------------*/

//Second parameter is to keep track of result to play if user doesn't like the first result.
Template.list.search_get= function(str,val){
    var request = gapi.client.youtube.search.list({part:'snippet',q:str, maxResults:10});

    request.execute(function(response) {
	    str = JSON.stringify(response.result);
	    str = JSON.parse(str);

	   

	   //Ensuring that we found a video and not a channel.
	   /* if ( (str.items[val].id.kind == "youtube#channel") || (str.items[val].id.kind == "youtube#playlist") ){
		while (str.items[val].id.kind != "youtube#video"){
			//Error checking, you could have an inf loop.
			val = val+1;
		}
	
	    }*/
	var video_list = [];
	str.items.forEach(function(entry) {
			console.log(entry);
			if((entry.id.kind != "youtube#channel") && (entry.id.kind != "youtube#playlist")){
				video_list.push(entry);	
			}
		});
 	console.log(video_list);
	if(video_list.length != 0){
	//make a call to the db right now

		if(!Links.findOne({sess: Template.list.my_playlist_id})){
			console.log("im inserting a new record with sess id: "+Template.list.my_playlist_id);
			Links.insert({sess: Template.list.my_playlist_id});
		}

		var song = new Object();	
		song["title"] = video_list[val].snippet.title;
		song["video_id"] = video_list[val].id.videoId;
		song["thumbnail"] = video_list[val].snippet.thumbnails;
		//song["index"] = val;
		song["index"] = new Meteor.Collection.ObjectID().toHexString();	//this is unique every time
		console.log("title: "+song["title"]);
		console.log("index: "+song["index"]);
		console.log("about to update");
		var last_song = video_list.shift();
		video_list.push(last_song);
		Session.set(song["index"],video_list);
		Meteor.call('update_record',Template.list.my_playlist_id, song, function(err,message){
			//
		});
	}
	
	//console.log(Links);
   });
   
}

/*Update List on generate button*/
Template.list.updateList = function(){
	console.log("update list being called");
	var ret = [];
        $( "#playlist .list_element" ).each(function() {
	if($(this).is(':visible')){
		var songs= Links.find({sess: Template.list.my_playlist_id},{songs: {$elemMatch: {index: $(this).attr('id')}}}).fetch()[0].songs;
		for (var i in songs){
			console.log("hello this is: "+songs[i].index);
			if(songs[i].index == $(this).attr('id')){
				console.log("pushing this song "+songs[i].song_title);
				ret.push(songs[i]);
				break;
			}
		}
         }
	});

	var urls = [];
	console.log("length of ret " + ret.length);
	for (var i = 0; i < ret.length; i++){
		console.log("current video url: "+ret[i].videoId);
		urls[i] = ret[i].videoId;
	}

	Session.set("current_list",ret);
	Session.set("current_urls",urls);
	
	Meteor.call('update_order',Template.list.my_playlist_id, ret, function(err,message){});
}


Template.fucking_list.navlist = function(){
	console.log("getting the fucking list for navigation");
	return Session.get("current_list");
}


/*PART III - EVENT HANDLERS AND REACTIONS BELOW-----------------------------------------------------------------------------------------------*/


//Loads API after #player is created for synchronicity(sp?)
Template.player.created = function(){
	  var tag = document.createElement('script');
	  tag.src = "https://apis.google.com/js/client.js?onload=onClientLoad";
	  var firstScriptTag = document.getElementsByTagName('script')[0];
	  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);			
	
}


 Template.search_bar.events({
    'keypress #query, click #search-button' : function (evt,template) {
      // template data, if any, is available in 'this'
      if (evt.which === 13 || evt.which == 1){
                var url = template.find('#query').value;
                $("#query").val('');
		$('#playlist_container').animate({scrollTop: $('#playlist_container')[0].scrollHeight});
		Template.list.search_get(url,0);	//insert records into the database
                }
       }
  });

  /*Template.list.events({
	'click .destroy' : function (){
		console.log("about to set this id for deletion: "+this._id);
		Session.set("to_delete",this._id);	
		$("#"+Session.get("to_delete")).fadeOut('slow',function(){
			Links.remove(Session.get("to_delete"));
			//Links.update({
		});
	}
  });*/

Template.list.events({
	'click .destroy' : function (){
		var index_local = this.index;
		console.log("this: "+index_local);
		Session.set("to_delete",this.index);	
		$("#"+Session.get("to_delete")).fadeOut('slow',function(){
			//Links.remove(Session.get("to_delete"));
			//Links.update({
			Meteor.call('delete_record',Template.list.my_playlist_id, Session.get("to_delete"), function(err,message){
			//alert(err);
				console.log("err from delete: "+err);
				console.log("deleting this session variable: "+index_local);								
				//Session.set(index_local,undefined);
				delete Session.keys[index_local];
			});
		});
	},
	'click .next_song' : function(){
		//console.log("NEXT");
		var curr_index = this.index;
		var song_list = Session.get(curr_index);
		/*song_list.forEach(function(entry){
			console.log("video_list tits: "+entry.snippet.title);
		});*/
		$(".list_element[id='"+curr_index+"'] .element_style").text(song_list[0].snippet.title);
		var last_song = song_list.shift();
		song_list.push(last_song);
		Session.set(curr_index,song_list); 

		var current_song = song_list.pop();
		var newsong = new Object();	
		newsong["title"] = current_song.snippet.title;
		newsong["video_id"] = current_song.id.videoId;
		newsong["thumbnail"] = current_song.snippet.thumbnails;
		newsong["obj_id"] = curr_index;
		Meteor.call('change_record',Template.list.my_playlist_id, newsong, function(err,message){
			//save the rest of the list in the array
			//console.log("inserted song:
			console.log("error from change_record: "+err); 
			
		});
	}
  });

  Template.unremovable_track.events({
	'click .unremovable .element_style .nav_song' : function (){
		/*from_click is a control variable that makes sure that loop_check doesn't get called
		  on every UNSTARTED event*/
		Session.set("from_click",true);
		var videoId_local = this.videoId;
		var index = $.inArray(videoId_local,Session.get("current_urls"));
		player.loadPlaylist(Session.get("current_urls"),index);
	},
	'click .unremovable .element_style .loop_activate' : function(){
		if ($("#video-"+this.index).hasClass("loop")){
			$("#video-"+this.index).removeClass("loop");
		}
		else{
			$("#video-"+this.index).addClass("loop");
			alert("Loop is activated");
		}
	}
  });

Template.generate.events({
	'click #share' : function(){
		console.log("showing modal");
		console.log(Template.list.my_playlist().fetch());
		if(Template.list.my_playlist().fetch().length == 0){
			console.log("THIS IS TRUE");
			$("#modal_title").text("Start collaborating!");

		}
		else{
			console.log("THIS IS FALSE");
			$("#modal_title").text("Share and Collaborate!");
		}
		$("#share_link").val("localhost:3000/tape/"+Template.list.my_playlist_id);
		$("#dialog").modal('show');
	},
	'click #generate_button': function (evt, template){
	Template.list.updateList();
	if(Template.list.my_playlist().fetch().length == 0){
		alert('Your tape is empty!');
	}
	else{
		console.log("current urls: "+Session.get("current_urls"));
		generatePlaylist(Session.get("current_urls"));
		$(".absolute_center2").fadeIn();
		/*Things to hide*/
		$("#playlist").css('display','none');
		$("#button_control").hide();
		$("#search-group").hide();
		$("#playlist_container").fadeOut();

		$("#player-list_container").fadeIn(1000);
		//$('body').animate({backgroundColor: 'rgb(53,53,53)'}, 'slow');
		//$('#title').animate({color: '#fff'}, 'slow');
	}
	} 	
});

  Template.unremovable_track.check_loop = function(current_index,signal){
	if ((Session.get("from_click") == false)&&(Session.get("last_signal")!=-1)){
		if (Session.get("last_signal")!=YT.PlayerState.ENDED){
		console.log("GOING IN");
		//FIND INDEX IN THE PLAYLIST, THIS WILL LEAD YOU TO THE DOM ELEMENT.
		if (signal == YT.PlayerState.ENDED){
		    var index = current_index;
		}
		else if (signal == -1){
		    var index = current_index-1;
		}

		console.log("CHECKING AND LOADING " + index);
		var loop_check = $($("#navigation li")[index]).hasClass("loop");

		if (loop_check == true){
			//Play it again, Sam!
			player.loadPlaylist(Session.get("current_urls"),index);
		}	
		Session.set("last_signal",signal);
	}
	}
	else{
		Session.set("from_click",false);
	}
  }

  Template.list.my_playlist = function(){
	return Links.find();
	
  }

 
  
  Template.player.nav_playlist = function(){
	return Session.get("current_list");
  }

  //when user hits the generate playlist button
  Template.header.events({
	'click #close_player': function (evt, template){		
		player.pauseVideo();
		$(".absolute_center2").fadeOut(500);

		$("#player-list_container").fadeOut();

		$("#playlist").css('display','block');

		/*Things that must reappear*/
		$("#search-group").show();

		$(".absolute_center").fadeIn(1000);
		$("#playlist_container").fadeIn(1000);
		$("#button_control").show();

		//$('body').animate({backgroundColor: '#fff'}, 'slow');
		//$('#title').animate({color: '#000'}, 'slow');

	}
	
  });

}//End of Client

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
    //console.log("hello");
    Meteor.publish("links", function(sess_var) {
     //console.log("publishing");
	console.log("sess_var is: "+sess_var);
     // return Links.findOne({sess:sess_var});  //each client will only have links with that _lastSessionId
	console.log("the count is: "+Links.find({sess: sess_var}).count());
	//console.log(Links.find({sess: sess_var}));
	return Links.find({sess: sess_var});
	//return Links.find();
	
    });
  
});


(function () {
Meteor.methods({
	update_record: function(sessID, songObj){
		Links.update({sess: sessID}, {$push: {songs: {song_title: songObj["title"], videoId: songObj["video_id"], thumbnail: songObj["thumbnail"], index: songObj["index"]}}});
		console.log("songs: "+Links.findOne({sess: sessID}).songs.length);
	},
	//Call this only on Share.
	update_order: function(sessID, songsArray){
		Links.update({sess:sessID}, {$set:{songs: songsArray}});
	},
	get_count: function(){
		return Links.find().count();
	},
	delete_record: function(sessID, ObjID){
		console.log("trying to pull object "+ObjID +" from session: "+sessID);
		Links.update({sess: sessID}, {$pull: {songs: {index: ObjID}}});
		console.log("remaining songs: "+Links.findOne({sess: sessID}).songs.length);
		if(Links.findOne({sess: sessID}).songs.length == 0){
			console.log("list empty, destroying record with id "+sessID);
			Links.remove({sess: sessID});
		}
	},
	change_record: function(sessID, songObj){
		Links.update({sess: sessID, "songs.index": songObj["obj_id"]},{$set:{"songs.$.song_title": songObj["title"], "songs.$.videoId":songObj["video_id"],"songs.$.thumbnail":songObj["thumbnail"]}});
		//console.log(
	}
});
}());
  
}//End of Server
