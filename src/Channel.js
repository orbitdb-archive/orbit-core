const EventEmitter = require('events').EventEmitter

class Channel extends EventEmitter {
  constructor (orbit, channelName, feed) {
    super()

    this.orbit = orbit
    this.channelName = channelName
    this.feed = feed

    this.feed.events.on('error', this._onError.bind(this))
    this.feed.events.on('write', this._onWrite.bind(this))
    this.feed.events.on('load.progress', this._onLoadProgress.bind(this))
    this.feed.events.on('replicate.progress', this._onReplicateProgress.bind(this))
    this.feed.events.on('ready', this._onReady.bind(this))
    this.feed.events.on('replicated', this._onReplicated.bind(this))
  }

  get peers () {
    return this.orbit._ipfs.pubsub.peers(this.feed.address.toString())
  }

  get replicationStatus () {
    return this.feed.replicationStatus
  }

  get address () {
    return this.feed.address
  }

  _onError (error) {
    this.emit('error', error)
  }

  _onNewEntry (entry) {
    this.emit('entry', entry, this.channelName)
    this.orbit.events.emit('entry', entry, this.channelName)
  }

  // Called while loading from local filesystem
  _onLoadProgress (...args) {
    this.emit('load.progress')
    this._onNewEntry(args[2])
  }

  // Called while loading from IPFS (receiving new messages)
  _onReplicateProgress (...args) {
    this.emit('replicate.progress')
    this._onNewEntry(args[2])
  }

  _onReady () {
    this.emit('load.done')
    this.emit('ready')
  }

  _onReplicated () {
    this.emit('replicate.done')
  }

  // Called when the user writes a message (text or file)
  _onWrite (...args) {
    this.emit('write')
    this._onNewEntry(args[2][0])
  }

  load (amount) {
    this.feed.load(amount)
  }

  sendMessage (message) {
    return this.orbit.send(this.channelName, message)
  }

  sendFile (file) {
    return this.orbit.addFile(this.channelName, file)
  }

  async loadMore (amount = 10) {
    throw new Error('loadMore is not implemented')
  }
}

module.exports = Channel
