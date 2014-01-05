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

/**
 * Add an item to the deli counter. This is "taking a number".
 *
 * @param item unique item to track
 *  type: string or number
 *  Required.
 * @param callback will be invoked with (error, position)
 *  type: function
 *  Required.
 */
function add(item, callback) {
  var self = this;
  //turns out it's probably more effecient to just load them all,
  //because otherwise we have to make several queries
  this.collection.find().toArray(function (error, tickets) {
    if (error) {
      callback(error);
      return;
    }
    var existingTicket = tickets.filter(function (ticket) {
      return ticket.item == item;
    });
    if (existingTicket.length) {
      //item is already present. All good.
      callback(null, existingTicket[0].position);
      return;
    }
    //We need to add the item
    if (tickets.length < self.length) {
      //still OK to grow. Compute max position.
      var max = maxPosition(tickets);
      _add.call(self, item, max + 1, callback);
      return;
    }
    //tickets limit reached. Time to discard stale elements
    _purgeThenAdd.call(self, item, tickets, callback);
  });
}

/**
 * Remove an item from the deli counter. Frees up the item's position.
 *
 * @param item unique item to track, which has been previously added
 *  type: string or number
 *  Required.
 * @param callback will be invoked with (error, found), where found is a
 *   boolean indicating whether the item was actually tracked
 *  type: function
 *  Required.
 */
function remove(item, callback) {
  this.collection.remove(
      {item: item}, {multi: false, safe: true}, function (error, count) {
    callback(error, count > 0);
  });
}

/**
 * Remove all state and initialize/clear the counter back to zero.
 *
 * @param callback will be invoked with (error)
 *  type: function
 *  Required.
 */
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

///// internal helper methods /////
function _add(item, position, callback) {
  //@TODO: handle case where no available positions.
  //probably emit an error event and just assign positions
  //greater than length and shrug
  var ticket = {item: item, position: position};
  this.collection.insert(ticket, function (error) {
    callback(error, ticket.position);
  });
}

function _purge(tickets, callback) {
  var self = this;
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
    var position = minPosition(activeTickets, self.length);
    _add.call(self, item, position, callback);
  });
}

///// internal helper functions /////
function minPosition(activeTickets, length) {
  var activePositions = activeTickets.map(function (ticket) {
    return ticket.position;
  });
  var min;
  for (var i = 1; i <= length; i++) {
    if (activePositions.indexOf(i) < 0) {
      //this position is not in active use and thus is available
      min = i;
      break;
    }
  }
  return min || (length + 1);
}

function maxPosition(tickets) {
  if (tickets.length < 1) {
    return 0;
  }
  var positions = tickets.map(function (ticket) { return ticket.position;});
  return Math.max.apply(null, positions);
}

MongoDeliCounter.prototype = {
  add:    add,
  remove: remove,
  reset:  reset
};
module.exports = MongoDeliCounter;
module.exports._test = {
  minPosition: minPosition,
  maxPosition: maxPosition
};
