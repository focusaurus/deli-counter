/**
* Assign easy numeric numbers to a small set of objects with complex unique IDs
* Main use case is to map a complex and hard-to-recognize session ID to a simple
* small positive integer, so instead of "user with session 18aeouc322348723aud"
* you can have "user015".
*
* @param options.mongoClient
*   a connected mongo client instance. Required.
*   type: object
* @param options.getActive
*   a function called to get the list of item IDs still in active use.
*   Usage is getActive(callback) and callback takes (error, arrayOfActiveItemIds).
*   Required.
*   type: function
* @param options.length
*   rollover the counter when this limit is exceeded.
*   type: positive integer
*   Optional. Default 100.
* @param options.collectionName
*   name of the mongo collection to use.
*   type: string
*   Optional. Default "delicounter".
*/
function MongoDeliCounter(options) {
  this.mongoClient = options.mongoClient;
  this.getActive = options.getActive;
  this.length = options.length || 100;
  this.collection = this.mongoClient.collection(
    options.collectionName || "delicounter");
}

//@TODO: optimize DB queries to just one findAll
function add(item, callback) {
  var self = this;
  this.collection.findOne(
      {item: item, position: {$exists: true}},
      function (error, itemInDb) {
    if (error) {
      callback(error);
      return;
    }
    if (itemInDb) {
      //item is already present. All good.
      callback(null, itemInDb.position);
      return;
    }
    //We need to add the item
    _purgeThenAdd.call(self, item, callback);
  });
};

function remove(item, callback) {
  this.collection.remove(
      {item: item}, {multi: false, safe: true}, function (error, count) {
    callback(error, count > 0);
  });
}

function reset(callback) {
  this.collection.remove(function (error) {
    if (error && error.errmsg === "ns not found") {
      //collection doesn't exist. No worries.
      callback();
      return;
    }
    callback(error);
  });
}

function _add(item, callback) {
  var self = this;
  this.collection.find({}, ['position']).toArray(function (error, items) {
    if (error) {
      callback(error);
      return;
    }
    var activePositions = items.map(function (item) {
      return item.position;
    });
    var lowestAvailablePosition;
    for (var i = 1, length = self.length; i <= length; i++) {
      if (activePositions.indexOf(i) < 0) {
        //this position is not in active use and thus is available
        lowestAvailablePosition = i;
        break;
      }
    }
    //@TODO: handle case where no available positions.
    //probably emit an error event and just assign positions
    //greater than length and shrug
    var doc = {item: item, position: lowestAvailablePosition};
    self.collection.insert(doc, function (error) {
      callback(error, doc.position);
    });
  });
};

function _purge(callback) {
  var self = this;
  this.collection.count(function (error, count) {
    if (error) {
      callback(error);
      return;
    }
    if (count < self.length) {
      //still OK to grow
      callback(null, count);
      return;
    }
    //items limit reached. Time to discard stale elements
    self.collection.find({}, ['item']).toArray(function (error, docs) {
      if (error) {
        callback(error);
        return;
      }
      var itemIds = docs.map(function (doc) {return doc.item;});
      self.getActive(itemIds, deleteInactive);
    });
    function deleteInactive(error, activeItemIds, cb) {
      if (error) {
        callback(error);
        return;
      }
      self.collection.remove({item: {$nin: activeItemIds}}, callback);
    }
  });
};

function _purgeThenAdd(item, callback) {
  var self = this;
  _purge.call(this, function (error) {
    if (error) {
      callback(error);
      return;
    }
    _add.call(self, item, callback)
  });
};

MongoDeliCounter.prototype = {
  add:    add,
  remove: remove,
  reset:  reset
};
module.exports = MongoDeliCounter;
