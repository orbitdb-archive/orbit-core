'use strict'

const path = require('path')
const EventEmitter = require('events').EventEmitter
const OrbitDB = require('orbit-db')
const Crypto = require('orbit-crypto')
const Post = require('ipfs-post')
const Logger = require('logplease')
const LRU = require('lru')

const IdentityProviders = require('./identity-providers')

const logger = Logger.create('Orbit', { color: Logger.Colors.Green })
Logger.setLogLevel(
  process.env.NODE_ENV === 'development' ? Logger.LogLevels.DEBUG : Logger.LogLevels.ERROR
)

const getAppPath = () =>
  process.type && process.env.ENV !== 'dev' ? process.resourcesPath + '/app/' : process.cwd()

const networkHash = 'QmR28ET9zueMwXbmjYyszy5JqVQAwB8HSb1SxEQ8wcZb1L'

const defaultOptions = {
  keystorePath: path.join(getAppPath(), '/orbit/keys'), // path where to keep generates keys
  cachePath: path.join(getAppPath(), '/orbit/orbitdb'), // path to orbit-db cache file
  maxHistory: -1 // how many messages to retrieve from history on joining a channel
}

class Orbit {
  constructor (ipfs, options = {}) {
    this.events = new EventEmitter()
    this._network = null
    this._ipfs = ipfs
    this._orbitdb = null
    this._user = null
    this._channels = {}
    this._peers = []
    this._pollPeersTimer = null
    this._options = Object.assign({}, defaultOptions)
    this._cache = new LRU(1000)
    Object.assign(this._options, options)
    Crypto.useKeyStore(this._options.keystorePath)
  }

  /* Properties */

  get user () {
    return this._user ? this._user.profile : null
  }

  get network () {
    return this._network
  }

  get channels () {
    return this._channels
  }

  get peers () {
    return this._peers
  }

  _getChannelPath (channel) {
    const c = Object.keys(this._channels).filter(e => e === channel)[0]
    return c ? this._channels[c] : null
  }

  /* Public methods */

  getChannel (channel) {
    return this._getChannelPath(channel)
  }

  async connect (credentials = {}) {
    logger.debug('Load cache from:', this._options.cachePath)
    logger.info(`Connecting to Orbit as '${JSON.stringify(credentials)}`)

    if (typeof credentials === 'string') {
      credentials = { provider: 'orbit', username: credentials }
    }

    this._network = networkHash

    // A hack to force peers to connect
    const res = await this._ipfs.object.put(Buffer.from(JSON.stringify({ app: 'orbit.chat' })))
    this._ipfs.object.get(res.toJSON().multihash, { enc: 'base58' })

    // TODO: These can and should be called concurrently e.g. with Promise.all
    this._user = await IdentityProviders.authorizeUser(this._ipfs, credentials)
    this._orbitdb = await new OrbitDB(this._ipfs, this._options.cachePath, { sync: false })

    this._startPollingForPeers()

    logger.info(`Connected to '${this._orbitdb.address}' as '${this.user.name}`)
    this.events.emit('connected', this._network, this.user)

    return this
  }

  disconnect () {
    if (!this._orbitdb) return
    logger.warn(`Disconnected from '${this._network}'`)
    this._orbitdb.disconnect()
    this._orbitdb = null
    this._user = null
    this._channels = {}
    this._network = null
    if (this._pollPeersTimer) clearInterval(this._pollPeersTimer)
    this.events.emit('disconnected')
  }

  async join (channelName) {
    if (!channelName || channelName === '') throw new Error('Channel not specified')

    logger.debug(`Join #${channelName}`)

    if (this._channels[channelName]) return false

    const dbOptions = {
      path: this._options.cachePath,
      maxHistory: this._options.maxHistory,
      // Allow anyone to write to the channel
      admin: ['*'],
      write: ['*']
    }

    const db = await this._orbitdb.eventlog(channelName, dbOptions)

    this._channels[channelName] = {
      name: channelName,
      password: null,
      feed: db // feed is the database instance
    }

    this.events.emit('joined', channelName)
  }

