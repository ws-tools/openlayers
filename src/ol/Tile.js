/**
 * @module ol/Tile
 */
import {inherits} from './index.js';
import TileState from './TileState.js';
import {easeIn} from './easing.js';
import EventTarget from './events/EventTarget.js';
import EventType from './events/EventType.js';

/**
 * @classdesc
 * Base class for tiles.
 *
 * @constructor
 * @abstract
 * @extends {ol.events.EventTarget}
 * @param {ol.TileCoord} tileCoord Tile coordinate.
 * @param {ol.TileState} state State.
 * @param {olx.TileOptions=} opt_options Tile options.
 */
var _ol_Tile_ = function(tileCoord, state, opt_options) {
  EventTarget.call(this);

  var options = opt_options ? opt_options : {};

  /**
   * @type {ol.TileCoord}
   */
  this.tileCoord = tileCoord;

  /**
   * @protected
   * @type {ol.TileState}
   */
  this.state = state;

  /**
   * An "interim" tile for this tile. The interim tile may be used while this
   * one is loading, for "smooth" transitions when changing params/dimensions
   * on the source.
   * @type {ol.Tile}
   */
  this.interimTile = null;

  /**
   * A key assigned to the tile. This is used by the tile source to determine
   * if this tile can effectively be used, or if a new tile should be created
   * and this one be used as an interim tile for this new tile.
   * @type {string}
   */
  this.key = '';

  /**
   * The duration for the opacity transition.
   * @type {number}
   */
  this.transition_ = options.transition === undefined ?
    250 : options.transition;

  /**
   * Lookup of start times for rendering transitions.  If the start time is
   * equal to -1, the transition is complete.
   * @type {Object.<number, number>}
   */
  this.transitionStarts_ = {};

};

inherits(_ol_Tile_, EventTarget);


/**
 * @protected
 */
_ol_Tile_.prototype.changed = function() {
  this.dispatchEvent(EventType.CHANGE);
};


/**
 * @return {string} Key.
 */
_ol_Tile_.prototype.getKey = function() {
  return this.key + '/' + this.tileCoord;
};

/**
 * Get the interim tile most suitable for rendering using the chain of interim
 * tiles. This corresponds to the  most recent tile that has been loaded, if no
 * such tile exists, the original tile is returned.
 * @return {!ol.Tile} Best tile for rendering.
 */
_ol_Tile_.prototype.getInterimTile = function() {
  if (!this.interimTile) {
    //empty chain
    return this;
  }
  var tile = this.interimTile;

  // find the first loaded tile and return it. Since the chain is sorted in
  // decreasing order of creation time, there is no need to search the remainder
  // of the list (all those tiles correspond to older requests and will be
  // cleaned up by refreshInterimChain)
  do {
    if (tile.getState() == TileState.LOADED) {
      return tile;
    }
    tile = tile.interimTile;
  } while (tile);

  // we can not find a better tile
  return this;
};

/**
 * Goes through the chain of interim tiles and discards sections of the chain
 * that are no longer relevant.
 */
_ol_Tile_.prototype.refreshInterimChain = function() {
  if (!this.interimTile) {
    return;
  }

  var tile = this.interimTile;
  var prev = this;

  do {
    if (tile.getState() == TileState.LOADED) {
      //we have a loaded tile, we can discard the rest of the list
      //we would could abort any LOADING tile request
      //older than this tile (i.e. any LOADING tile following this entry in the chain)
      tile.interimTile = null;
      break;
    } else if (tile.getState() == TileState.LOADING) {
      //keep this LOADING tile any loaded tiles later in the chain are
      //older than this tile, so we're still interested in the request
      prev = tile;
    } else if (tile.getState() == TileState.IDLE) {
      //the head of the list is the most current tile, we don't need
      //to start any other requests for this chain
      prev.interimTile = tile.interimTile;
    } else {
      prev = tile;
    }
    tile = prev.interimTile;
  } while (tile);
};

/**
 * Get the tile coordinate for this tile.
 * @return {ol.TileCoord} The tile coordinate.
 * @api
 */
_ol_Tile_.prototype.getTileCoord = function() {
  return this.tileCoord;
};


/**
 * @return {ol.TileState} State.
 */
_ol_Tile_.prototype.getState = function() {
  return this.state;
};

/**
 * @param {ol.TileState} state State.
 */
_ol_Tile_.prototype.setState = function(state) {
  this.state = state;
  this.changed();
};

/**
 * Load the image or retry if loading previously failed.
 * Loading is taken care of by the tile queue, and calling this method is
 * only needed for preloading or for reloading in case of an error.
 * @abstract
 * @api
 */
_ol_Tile_.prototype.load = function() {};

/**
 * Get the alpha value for rendering.
 * @param {number} id An id for the renderer.
 * @param {number} time The render frame time.
 * @return {number} A number between 0 and 1.
 */
_ol_Tile_.prototype.getAlpha = function(id, time) {
  if (!this.transition_) {
    return 1;
  }

  var start = this.transitionStarts_[id];
  if (!start) {
    start = time;
    this.transitionStarts_[id] = start;
  } else if (start === -1) {
    return 1;
  }

  var delta = time - start + (1000 / 60); // avoid rendering at 0
  if (delta >= this.transition_) {
    return 1;
  }
  return easeIn(delta / this.transition_);
};

/**
 * Determine if a tile is in an alpha transition.  A tile is considered in
 * transition if tile.getAlpha() has not yet been called or has been called
 * and returned 1.
 * @param {number} id An id for the renderer.
 * @return {boolean} The tile is in transition.
 */
_ol_Tile_.prototype.inTransition = function(id) {
  if (!this.transition_) {
    return false;
  }
  return this.transitionStarts_[id] !== -1;
};

/**
 * Mark a transition as complete.
 * @param {number} id An id for the renderer.
 */
_ol_Tile_.prototype.endTransition = function(id) {
  if (this.transition_) {
    this.transitionStarts_[id] = -1;
  }
};
export default _ol_Tile_;
