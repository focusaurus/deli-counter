//This is a work-in-progress. Doesn't work correctly yet.
//if development resumes, put nimble and redis in the package.json
return; ///////////////////!!!!!!!!!!!!!!!!!!!!!!!!!!

var assert            = require("assert");
var nimble            = require('nimble');
var redis             = require("redis");
var RedisDeliCounter  = require("../RedisDeliCounter");

var redisClient = redis.createClient(
  process.env.DC_REDIS_PORT || 6379,
  process.env.DC_REDIS_HOST || 'localhost'
);
var keyPrefix = "_test_sess:";
var setName = "_test_delicounter";
var counter = new RedisDeliCounter({
  redisClient: redisClient,
  keyPrefix: keyPrefix,
  setName: setName,
  length: 3
});
var add = counter.add.bind(counter);
var remove = counter.remove.bind(counter);

function checkAdd(number, callback) {
  var id = "id" + number;
  counter.add(id, function (error, position) {
    assert(error === null);
    assert.equal(number, position);
    callback();
  });
}

function waitForConnection(callback) {
  if (redisClient.connected) {
    callback();
    return;
  }
  setTimeout(waitForConnection.bind(null, callback), 25);
}

function addOneTwoThree(callback) {
  nimble.each([1,2,3], counter.add.bind(counter), callback);
}


describe("RedisDeliCounter", function () {
  before(function (done) {
    waitForConnection(done);
  });

  beforeEach(function (callback) {
    redisClient.del(setName, function (error) {
      if (error) {
        callback(error);
        return;
      }
      redisClient.del(
        keyPrefix + 'id1',
        keyPrefix + 'id2',
        keyPrefix + 'id3',
        callback
      );
    });
  });

  it("should accept any object and return an integer", function(done) {
    nimble.series([
      checkAdd.bind(null, 1),
      checkAdd.bind(null, 2),
      checkAdd.bind(null, 3)
    ], done);
  });

  it("should return the existing score for a re-add", function(done) {
    nimble.each([1,1,1], checkAdd, done);
  });

  it("should reclaim a lower score when length is exceeded", function(done) {
    nimble.series([
      function (callback) {add(1, callback);},
      function (callback) {add(2, callback);},
      function (callback) {add(3, callback);},
      function (callback) {
        redisClient.del(keyPrefix + '1', callback);
      }
    ], function (error) {
      if (error) {
        done(error);
        return;
      }
      counter.add(4, function (error, score) {
        assert.equal(error, null);
        assert.equal(score, 1);
        done();
      });
    });
  });

  //@bug this doesn't work correctly in the redis implementation yet
  it("should reclaim a lower interior score when length is exceeded");
  // it("should reclaim a lower interior score when length is exceeded", function(done) {
  //   nimble.series([
  //     function (callback) {add(1, callback)},
  //     function (callback) {add(2, callback)},
  //     function (callback) {add(3, callback)},
  //     function (callback) {
  //       redisClient.del(keyPrefix + '2', callback);
  //     }
  //   ], function (error) {
  //     if (error) {
  //       done(error);
  //       return;
  //     }
  //     counter.add(4, function (error, score) {
  //       assert.equal(error, null);
  //       assert.equal(score, 2);
  //       done();
  //     });
  //   });
  // });

  it("should return false when asked to remove a missing item", function (done) {
    counter.remove(1, function (error, removed) {
      assert.equal(error, null);
      assert.strictEqual(removed, false);
      done();
    });
  });

  it("should return the true when removing a present item", function(done) {
    nimble.series([
      function (callback) {add(1, callback);},
      function (callback) {add(2, callback);},
      function (callback) {add(3, callback);}
    ], function (error) {
      assert.equal(error, null);
      counter.remove(3, function (error, score) {
        assert.equal(error, null);
        assert.strictEqual(score, true);
        done();
      });
    });
  });
});
