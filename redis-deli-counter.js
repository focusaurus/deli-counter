var nimble = require('nimble');

/**
* Assign easy numeric numbers to a small set of objects with complex unique IDs
* Main use case is to map a complex and hard-to-recognize session ID to a simple
* small positive integer, so instead of "user with session 18aeouc322348723aud"
* you can have "user015".
*
* @param options.redisClient (object) a connected redis client instance
* @param options.length (positive integer) rollover the counter when this limit is exceeded
* @param options.setName (string) name of the redis set to use (default "delicounter")
* @param options.keyPrefix (string) prefix for records (default "")
*/
function RedisDeliCounter(options) {
  this.redisClient = options.redisClient
  this.length = options.length || 100;
  this.setName = options.setName || "delicounter";
  this.keyPrefix = options.keyPrefix || "";
}

RedisDeliCounter.prototype.add = function add(item, callback) {
  var self = this;
  this.redisClient.zscore(this.setName, item, function (error, score) {
    if (error) {
      callback(error);
      return;
    }
    if (score != null) {
      //item is already present. All good.
      callback(null, score);
      return;
    }
    //We need to add the item
    self._purgePush(item, callback);
  });
};

RedisDeliCounter.prototype.remove = function remove(item, callback) {
  this.redisClient.zrem(this.setName, item, function (error, count) {
    callback(error, count > 0);
  });
};

RedisDeliCounter.prototype.reclaim = function (item, callback) {
  var self = this;
  this.redisClient.exists(this.keyPrefix + item, function (error, exists) {
    if (error) {
      callback(error);
      return;
    }
    if (exists) {
      return callback();
    }
    //OK, time to reclaim
    self.redisClient.zrem(self.setName, item, callback);
  });
};

RedisDeliCounter.prototype.purge = function (callback) {
  var self = this;
  this.redisClient.zcard(this.setName, function (error, length) {
    if (error) {
      callback(error);
      return;
    }
    if (length < self.length) {
      //still OK to grow
      callback();
      return;
    }
    //length limit reached. Time to discard stale elements
    self.redisClient.zrange(self.setName, 0, -1, function (error, records) {
      if (error) {
        callback(error);
        return;
      }
      nimble.each(records, self.reclaim.bind(self), callback);
    });
  });
};

RedisDeliCounter.prototype._purgePush = function _push(item, callback) {
  var self = this;
  this.purge(function (error) {
    if (error) {
      callback(error);
      return;
    }
    self._push(item, callback);
  });
};

RedisDeliCounter.prototype._push = function _push(item, callback) {
  var self = this;
  this.redisClient.zrevrangebyscore(
      this.setName,
      '+inf', //max index
       0, //min index
      'WITHSCORES',
      'LIMIT',
      0, //offset
      1, //count
      function (error, winner) {
    if (error) {
      callback(error);
      return;
    }
    var score = 1;
    if (winner[1]) {
      score = parseInt(winner[1], 10) + 1;
    }
    self.redisClient.zadd(self.setName, score, item, function (error) {
      callback(error, score);
    });
  });
};

RedisDeliCounter.prototype.list = function (callback) {
  this.redisClient.zrevrangebyscore(
    this.setName,
    '+inf', //max index
     0, //min index
    'WITHSCORES',
    callback
  );
};

module.exports = RedisDeliCounter;
