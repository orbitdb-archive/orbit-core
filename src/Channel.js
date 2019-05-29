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

  /* async loadMore (amount = 10) {
    // TODO: This is a bit hacky, but at the time of writing is the only way
    // to load more entries

    const log = this.feed._oplog
    const Log = log.constructor

    try {
      const newLog = await Log.fromEntryHash(
        this.feed._ipfs,
        this.feed.identity,
        log.tails[0].next[0],
        {
          logId: log.id,
          access: this.feed.access,
          length: log.values.length + amount,
          exclude: log.values,
          onProgressCallback: this.feed._onLoadProgress.bind(this.feed)
        }
      )

      // await log.join(newLog)
      await monkeyPatchedJoin(log, newLog)

      await this.feed._updateIndex()

      this.feed.events.emit('ready', this.feed.address.toString(), log.heads)
    } catch (e) {
      if (!log.tails[0].next[0]) {
        console.warn('No more history to load!')
      } else {
        console.error(e.stack)
      }
    }
  } */

  async loadMore (amount = 10) {
    try {
      const olderEntries = this.feed._oplog.iterator({
        lte: this.feed._oplog.tails[0].next[0],
        amount: amount
      })
      await this.feed._oplog.join(olderEntries)
      await this.feed._updateIndex()
      this.feed.events.emit('ready', this.feed.address.toString(), this.feed._oplog.heads)
    } catch (e) {
      if (!this.feed._oplog.tails[0].next[0]) {
        console.warn('No more history to load!')
      } else {
        console.error(e.stack)
      }
    }
  }
}

async function monkeyPatchedJoin (log, newLog) {
  const Log = log.constructor

  if (!Log.monkeyPatched) {
    Log._origDifference = Log.difference
    Log.difference = differenceMonkeyPatch
    Log.monkeyPatched = true
  }

  await log.join(newLog)

  if (Log.monkeyPatched) {
    Log.difference = Log._origDifference
    delete Log._origDifference
    delete Log.monkeyPatched
  }
}

function differenceMonkeyPatch (a, b) {
  // let stack = Object.keys(a._headsIndex)
  const stack = Object.keys(a._entryIndex) // This is the only change
  const traversed = {}
  const res = {}

  const pushToStack = hash => {
    if (!traversed[hash] && !b.get(hash)) {
      stack.push(hash)
      traversed[hash] = true
    }
  }

  while (stack.length > 0) {
    const hash = stack.shift()
    const entry = a.get(hash)
    if (entry && !b.get(hash) && entry.id === b.id) {
      res[entry.hash] = entry
      traversed[entry.hash] = true
      entry.next.forEach(pushToStack)
    }
  }
  return res
}

module.exports = Channel
