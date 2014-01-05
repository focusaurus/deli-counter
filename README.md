#Deli Counter

Provides the ability to provide "Now Serving" style small integers across a set of values.

![Now Serving](http://arewefullyet.com/images/2013/06/now-serving.jpg)

The idea is say you have unfriendly values like session IDs in a web application, but you want to assign friendly numbers like "Session 1", "Session 2" to them, that's what this module will do for you.

## MemoryDeliCounter

Stores values in memory. OK for small in-process things.

    var counter = new require('deli-counter').MemoryDeliCounter;

## MongoDeliCounter

Stores values in mongodb. Driving use case was mapping web session IDs to small integers, so a `getActive` function such as

    function getActive(mongoClient, sessionIds, callback) {
      mongoClient.collection("sessions").find(
          {_id: {$in: sessionIds}}, ["_id"]).toArray(function (error, sessions) {
        if (error) {
          callback(error);
          return;
        }
        callback(null, sessions.map(function (session) {return session._id;}));
      });
    }

    var options = {
      mongoClient: aConnectedMongodbInstance,
      getActive: getActive
    };
    var counter = new MongoDeliCounter(options);
    counter.add("sessionId1", function (error, position) {
      console.log("Added sessionId1 to deli counter at position", position);
    });

## RedisDeliCounter (Not yet entirely correct)

Stores values in redis. There will be basically 2 sets of interest. The "big set" which is normally your session store, and the internal delicounter set where we keep the small numbers.