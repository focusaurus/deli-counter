/**
* Assign easy numeric numbers to a small set of objects with complex unique IDs
* Main use case is to map a complex and hard-to-recognize session ID to a simple
* small positive integer, so instead of "user with session 18aeouc322348723aud"
* you can have "user015".
*
* @param length (positive integer) rollover the counter when this limit is exceeded
*/
function MemoryDeliCounter(length) {
  this.items = [];
  this.length = length;
}

MemoryDeliCounter.prototype.add = function add(item) {
  var itemIndex = this.items.indexOf(item);
  if (itemIndex >= 0) {
    //item is already present. All good.
    return itemIndex + 1;
  }
  //We need to add the item
  if (this.items.length < this.length) {
    //clear for a normal push
    return this._push(item);
  } else {
    //OK, we're too big, try to reclaim an earlier slot
    var nullIndex = this.items.indexOf(null);
    if (nullIndex >= 0) {
      this.items[nullIndex] = item;
      return nullIndex + 1;
    } else {
      //Well, we've exceeded the length but the user hasn't removed anything
      //to free up space, just do a push
      return this._push(item);
    }
  }
};

MemoryDeliCounter.prototype.remove = function remove(item) {
  var index = this.items.indexOf(item);
  if (index < 0) {
    return false;
  }
  this.items[index] = null;
  return index + 1;
};

MemoryDeliCounter.prototype._push = function _push(item) {
  this.items.push(item);
  return this.items.length;
};

module.exports = MemoryDeliCounter;
