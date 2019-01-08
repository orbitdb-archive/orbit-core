'use strict'

const path = require('path')
const EventEmitter = require('events').EventEmitter
const OrbitDB = require('orbit-db')
const Logger = require('logplease')

const IdentityProviders = require('./IdentityProviders')

const logger = Logger.create('Orbit', { color: Logger.Colors.Green })

Logger.setLogLevel(
  process.env.NODE_ENV === 'development' ? Logger.LogLevels.DEBUG : Logger.LogLevels.ERROR
)

const getAppPath = () =>
  process.type && process.env.ENV !== 'dev' ? process.resourcesPath + '/app/' : process.cwd()

const defaultOptions = {
  directory: path.join(getAppPath(), '/orbit/orbitdb') // path to orbit-db file
}

class Orbit {
  constructor (ipfs, options = {}) {
    this.events = new EventEmitter()
    this._ipfs = ipfs
    this._orbitdb = null
    this._user = null
    this._channels = {}
    this._peers = []
    this._pollPeersTimer = null
    this._options = Object.assign({}, defaultOptions, options)
  }

  /* Public properties */

  get user () {
    return this._user
  }

  get channels () {
    return this._channels
  }

  get peers () {
    return this._peers
  }

  /* Public methods */

  async connect (credentials = {}) {
    logger.info(`Connecting to Orbit as ${JSON.stringify(credentials)}`)

    if (typeof credentials === 'string') {
      credentials = { provider: 'orbitdb', username: credentials }
    }

    this._user = await IdentityProviders.authorizeUser(this._ipfs, credentials)

    this._orbitdb = await OrbitDB.createInstance(this._ipfs, {
      directory: this._options.directory,
      identity: this.user.identity
    })

    this._startPollingForPeers()

    logger.info(`Connected to Orbit as "${this.user.profile.name}"`)

    this.events.emit('connected', this.user)

    return this
  }

  disconnect () {
    if (!this._orbitdb) return

    logger.warn('Disconnected')

    this._orbitdb.disconnect()
    this._orbitdb = null
    this._user = null
    this._channels = {}

    if (this._pollPeersTimer) clearInterval(this._pollPeersTimer)

    this.events.emit('disconnected')
  }

  async join (channelName) {
    if (!channelName || channelName === '') throw new Error('Channel not specified')

    if (this.channels[channelName]) return false

    logger.debug(`Join #${channelName}`)

    const db = await this._orbitdb.log(channelName, {
      accessController: {
        write: ['*'] // Allow anyone to write to the channel
      }
    })

    this._channels[channelName] = {
      name: channelName,
      password: null,
      feed: db // feed is the database instance
    }

    logger.debug(`Joined #${channelName}, ${db.address.toString()}`)

    this.events.emit('joined', channelName)
  }

  async leave (channelName) {
    const channel = this.channels[channelName]

    if (channel) {
      await channel.feed.close()
      delete this._channels[channelName]
      logger.debug('Left channel #' + channelName)
    }

    this.events.emit('left', channelName)
  }

  async send (channelName, message, replyToHash) {
    if (!channelName || channelName === '') throw new Error('Channel must be specified')
    if (!message || message === '') throw new Error("Can't send an empty message")
    if (!this.user) throw new Error("Something went wrong: 'user' is undefined")

    logger.debug(`Send message to #${channelName}: ${message}`)

    const data = {
      content: message.substring(0, 2048),
      meta: { from: this.user.profile, type: 'text', ts: new Date().getTime() }
    }

    return this._postMessage(channelName, data)
  }

  /*
    addFile(channel, source) where source is:
    {
      // for all files, filename must be specified
      filename: <filepath>,    // add an individual file
      // and optionally use one of these in addition
      directory: <path>,       // add a directory
      buffer: <Buffer>,        // add a file from buffer
      // optional meta data
      meta: <meta data object>
    }
  */
  async addFile (channelName, source) {
    if (!source || (!source.filename && !source.directory)) {
      throw new Error('Filename or directory not specified')
    }

    async function _addToIpfsJs (data) {
      const result = await this._ipfs.files.add(Buffer.from(data))
      const isDirectory = false
      const hash = result[0].hash
      return { hash, isDirectory }
    }

    async function _addToIpfsGo (filename, filePath) {
      const result = await this._ipfs.files.add({ path: filePath })
      // last added hash is the filename --> we added a directory
      // first added hash is the filename --> we added a file
      const isDirectory = result[0].path.split('/').pop() !== filename
      const hash = isDirectory ? result[result.length - 1].hash : result[0].hash
      return { hash, isDirectory }
    }

    logger.info(`Adding file from path '${source.filename}'`)

    const isBuffer = source.buffer && source.filename
    const name = source.directory
      ? source.directory.split('/').pop()
      : source.filename.split('/').pop()
    const size = source.meta && source.meta.size ? source.meta.size : 0

    let addToIpfs

    if (isBuffer) {
      // Adding from browsers
      addToIpfs = _addToIpfsJs.bind(this, source.buffer)
    } else if (source.directory) {
      // Adding from Electron
      addToIpfs = _addToIpfsGo.bind(this, name, source.directory)
    } else {
      addToIpfs = _addToIpfsGo.bind(this, name, source.filename)
    }

    const upload = await addToIpfs()

    logger.info(`Added file '${source.filename}' as`, upload)

    // Create a post
    const data = {
      content: upload.hash,
      meta: Object.assign(
        {
          from: this.user.profile,
          type: upload.isDirectory ? 'directory' : 'file',
          ts: new Date().getTime()
        },
        { size, name },
        source.meta || {}
      )
    }

    return this._postMessage(channelName, data)
  }

  getFile (hash) {
    if (this._ipfs.cat) return this._ipfs.catReadableStream(hash)

    return this._ipfs.files.catReadableStream(hash)
  }

  getDirectory (hash) {
    return this._ipfs.ls(hash).then(res => res.Objects[0].Links)
  }

  async loadMoreHistory (channel, amount, fromEntries) {
    const feed = this._getChannelFeed(channel)
    try {
      if (fromEntries) return feed.loadMoreFrom(amount, fromEntries)
      return feed.loadMore(amount)
    } catch (err) {
      logger.error(err)
    }
  }

  /* Private methods */

  _postMessage (channelName, data) {
    const feed = this._getChannelFeed(channelName)
    return feed.add(data)
  }

  _getChannelFeed (channelName) {
    if (!channelName || channelName === '') throw new Error('Channel not specified')
    const feed = this.channels[channelName].feed || null
    if (!feed) throw new Error(`Have not joined #${channelName}`)
    return feed
  }

  _startPollingForPeers () {
    async function update () {
      try {
        this._peers = (await this._updateSwarmPeers()) || []
        // TODO: get unique (new) peers and emit 'peer' for each instead of all at once
        this.events.emit('peers', this._peers)
      } catch (e) {
        logger.error(e)
      }
    }

    if (!this._pollPeersTimer) this._pollPeersTimer = setInterval(update.bind(this), 3000)
  }

  async _updateSwarmPeers () {
    try {
      const peers = await this._ipfs.swarm.peers()
      return Object.keys(peers)
        .filter(e => peers[e].addr !== undefined)
        .map(e => peers[e].addr.toString())
    } catch (e) {
      logger.error(e)
    }
  }
}

module.exports = Orbit
