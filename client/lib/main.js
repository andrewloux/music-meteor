Template.list.clean = function(collection) {
    if(collection) {
        // clean items
        _.each(collection.find().fetch(), function(item){
            collection.remove({_id: item._id});
        });
    }
}
