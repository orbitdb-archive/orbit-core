'use strict'

const path = require('path')
const EventEmitter = require('events').EventEmitter
const OrbitDB = require('orbit-db')
const Crypto = require('orbit-crypto')
const Post = require('ipfs-post')
const Logger = require('logplease')
const LRU = require('lru')
const rmrf = require('rimraf')
// const mapSeries = require('./promise-map-series')
const OrbitUser = require('./orbit-user')
const IdentityProviders = require('./identity-providers')

const logger = Logger.create("Orbit", { color: Logger.Colors.Green })
require('logplease').setLogLevel('ERROR')

const getAppPath = () => process.type && process.env.ENV !== "dev" ? process.resourcesPath + "/app/" : process.cwd()

const defaultOptions = {
  keystorePath: path.join(getAppPath(), "/orbit/keys"), // path where to keep generates keys
  cachePath: path.join(getAppPath(), "/orbit/orbit-db"), // path to orbit-db cache file
  maxHistory: 64 // how many messages to retrieve from history on joining a channel
}

let signKey

class Orbit {
  constructor(ipfs, options = {}) {
    this.events = new EventEmitter()
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

  get user() {
    return this._user ? this._user.profile : null
  }

  get network() {
    return this._orbitdb ? this._orbitdb.network : null
  }

  get channels() {
    return this._channels
  }

  get peers() {
    return this._peers
  }

  /* Public methods */

  connect(credentials = {}) {
    logger.debug("Load cache from:", this._options.cachePath)
    logger.info(`Connecting to Orbit as '${JSON.stringify(credentials)}`)

    if(typeof credentials === 'string') {
      credentials = { provider: 'orbit', username: credentials }
    }

    // A hack to force peers to connect
    this._ipfs.object.put(new Buffer(JSON.stringify({ app: 'orbit.chat' })))
      .then((res) => this._ipfs.object.get(res.toJSON().multihash, { enc: 'base58' }))
      .catch((err) => logger.error(err))

    return IdentityProviders.authorizeUser(this._ipfs, credentials)
      .then((user) => this._user = user)
      .then(() => new OrbitDB(this._ipfs, this.user.id))
      // .then(() => OrbitDB.connect(host, this.user.identityProvider.id, null, this._ipfs))
      .then((orbitdb) => {
        this._orbitdb = orbitdb
        // this._orbitdb.events.on('data', this._handleMessage.bind(this)) // Subscribe to updates in the database
        this._startPollingForPeers() // Get peers from libp2p and update the local peers array
        return
      })
      .then(() => {
        logger.info(`Connected to '${this._orbitdb.network.name}' as '${this.user.name}`)
        this.events.emit('connected', this.network, this.user)
        return this
      })
      .catch((e) => console.error(e))
  }

  disconnect() {
    if(this._orbitdb) {
      logger.warn(`Disconnected from '${this.network.name}'`)
      this._orbitdb.disconnect()
      this._orbitdb = null
      this._user = null
      this._channels = {}
      if(this._pollPeersTimer) clearInterval(this._pollPeersTimer)
      this.events.emit('disconnected')
    }
  }

  join(channel) {
    logger.debug(`Join #${channel}`)

    if(!channel || channel === '')
      return Promise.reject(`Channel not specified`)

    if(this._channels[channel])
      return Promise.resolve(false)

    // console.log(this._user)
    const dbOptions = {
      cachePath: this._options.cachePath,
      maxHistory: this._options.maxHistory,
      syncHistory: true,
    }

    this._channels[channel] = {
      name: channel,
      password: null,
      feed: this._orbitdb.eventlog(channel, dbOptions) // feed is the database instance
    }

    // Subscribe to updates in the database
    // this._channels[channel].feed.events.on('history', this._handleNewMessages.bind(this))
    this._channels[channel].feed.events.on('write', this._handleMessage.bind(this))
    this._channels[channel].feed.events.on('synced', this._handleNewMessages.bind(this))
    // this._orbitdb.events.on('data', this._handleMessage.bind(this)) // Subscribe to updates in the database
    const historyAmount = 1
    this._channels[channel].feed.load(historyAmount)
    this.events.emit('joined', channel)
    return Promise.resolve(true)
  }

  leave(channel) {
    if(this._channels[channel]) {
      this._orbitdb.close(channel)
      delete this._channels[channel]
      logger.debug("Left channel #" + channel)
    }
    this.events.emit('left', channel)
  }

  send(channel, message, replyToHash) {
    if(!message || message === '')
      return Promise.reject(`Can't send an empty message`)

    logger.debug(`Send message to #${channel}: ${message}`)

    let data = {
      content: message.substring(0, 2048),
      replyto: replyToHash || null,
      from: this.user
    }

    // return this._getChannelFeed(channel)
    return this.getUser(this.user.id)
      .then((user) => data.from = user)
      .then(() => this._getChannelFeed(channel))
      .then((feed) => this._postMessage(feed, Post.Types.Message, data, this._user._keys))
  }

  get(channel, lessThanHash = null, greaterThanHash = null, amount = 1) {
    logger.debug(`Get messages from #${channel}: ${lessThanHash}, ${greaterThanHash}, ${amount}`)

    let options = {
      limit: amount,
      lt: lessThanHash,
      gte: greaterThanHash,
    }

    return this._getChannelFeed(channel)
      .then((feed) => {
        const messages = feed.iterator(options)
          .collect()
          .map((e) => {
            let value = JSON.parse(e.payload.value)
            // value.Post.hash = value.Hash
            let obj = Object.assign({}, e)
            obj = Object.assign(obj, { payload: { value: value } })
            // trim content length
            if (obj.payload.value.Post.content) {
              const maxLength = 1024
              obj.payload.value.Post.content = obj.payload.value.Post.content.substring(0, maxLength)
            }
            value.Entry = e
            // return obj.payload.value.Post
            return value
          })
        return Promise.resolve(messages)
        // return mapSeries(messages, (e) => this.getPost(e.payload.value, true))
        //   .catch((e) => logger.error(e))
      })
  }

  getPost(hash) {
    const post = this._cache.get(hash)

    if (post) {
      return Promise.resolve(post)
    } else {
      let post, signKey
      return this._ipfs.object.get(hash, { enc: 'base58' })
        .then((res) => post = JSON.parse(res.toJSON().data))
        // .then(() => Crypto.importKeyFromIpfs(this._ipfs, post.signKey))
        // .then((signKey) => Crypto.verify(
        //   post.sig,
        //   signKey,
        //   new Buffer(JSON.stringify({
        //     content: post.content,
        //     meta: post.meta,
        //     replyto: post.replyto
        //   })))
        //  )
        .then(() => {
          this._cache.set(hash, post)

          // Append the hash to the data structure so consumers can use it directly
          post.hash = post.hash || hash

          // if (withUserProfile) {
          return this.getUser(post.meta.from)
          // }

          // return post
        })
        .then((user) => {
          post.meta.from = user
          return post
        })
    }
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
  addFile(channel, source) {
    if(!source || (!source.filename && !source.directory))
      return Promise.reject(`Filename or directory not specified`)

    const addToIpfsJs = (ipfs, data) => {
      return ipfs.files.add(new Buffer(data))
        .then((result) => {
          return {
            Hash: result[0].hash,
            isDirectory: false
          }
        })
    }

    const addToIpfsGo = (ipfs, filename, filePath) => {
      return ipfs.util.addFromFs(filePath, { recursive: true })
        .then((result) => {
          // last added hash is the filename --> we added a directory
          // first added hash is the filename --> we added a file
          const isDirectory = result[0].path.split('/').pop() !== filename
          return {
            Hash: isDirectory ? result[result.length - 1].hash : result[0].hash,
            isDirectory: isDirectory
          }
        })
    }

    logger.info("Adding file from path '" + source.filename + "'")

    const isBuffer = (source.buffer && source.filename)
    const name = source.directory 
      ? source.directory.split("/").pop() 
      : source.filename.split("/").pop()
    const size = (source.meta && source.meta.size) ? source.meta.size : 0

    let feed, addToIpfs

    if(isBuffer) // Adding from browsers
      addToIpfs = () => addToIpfsJs(this._ipfs, source.buffer)
    else if(source.directory) // Adding from Electron
      addToIpfs = () => addToIpfsGo(this._ipfs, name, source.directory)
    else
      addToIpfs = () => addToIpfsGo(this._ipfs, name, source.filename)

    let userProfile

    return this._getChannelFeed(channel)
      .then((res) => feed = res)
      .then(() => this.getUser(this.user.id))
      .then((user) => userProfile = user)
      .then(() => addToIpfs())
      .then((result) => {
        logger.info("Added file '" + source.filename + "' as ", result)
        // Create a post
        const type = result.isDirectory ? Post.Types.Directory : Post.Types.File
        const data = {
          name: name,
          hash: result.Hash,
          size: size,
          from: userProfile,
          meta: source.meta || {}
        }
        return this._postMessage(feed, type, data, this._user._keys)
      })
  }

  getFile(hash) {
    if (this._ipfs.cat)
      return this._ipfs.cat(hash)

    return this._ipfs.files.cat(hash)
  }

  getDirectory(hash) {
    return this._ipfs.ls(hash).then((res) => res.Objects[0].Links)
  }

  getUser(hash) {
    const user = this._cache.get(hash)
    if (user) {
      return Promise.resolve(user)
    } else {
      return this._ipfs.object.get(hash, { enc: 'base58' })
        .then((res) => {
          const profileData = Object.assign(JSON.parse(res.toJSON().data))
          Object.assign(profileData, { id: hash })
          return IdentityProviders.loadProfile(this._ipfs, profileData)
            .then((profile) => {
              Object.assign(profile || profileData, { id: hash })
              this._cache.set(hash, profile)
              return profile
            })
            .catch((e) => {
              logger.error(e)
              return profileData
            })
        })
    }
  }

  loadMoreHistory(channel, amount, fromEntries) {
    if (fromEntries) {
      return this._getChannelFeed(channel)
        .then((feed) => feed.loadMoreFrom(amount, fromEntries))
        .catch((err) => console.error(err))      
    } else {
      return this._getChannelFeed(channel)
        .then((feed) => feed.loadMore(amount))
        .catch((err) => console.error(err))
    }
  }

  /* Private methods */

  _postMessage(feed, postType, data, signKey) {
    let post
    return Post.create(this._ipfs, postType, data, signKey)
      .then((res) => post = res)
      // .then(() => feed.add(post.Hash))
      .then(() => feed.add(JSON.stringify(post)))
      .then(() => post)
  }

  _getChannelFeed(channel) {
    if(!channel || channel === '')
      return Promise.reject(`Channel not specified`)

    return new Promise((resolve, reject) => {
      const feed = this._channels[channel] && this._channels[channel].feed ? this._channels[channel].feed : null
      if(!feed) reject(`Haven't joined #${channel}`)
      resolve(feed)
    })
  }

  // TODO: tests for everything below
  _handleMessage(channel, logHash, message) {
    logger.debug("New message in #", channel, "\n" + JSON.stringify(message, null, 2))
    const value = JSON.parse(message.payload.value)
    value.Post.hash = value.Hash
    let obj = Object.assign({}, message)
    obj = Object.assign(obj, { payload: { value: value } })
    this.events.emit('message', channel, obj.payload.value.Post)

    // this.getPost(message.payload.value, true)
    //   .then((post) => {
    //     // post.hash = post.hash || message.payload.value
    //     this.events.emit('message', channel, post)
    //   })
    //   .catch((err) => logger.error(err))
  }

  _handleNewMessages(channel, logHash) {
    if(this._channels[channel]) {
      this.events.emit('synced', channel)
    }
  }

  _startPollingForPeers() {
    if(!this._pollPeersTimer) {
      this._pollPeersTimer = setInterval(() => {
        this._updateSwarmPeers()
          .then((peers) => {
            this._peers = peers || []
            // TODO: get unique (new) peers and emit 'peer' for each instead of all at once
            this.events.emit('peers', this._peers)
          })
          .catch((e) => console.error(e))
      }, 3000)
    }
  }

  _updateSwarmPeers() {
    return new Promise((resolve, reject) => {
      this._ipfs.swarm.peers((err, res) => {
        if(err) reject(err)
        resolve(res)
      })
    })
    .then((peers) => Object.keys(peers).map((e) => peers[e].addr.toString()))
    .catch((e) => logger.error(e))
  }

}

module.exports = Orbit
