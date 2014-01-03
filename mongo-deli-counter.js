var nimble = require('nimble');

/**
* Assign easy numeric numbers to a small set of objects with complex unique IDs
* Main use case is to map a complex and hard-to-recognize session ID to a simple
* small positive integer, so instead of "user with session 18aeouc322348723aud"
* you can have "user015".
*
* @param options.mongoClient (object) a connected mongo client instance
* @param options.length (positive integer) rollover the counter when this limit is exceeded
* @param options.collectionName (string) name of the mongo collection to use (default "delicounter")
*/
function MongoDeliCounter(options) {
  this.mongoClient = options.mongoClient;
  this.length = options.length || 100;
  this.getActive = options.getActive;
  this.collectionName = options.collectionName || "delicounter";
  this.collection = this.mongoClient.collection(this.collectionName);
}

MongoDeliCounter.prototype.add = function add(item, callback) {

  //check if document already exists
  //if so, return it's current position
  //if not, count docs in collection, increment, assign that position to this item
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
    self._purgePush(item, callback);
  });
};

MongoDeliCounter.prototype.remove = function remove(item, callback) {
  this.collection.remove({item: item}, {multi: false, safe: true}, function (error, count) {
    callback(error, count > 0);
  });
};

MongoDeliCounter.prototype._push = function _push(item, callback) {
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

MongoDeliCounter.prototype.purge = function _purge(callback) {
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

MongoDeliCounter.prototype._purgePush = function _push(item, callback) {
  var self = this;
  this.purge(function (error) {
    if (error) {
      callback(error);
      return;
    }
    self._push(item, callback);
  });
};

MongoDeliCounter.prototype.list = function list(callback) {
  this.mongoClient.zrevrangebyscore(
    this.collectionName,
    '+inf', //max index
     0, //min index
    'WITHSCORES',
    callback
  );
};

MongoDeliCounter.prototype.reset = function reset(callback) {
  this.collection.remove(function (error) {
    if (error && error.errmsg === "ns not found") {
      //collection doesn't exist. No worries.
      callback();
      return;
    }
    callback(error);
  });
};

module.exports = MongoDeliCounter;
