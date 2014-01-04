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
  //turns out it's probably more effecient to just load them all,
  //because otherwise we have to make several queries
  this.collection.find().toArray(function (error, tickets) {
    if (error) {
      callback(error);
      return;
    }
    var existingTicket = tickets.filter(function (item) {
      return item.item == item;
    }).pop();
    if (existingTicket) {
      //item is already present. All good.
      callback(null, existingTicket.position);
      return;
    }
    //We need to add the item
    _purgeThenAdd.call(self, item, tickets, callback);
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

function _add(item, activeTickets, callback) {
  var activePositions = activeTickets.map(function (ticket) {
    return ticket.position;
  });
  var lowestAvailablePosition;
  for (var i = 1, length = this.length; i <= length; i++) {
    if (activePositions.indexOf(i) < 0) {
      //this position is not in active use and thus is available
      lowestAvailablePosition = i;
      break;
    }
  }
  //@TODO: handle case where no available positions.
  //probably emit an error event and just assign positions
  //greater than length and shrug
  var ticket = {item: item, position: lowestAvailablePosition};
  this.collection.insert(ticket, function (error) {
    callback(error, ticket.position);
  });
}

function _purge(tickets, callback) {
  var self = this;
  if (tickets.length < this.length) {
    //still OK to grow
    process.nextTick(function () {
      callback(null, tickets);
    });
    return;
  }
  //tickets limit reached. Time to discard stale elements
  var itemIds = tickets.map(function (doc) {return doc.item;});
  this.getActive(itemIds, deleteInactive);
  function deleteInactive(error, activeItemIds, cb) {
    if (error) {
      callback(error);
      return;
    }
    self.collection.remove({item: {$nin: activeItemIds}}, function (error) {
      if (error) {
        callback(error);
        return;
      }
      //now we need to prune the in-memory list as well to keep in sync
      var activeTickets = tickets.filter(function (ticket) {
        return activeItemIds.indexOf(ticket.item) >= 0;
      });
      callback(null, activeTickets);
    });
  }
}

function _purgeThenAdd(item, tickets, callback) {
  var self = this;
  _purge.call(this, tickets, function (error, activeTickets) {
    if (error) {
      callback(error);
      return;
    }
    _add.call(self, item, activeTickets, callback)
  });
};

MongoDeliCounter.prototype = {
  add:    add,
  remove: remove,
  reset:  reset
};
module.exports = MongoDeliCounter;
