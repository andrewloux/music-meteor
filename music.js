//Setting up DB collection of links
Links = new Meteor.Collection("links");

if (Meteor.isClient) {


/*PART I: SESSION ID GENERATION ----------------------------------------------------------------------------------------------------------*/
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

	Session.set("renderedBefore", false);
	Session.set("close_clickable",true);

	//lock screen until gapi loads
	$("#loading_modal").modal('show');

	Router.map(function () {
	  	this.route('tape', {
		    path: '/tape/:_sess',
		    before: function(){
				Template.list.my_playlist_id = this.params._sess;
				//console.log("ROUTING FIRST");
				//console.log("subscribing to sess inside route: " + this.params._sess);
				//console.log("after my sessid is " + Template.list.my_playlist_id);
				this.subscribe('links',this.params._sess);
		    }
	  });
	});
	//generate sessionID on pageload
	Template.list.sessID_Gen();	
});





/*PART II: YOUTUBE API AND CONTROL FUNCTIONS -----------------------------------------------------------------------------------------------*/

//Second parameter is to keep track of result to play if user doesn't like the first result.
Template.list.search_get= function(str,val){
    var request = gapi.client.youtube.search.list({part:'snippet',q:str, maxResults:10});

    request.execute(function(response) {
	    str = JSON.stringify(response.result);
	    str = JSON.parse(str);

		var video_list = [];
		str.items.forEach(function(entry) {
			console.log(entry);
			if((entry.id.kind != "youtube#channel") && (entry.id.kind != "youtube#playlist")){
				video_list.push(entry);	
			}
		});
 		//console.log(video_list);
		if(video_list.length != 0){
		
		//make a call to the db right now to create this session
		if(!Links.findOne({sess: Template.list.my_playlist_id})){
			console.log("im inserting a new record with sess id: "+Template.list.my_playlist_id);
			Links.insert({sess: Template.list.my_playlist_id});
		}

		/*Creating song object and pushing to db*/
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
			//Error handling code
		});
	}
   });
}

/*Update List on generate button*/
Template.list.updateList = function(){

	console.log("update list being called");
	var ret = [];
	
	/*Creating in-order Session copies of the playlist video urls as well as in-order Session copy of song objects*/

	/*Grabbing in-order song objects*/
    $( "#playlist .list_element" ).each(function() {
		if($(this).is(':visible')){
			var songs= Links.find({sess: Template.list.my_playlist_id},{songs: {$elemMatch: {index: $(this).attr('id')}}}).fetch()[0].songs;
			for (var i in songs){
				//console.log("hello this is: "+songs[i].index);
				if(songs[i].index == $(this).attr('id')){
					//console.log("pushing this song "+songs[i].song_title);
					ret.push(songs[i]);
					break;
				}
			}
	    }
	});
	
	/*Grabbing in-order video urls*/
	var urls = [];
	//console.log("length of ret " + ret.length);
	for (var i = 0; i < ret.length; i++){
		console.log("current video url: "+ret[i].videoId);
		urls[i] = ret[i].videoId;
	}

	/*Setting them to Session vars*/
	Session.set("current_list",ret);
	Session.set("current_urls",urls);
	
	/*Updating the database collection so if playlist is shared after a rearrange, order will be preserved*/
	Meteor.call('update_order',Template.list.my_playlist_id, ret, function(err,message){
		//console.log("update finito applying shadow to first element");
		$($("#navigation li")[0]).addClass("current_song");
		Session.set("prev_song_idx", 0);
	});


}

/*Signal that is sent to "mark" shared songs. Inelegant solution*/
Template.the_playlist.signal = function(){
	//Waits until the playlist finishes rendering. 
	var len = $("#playlist li").length;
	if (len != 0){
		$("#playlist li").each(function(){
			var idvar = $(this).attr('id');
			Session.set( "shared-" + idvar , true );
		});
	}
}

/*Playlist template helper, assigns hidden or visible Next icon depending on whether the playlist is shared or not*/
Template.the_playlist.helpers({
    'shared_songs': function() {
    		//Check that either signal is false OR 
    		if (Session.get("shared-" + this.index)){
    			return true;
    		}
    		else{
    			return false;  
    		}

    }
})

/*Grabs the main list!*/
Template.the_playlist.main_list = function(){

	var ret = Links.find().fetch()[0];
	if (typeof ret == 'undefined'){
		ret = []
	}
	else {
		ret = Links.find().fetch()[0].songs;
	}
	return ret;
}

/*Grabs the in order current list of songs*/
Template.navigation_list.navlist = function(){
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
		if(url){
		        $("#query").val('');
		        //The below line makes sure the user is always looking at the last updated thing
				$('#playlist_container').animate({scrollTop: $('#playlist_container')[0].scrollHeight});
				//insert records into the database
				Template.list.search_get(url,0);
		}	
       }
	}
  });

