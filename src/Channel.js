const EventEmitter = require('events').EventEmitter

class Channel extends EventEmitter {
  constructor (orbit, channelName, feed) {
    super()

    this.orbit = orbit
    this.channelName = channelName
    this.feed = feed

    this.feed.events.on('load.progress', this._onLoadProgress.bind(this))
    this.feed.events.on('replicate.progress', this._onReplicateProgress.bind(this))
    this.feed.events.on('write', this._onWrite.bind(this))
    this.feed.events.on('ready', this._onReady.bind(this))
  }

  get peers () {
    return this.orbit._ipfs.pubsub.peers(this.feed.address.toString())
  }

  // Called while loading from local filesystem
  _onLoadProgress (...args) {
    this._onNewEntry(args[2])
  }

  // Called while loading from IPFS (receiving new messages)
  _onReplicateProgress (...args) {
    this._onNewEntry(args[2])
  }

  // Called when the user writes a message (text or file)
  _onWrite (...args) {
    this._onNewEntry(args[2][0])
  }

  _onNewEntry (entry) {
    this.emit('entry', entry, this.channelName)
    this.orbit.events.emit('entry', entry, this.channelName)
  }

  _onReady () {
    this.emit('ready')
  }

  load (amount) {
    this.feed.load(amount)
  }

  sendMessage (message) {
    return this.orbit.send(this.channelName, message)
  }
}

module.exports = Channel
