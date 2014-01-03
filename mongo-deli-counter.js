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

// MongoDeliCounter.prototype.reclaim = function (item, callback) {
//   var self = this;
//   this.mongoClient.exists(this.propertyName + item, function (error, exists) {
//     if (error) {
//       callback(error);
//       return;
//     }
//     if (exists) {
//       return callback();
//     }
//     //OK, time to reclaim
//     self.mongoClient.zrem(self.collectionName, item, callback);
//   });
// };

MongoDeliCounter.prototype.purge = function (callback) {
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
    self.collection.find({}, ['item'], function (error, docs) {
      if (error) {
        callback(error);
        return;
      }
      var itemIds = docs.map(function (doc) {return doc.item;});
      getActiveItemIds(itemIds, callback);
    });
    function getActiveItemIds(allItemIds, cb) {

    }

    function deleteInactive(activeItemIds, cb) {

    }
    //get set of items paired with a position
    //get subset of those items that are still active
    //delete docs not in that set
  });
};

MongoDeliCounter.prototype._purgePush = function _push(item, callback) {
  var self = this;
  this.purge(function (error, count) {
    if (error) {
      callback(error);
      return;
    }
    var doc = {item: item, position: count + 1};
    self.collection.insert(doc, function (error) {
      callback(error, doc.position);
    });
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
