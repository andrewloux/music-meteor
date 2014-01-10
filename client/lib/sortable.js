  $(function() {
    /*Then we make sortable*/
    $( "#playlist" ).sortable({
	update: function(){
	Template.list.updateList(); //Updates on moving the position of an element around.
     }});
    $( "#playlist" ).disableSelection();
  });
