var assert = require('assert');
var MemoryDeliCounter = require('..').MemoryDeliCounter;

describe("MemoryDeliCounter", function () {
  var counter;
  beforeEach(function () {
    counter = new MemoryDeliCounter();
  });
  it("should accept any object and return an integer", function() {
    var number1 = counter.add("id1");
    assert.equal(number1, 1);
    var number2 = counter.add("id2");
    assert.equal(number2, 2);
    var number3 = counter.add("id3");
    assert.equal(number3, 3);
  });

  it("should return the same integer when an item is re-added", function() {
    var number1 = counter.add("id1");
    assert.equal(number1, 1);
    assert.equal(counter.add("id1"), 1);
  });

  it("should return false when asked to remove a missing item", function() {
    assert.equal(counter.remove("notinthere"), false);
  });

  it("should return the item number when removing a present item", function() {
    var number1 = counter.add("id1");
    assert.equal(counter.remove("id1"), number1);
  });

  it("should rollover properly", function() {
    var smallCounter = new MemoryDeliCounter(3);
    smallCounter.add("1");
    smallCounter.add("2");
    smallCounter.remove("1");
    //There's a free spot, but still space, so this should get a new number
    var number3 = smallCounter.add("3");
    assert.equal(number3, 3);
    //now we've hit the max length, there is a free slot, so it should roll over
    assert.equal(smallCounter.add("4"), 1);
    //now we're full up, adding something else should just keep going beyond
    assert.equal(smallCounter.add("5"), 4);
    //now if we remove something to free up a space and add another
    //it should get that slot
    smallCounter.remove("2");
    assert.equal(smallCounter.add("6"), 2);
  });
});