Template.list.events({
	'click .destroy' : function (){
		var index_local = this.index;
		//console.log("this: "+index_local);
		Session.set("to_delete",this.index);	
		$("#"+Session.get("to_delete")).fadeOut('slow',function(){
			Meteor.call('delete_record',Template.list.my_playlist_id, Session.get("to_delete"), function(err,message){
				//console.log("err from delete: "+err);
				//console.log("deleting this session variable: "+index_local);								
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

		//Grabbing next song -- iterating through search results which were saved. And subsequently making db call.
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
		var index = $("li.unremovable").index($("#video-"+this.index));
		//highlight next song
		$($("#navigation li")[Session.get("prev_song_idx")]).removeClass("current_song");
		$($("#navigation li")[index]).addClass("current_song");
		console.log("this song index is "+index);
		Session.set("prev_song_idx", index);

		player.loadPlaylist(Session.get("current_urls"),index);
	},
	//Loop control
	'click .unremovable .element_style .loop_activate' : function(){
		if ($("#video-"+this.index).hasClass("loop")){
			$("#video-"+this.index).removeClass("loop");
		}
		else{
			$("#video-"+this.index).addClass("loop");
			console.log("loop activated");
		}
		$("#video-"+this.index).children('.element_style').children('.loop_activate').toggleClass('fa-spin');
	}
  });

Template.generate.events({
	//Share modal control
	'click #share' : function(){
		console.log("showing modal");
		console.log(Template.list.my_playlist().fetch());
		if(Template.list.my_playlist().fetch().length == 0){
			$("#modal_title").text("Start collaborating!");
			$("#modal_text").html("<strong>Here's the link to the playlist you're about to create.</strong>")

		}
		else{
			$("#modal_title").text("Share and Collaborate!");
			$("#modal_text").html("<strong>Here's the link to the playlist you've just created.</strong>")
		}
		$("#share_link").val("mixtape.meteor.com/tape/"+Template.list.my_playlist_id);
		$("#dialog").modal('show');
	},
	//Generate YouTube video and playlist using updated list
	'click #generate_button': function (evt, template){
	Template.list.updateList();
	if(Template.list.my_playlist().fetch().length == 0){
			//alert('Your tape is empty!');
			$("#playlist-alert").fadeIn('slow');
			$("#playlist-alert").delay(4000).fadeOut('slow');
	}
	else{
			//console.log("current urls: "+Session.get("current_urls"));
			generatePlaylist(Session.get("current_urls"));
			//console.log("adding class for first song");
		
			$(".absolute_center2").fadeIn();
			/*Things to hide*/
			$("#playlist").fadeOut(700);
			$("#button_control").fadeOut(700);
			$("#search-group").fadeOut(700);
			$("#playlist_container").fadeOut(700, function(){
			$("#player-list_container").toggleClass("my_hide");
			});
		}
	} 
	});

  Template.unremovable_track.check_loop = function(current_index,signal){
	console.log("last signal: "+Session.get("last_signal"));
	if ((Session.get("from_click") == false)&&(Session.get("last_signal")!=-1)){
		if (Session.get("last_signal")!=YT.PlayerState.ENDED){
			//FIND INDEX IN THE PLAYLIST, THIS WILL LEAD YOU TO THE DOM ELEMENT.
			if (signal == YT.PlayerState.ENDED){
			    var index = current_index;
			}
			else if (signal == -1){
			    var index = current_index-1;
			}

			//console.log("CHECKING AND LOADING " + index);
			var loop_check = $($("#navigation li")[index]).hasClass("loop");

			if (loop_check == true){
				//Play it again, Sam!
				player.loadPlaylist(Session.get("current_urls"),index);
			
			}
			else{
				index = index+1;
				console.log("removing class for song "+Session.get("prev_song_idx"));
				$($("#navigation li")[Session.get("prev_song_idx")]).removeClass("current_song");
				console.log("adding class for song "+index);
				$($("#navigation li")[index]).addClass("current_song");
				Session.set("prev_song_idx",index);
			}
			Session.set("last_signal",signal);
		}
	}
	else{
		Session.set("from_click",false);
	}
  }

  /*Returns Collection*/
  Template.list.my_playlist = function(){
	return Links.find();
	
  }

  /*Returns db copy*/
  Template.player.nav_playlist = function(){
	return Session.get("current_list");
  }

 Template.header.events({
	//when user hits the generate playlist button
	'click #close_player': function (evt, template){
	
	if (Session.get("close_clickable")){
			Session.set("close_clickable",false);
			player.pauseVideo();
			$("#player-list_container").toggleClass("my_hide").promise().done(function(){
			$("#playlist").delay(300).css('display','block');
			$(".absolute_center2").fadeOut(500);
		
			/*Things to show*/
			$("#search-group").delay(300).fadeIn();
			$(".absolute_center").delay(300).fadeIn();
			$("#playlist_container").delay(300).fadeIn();
			$("#button_control").delay(300).fadeIn(function(){Session.set("close_clickable",true);});
		});

		/*Below yoou remove current_song class from navigation li*/
		$( "#navigation li" ).each(function() {
		  $( this ).removeClass( "current_song" );
		});
	}
 }
});
}//End of Client Code 

if (Meteor.isServer) {
  	Meteor.startup(function () {
	    // code to run on server at startup

	    //Only entries with matching sess_var are available per client session.
	    Meteor.publish("links", function(sess_var) {
		//console.log("sess_var is: "+sess_var);
		//console.log("the count is: "+Links.find({sess: sess_var}).count());
		//console.log(Links.find({sess: sess_var}));
		//return Links.find();
		return Links.find({sess: sess_var});
    });
});

//Could Bohan have put this somewhere else?
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
	//Gets total number of sessions, used in autonumber counter. 
	get_count: function(){
		return Links.find().count();
	},
	delete_record: function(sessID, ObjID){
		//console.log("trying to pull object "+ObjID +" from session: "+sessID);
		Links.update({sess: sessID}, {$pull: {songs: {index: ObjID}}});
		//console.log("remaining songs: "+Links.findOne({sess: sessID}).songs.length);
		if(Links.findOne({sess: sessID}).songs.length == 0){
			//console.log("list empty, destroying record with id "+sessID);
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
