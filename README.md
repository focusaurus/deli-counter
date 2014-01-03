#Deli Counter

Provides the ability to provide "Now Serving" style small integers across a set of values.

![Now Serving](http://arewefullyet.com/images/2013/06/now-serving.jpg)

The idea is say you have unfriendly values like session IDs in a web application, but you want to assign friendly numbers like "Session 1", "Session 2" to them, that's what this module will do for you.

## MemoryDeliCounter

Stores values in memory. OK for small things.

    var counter = new require('deli-counter').MemoryDeliCounter;

## RedisDeliCounter

Stores values in redis. There will be basically 2 sets of interest. The "big set" which is normally your session store, and the internal delicounter set where we keep the small numbers.

## MongoDeliCounter

Stores values in mongodb.