  async leave (channelName) {
    const channel = this.getChannel(channelName)

    if (channel) {
      await channel.feed.close()
      delete this._channels[channelName]
      logger.debug('Left channel #' + channelName)
    }
    this.events.emit('left', channelName)
  }

  async send (channel, message, replyToHash) {
    if (!channel || channel === '') throw new Error('Channel must be specified')
    if (!message || message === '') throw new Error("Can't send an empty message")
    if (!this.user) throw new Error("Something went wrong: 'user' is undefined")

    logger.debug(`Send message to #${channel}: ${message}`)

    const data = {
      content: message.substring(0, 2048),
      replyto: replyToHash || null,
      from: this.user
    }

    // TODO: These can and should be called concurrently e.g. with Promise.all
    data.from = await this.getUser(this.user.id)
    const feed = await this._getChannelFeed(channel)

    return this._postMessage(feed, Post.Types.Message, data, this._user._keys)
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
  async addFile (channel, source) {
    if (!source || (!source.filename && !source.directory)) {
      throw new Error('Filename or directory not specified')
    }

    async function _addToIpfsJs (data) {
      const result = await this._ipfs.files.add(Buffer.from(data))
      const isDirectory = false
      const Hash = result[0].hash
      return { Hash, isDirectory }
    }

    async function _addToIpfsGo (filename, filePath) {
      const result = await this._ipfs.files.add({ path: filePath })
      // last added hash is the filename --> we added a directory
      // first added hash is the filename --> we added a file
      const isDirectory = result[0].path.split('/').pop() !== filename
      const Hash = isDirectory ? result[result.length - 1].hash : result[0].hash
      return { Hash, isDirectory }
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

    // TODO: These can and should be called concurrently e.g. with Promise.all
    const feed = await this._getChannelFeed(channel)
    const userProfile = await this.getUser(this.user.id)
    const result = await addToIpfs()

    logger.info(`Added file '${source.filename}' as`, result)

    // Create a post
    const type = result.isDirectory ? Post.Types.Directory : Post.Types.File
    const data = {
      name,
      hash: result.Hash,
      size,
      from: userProfile,
      meta: source.meta || {}
    }

    const post = await this._postMessage(feed, type, data, this._user._keys)

    return post
  }

  getFile (hash) {
    if (this._ipfs.cat) return this._ipfs.catReadableStream(hash)

    return this._ipfs.files.catReadableStream(hash)
  }

  getDirectory (hash) {
    return this._ipfs.ls(hash).then(res => res.Objects[0].Links)
  }

  async getUser (hash) {
    const userFromCache = this._cache.get(hash)
    if (userFromCache) return userFromCache
    else {
      const res = await this._ipfs.object.get(hash, { enc: 'base58' })
      const profileData = JSON.parse(res.toJSON().data)

      try {
        const profile = await IdentityProviders.loadProfile(this._ipfs, profileData)
        Object.assign(profile || profileData, { id: hash })
        this._cache.set(hash, profile)
        return profile
      } catch (e) {
        logger.error(e)
        return profileData
      }
    }
  }

  loadMoreHistory (channel, amount, fromEntries) {
    if (fromEntries) {
      return this._getChannelFeed(channel)
        .then(feed => feed.loadMoreFrom(amount, fromEntries))
        .catch(err => logger.error(err))
    } else {
      return this._getChannelFeed(channel)
        .then(feed => feed.loadMore(amount))
        .catch(err => logger.error(err))
    }
  }

  /* Private methods */

  async _postMessage (feed, postType, data, signKey) {
    const post = await Post.create(this._ipfs, postType, data, signKey)
    await feed.add(JSON.stringify(post))
    return post
  }

  async _getChannelFeed (channel) {
    if (!channel || channel === '') throw new Error('Channel not specified')
    const c = this.getChannel(channel)
    const feed = c && c.feed ? c.feed : null
    if (!feed) throw new Error(`Haven't joined #${channel}`)
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
