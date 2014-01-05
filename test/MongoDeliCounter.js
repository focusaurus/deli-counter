var assert            = require("assert");
var MongoClient       = require('mongodb').MongoClient;
var MongoDeliCounter  = require("..").MongoDeliCounter;
var nimble            = require("nimble");

var testDbURL = "mongodb://" + (process.env.DC_MONGO_HOST || "127.0.0.1");
testDbURL += ":" + (process.env.DC_MONGO_PORT || "27017");
testDbURL += "/_test_delicounter";
var counter;

function makeTickets(positions) {
  return positions.map(function (position) {
    return {
      item: "item" + position,
      position: position
    };
  });
}

MongoClient.connect(testDbURL, function(error, mongo) {
  if (error) {
    throw error;
  }
  counter = new MongoDeliCounter({
    mongoClient: mongo,
    length: 3
  });
});
var add = function (item, callback) {
  counter.add(item, callback);
};

function checkAdd(number, callback) {
  var id = "id" + number;
  counter.add(id, function (error, position) {
    assert(error === null);
    assert.equal(number, position);
    callback();
  });
}

function waitForConnection(callback) {
  if (counter) {
    callback();
    return;
  }
  setTimeout(waitForConnection.bind(null, callback), 25);
}

function addOneTwoThree(callback) {
  nimble.each([1,2,3], counter.add.bind(counter), callback);
}


describe("MongoDeliCounter", function () {
  before(function (done) {
    waitForConnection(done);
  });

  beforeEach(function (done) {
    counter.reset(done);
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
    var reclaimCounter = new MongoDeliCounter({
      getActive: function (presentIds, callback) {callback(null, [1, 3]);},
      length: 3,
      mongoClient: counter.mongoClient
    });
    nimble.series([
      function (callback) {reclaimCounter.add(1, callback);},
      function (callback) {reclaimCounter.add(2, callback);},
      function (callback) {reclaimCounter.add(3, callback);}
    ], function (error) {
      if (error) {
        done(error);
        return;
      }
      reclaimCounter.add(4, function (error, position) {
        assert.equal(error, null);
        assert.equal(position, 2);
        done();
      });
    });
  });

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
      counter.remove(3, function (error, removed) {
        assert.equal(error, null);
        assert.strictEqual(removed, true);
        done();
      });
    });
  });

  describe("MongoDeliCounter minPosition", function () {
    var minPosition = MongoDeliCounter._test.minPosition;
    it("should start at 1", function() {
      assert.equal(minPosition([], 42), 1);
    });
    it("should find the first slot with sequences", function() {
      var tickets = makeTickets([1, 2, 3]);
      assert.equal(minPosition(tickets, 42), 4);
    });
    it("should find the first slot when there's a gap", function() {
      var tickets = makeTickets([1, 3, 4]);
      assert.equal(minPosition(tickets, 42), 2);
    });
    it("should exceed length when full", function() {
      var tickets = makeTickets([1, 2, 3]);
      assert.equal(minPosition(tickets, 3), 4);
    });
  });

  describe("MongoDeliCounter maxPosition", function () {
    var maxPosition = MongoDeliCounter._test.maxPosition;
    it("should start at 0", function() {
      assert.equal(maxPosition([], 42), 0);
    });
    it("should work with contiguous ordered sequences", function() {
      var tickets = makeTickets([1, 2, 3]);
      assert.equal(maxPosition(tickets, 42), 3);
    });
    it("should work with contiguous reversed sequences", function() {
      var tickets = makeTickets([3, 2, 1]);
      assert.equal(maxPosition(tickets, 42), 3);
    });
    it("should work with gaps and disordered values", function() {
      var tickets = makeTickets([1, 3, 7, 4]);
      assert.equal(maxPosition(tickets, 42), 7);
    });
  });
});
