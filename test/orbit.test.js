/* eslint-disable compat/compat */
'use strict'

const fs = require('fs')
const rmrf = require('rimraf')
const path = require('path')
const mapSeries = require('p-map-series')
const IPFS = require('ipfs')
const Orbit = require('../src/Orbit')
const { expect } = require('chai')

// Mute logging
require('logplease').setLogLevel('NONE')

// Init storage for saving test keys
const keystorePath = path.join(process.cwd(), '/test/keys')

// Settings for the test ipfs daemons
const config = require('./daemons.conf.js')

// Orbit
const defaultOrbitDirectory = path.join('./', '/orbit')
const username = 'testrunner'
const username2 = 'runtester'

let ipfs, isJsIpfs

describe('Orbit', () => {
  let orbit, orbit2
  const channel = 'orbit-tests'

  before(done => {
    rmrf.sync(defaultOrbitDirectory)
    rmrf.sync(config.daemon1.repo)
    ipfs = new IPFS(config.daemon1)
    ipfs.on('error', console.log)
    ipfs.on('ready', () => done())
  })

  beforeEach(async () => {
    if (orbit) await orbit.disconnect()
    orbit = new Orbit(ipfs, {
      keystorePath: keystorePath,
      cachePath: './orbit/' + new Date().getTime().toString()
    })
  })

  after(async () => {
    if (orbit) await orbit.disconnect()
    await ipfs.stop()
  })

  describe('constructor', () => {
    it('creates an instance', () => {
      expect(orbit).to.not.equal(null)
      expect(orbit._ipfs).to.not.equal(null)
      expect(orbit._orbitdb).to.equal(null)
      expect(orbit._options.maxHistory).to.equal(undefined)
      expect(orbit._options.cachePath).to.not.equal(null)
      expect(Object.keys(orbit._channels)).to.have.a.lengthOf(0)
    })

    it('creates an instance with options', () => {
      const orbitNoCache = new Orbit(ipfs, {
        cachePath: null,
        maxHistory: 0,
        keystorePath: keystorePath
      })
      expect(orbitNoCache._orbitdb).to.equal(null)
      expect(orbitNoCache._options.maxHistory).to.equal(0)
      expect(orbitNoCache._options.cachePath).to.equal(null)
    })
  })

  describe('connect', () => {
    it('connects to a network', async () => {
      await orbit.connect(username)
      expect(orbit._orbitdb).to.not.equal(null)
      await orbit.disconnect()
    })

    it("emits 'connected' event when connected to a network", async () => {
      orbit.events.on('connected', user => {
        expect(user.constructor.name).to.equal('OrbitUser')
        expect(user.profile.name).to.equal(username)
      })
      await orbit.connect(username)
    })

    it('user is defined when connected', async () => {
      await orbit.connect(username)
      expect(orbit._user).to.not.equal(null)
      expect(orbit._user.profile.name).to.equal(username)
      expect(orbit._user.identity._publicKey).to.not.equal(null)
      await orbit.disconnect()
    })
  })

  describe('disconnect', () => {
    it('disconnects from a network', async () => {
      await orbit.connect(username)
      await orbit.disconnect()
      expect(orbit._orbitdb).to.equal(null)
      expect(orbit._user).to.equal(null)
      expect(Object.keys(orbit._channels)).to.have.a.lengthOf(0)
    })

    it("emits 'disconnected' event when disconnected from a network", async () => {
      orbit.events.on('disconnected', () =>
        expect(Object.keys(orbit.events._events)[0]).to.equal('disconnected')
      )
      await orbit.connect(username)
      await orbit.disconnect()
    })
  })

  describe('join', () => {
    beforeEach(async () => {
      await orbit.connect(username)
    })

    afterEach(async () => {
      await orbit.disconnect()
    })

    it('joins a new channel', async () => {
      const joinedChannel = await orbit.join(channel)
      const c = orbit._getChannelFeed(channel)
      expect(joinedChannel.constructor.name).to.equal('Channel')
      expect(Object.keys(orbit.channels)).to.have.a.lengthOf(1)
      expect(c.dbname).to.equal(channel)
    })

    it('joins an existing channel', async () => {
      await orbit.join(channel)
      const joinedChannel = await orbit.join(channel)
      const c = orbit._getChannelFeed(channel)
      expect(joinedChannel.constructor.name).to.equal('Channel')
      expect(Object.keys(orbit.channels)).to.have.a.lengthOf(1)
      expect(c.dbname).to.equal(channel)
    })

    it('joins another new channel', async () => {
      const channel2 = 'test2'
      await orbit.join(channel)
      const joinedChannel = await orbit.join(channel2)
      const c1 = orbit._getChannelFeed(channel)
      const c2 = orbit._getChannelFeed(channel2)
      expect(joinedChannel.constructor.name).to.equal('Channel')
      expect(Object.keys(orbit.channels)).to.have.a.lengthOf(2)
      expect(c1.dbname).to.equal(channel)
      expect(c2.dbname).to.equal(channel2)
    })

    it('returns the channel when a new channel was joined', async () => {
      const joinedChannel = await orbit.join(channel)
      expect(joinedChannel.constructor.name).to.equal('Channel')
    })

    it('returns the channel when an existing channel was joined', async () => {
      await orbit.join(channel)
      const joinedChannel = await orbit.join(channel)
      expect(joinedChannel.constructor.name).to.equal('Channel')
    })

    it("emits 'joined' event after joining a new channel", done => {
      orbit.events.once('joined', () => done())
      orbit.join(channel)
    })

    it("doesn't emit 'joined' event after joining an existing channel", async () => {
      let eventFired = false
      await orbit.join(channel)
      orbit.events.on('joined', () => {
        eventFired = true
      })
      await orbit.join(channel)
      expect(eventFired).to.equal(false)
    })

    it('throws an error when channel is not specified', async () => {
      let error = false
      try {
        await orbit.join()
      } catch (e) {
        error = e.toString()
      }
      expect(error).to.equal('Error: Channel not specified')
    })
  })

  describe('leave', () => {
    beforeEach(async () => {
      await orbit.connect(username)
    })

    it('leaves a channel', async () => {
      await orbit.join(channel)
      await orbit.leave(channel)
      const channels = orbit.channels
      expect(Object.keys(channels)).to.have.a.lengthOf(0)
      expect(channels[channel]).to.equal(undefined)
    })

    it("emits 'left' event after leaving channel", async () => {
      await orbit.join(channel)
      orbit.events.on('left', channelName => {
        expect(channelName).to.equal(channel)
      })
      await orbit.leave(channel)
      expect(Object.keys(orbit.channels)).to.have.a.lengthOf(0)
    })

    it("emits 'left' event after calling leave if channels hasn't been joined", async () => {
      orbit.events.on('left', channelName => {
        expect(channelName).to.equal(channel)
      })
      await orbit.leave(channel)
      expect(Object.keys(orbit.channels)).to.have.a.lengthOf(0)
    })
  })

  describe('getters', () => {
    describe('defaults', () => {
      it('no users', () => {
        expect(orbit._user).to.equal(null)
      })
      it('no network', () => {
        expect(orbit._orbitdb).to.equal(null)
      })
      it('no channels', () => {
        expect(Object.keys(orbit._channels)).to.have.a.lengthOf(0)
      })
      it('no peers', () => {
        expect(orbit._peers).to.have.a.lengthOf(0)
      })
    })

    describe('return', () => {
      beforeEach(async () => {
        await orbit.connect(username)
      })

      afterEach(async () => {
        await orbit.disconnect()
      })

      it('user', () => {
        expect(orbit._user).to.not.equal(null)
        expect(orbit._user.profile.name).to.equal(username)
      })

      it('peers', () => {
        expect(orbit.peers).to.not.equal(null)
      })

      describe('channels', () => {
        it('returns a joined channel', async () => {
          await orbit.join(channel)
          expect(Object.keys(orbit.channels)).to.have.a.lengthOf(1)
          expect(orbit._getChannelFeed(channel).dbname).to.equal(channel)
        })

        it('returns the channels in correct format', async () => {
          const channel2 = 'test2'
          await orbit.join(channel2)
          await orbit.join(channel)
          const c = orbit._getChannelFeed(channel)
          expect(Object.keys(orbit.channels)).to.have.a.lengthOf(2)
          expect(c.dbname).to.equal(channel)
        })
      })
    })
  })

  describe('send', () => {
    beforeEach(async () => {
      orbit = new Orbit(ipfs, { keystorePath: keystorePath, maxHistory: 0 })
      await orbit.connect(username)
      orbit2 = new Orbit(ipfs, { keystorePath: keystorePath, maxHistory: 0 })
      await orbit2.connect(username2)
    })

    afterEach(async () => {
      await orbit.disconnect()
      await orbit2.disconnect()
    })

    it('sends a message to a channel', async () => {
      const content = 'hello1'
      await orbit.join(channel, 0)
      await orbit.send(channel, content)
      const feed = await orbit._getChannelFeed(channel)
      const firstKey = Object.keys(feed._oplog._entryIndex)[0]
      const firstEntry = feed._oplog._entryIndex[firstKey]
      expect(feed._oplog._length).to.equal(1)
      expect(firstKey.startsWith('zdpu'), true)
      expect(firstEntry.payload.value.content, content)
    })

    it('other user receives the sent message', async () => {
      const content = 'hello1'

      await orbit.join(channel, 0)
      await orbit2.join(channel, 0)
      await orbit.send(channel, content)

      const channel2 = orbit2.channels[channel]

      await new Promise((resolve, reject) => {
        channel2.on('load.done', () => {
          expect(Object.keys(channel2.feed._oplog._entryIndex)).to.have.a.lengthOf(1)
          resolve()
        })
        channel2.load(1)
      })
    })

    it('returns the oplog hash', async () => {
      const content = 'hello' + new Date().getTime()
      await orbit.join(channel)
      const oplogHash = await orbit.send(channel, content)
      expect(oplogHash.startsWith('zdpu')).to.equal(true)
    })

    it('throws an error when channel is not specified', async () => {
      let error = false
      await orbit.join(channel)
      try {
        await orbit.send(null, 'hello')
      } catch (e) {
        error = e.toString()
      }
      expect(error).to.equal('Error: Channel must be specified')
    })

    it("throws an error when trying to send a message to channel that hasn't been joined", async () => {
      const channel = 'test1'
      const content = 'hello1'
      let error = false
      try {
        await orbit.send(channel, content)
      } catch (e) {
        error = e.toString()
      }
      expect(error).to.equal("TypeError: Cannot read property 'feed' of undefined")
    })

    it('throws an error when trying to send an empty message', async () => {
      const content = ''
      let error = false
      await orbit.join(channel)
      try {
        await orbit.send(channel, content)
      } catch (e) {
        error = e.toString()
      }
      expect(error).to.equal("Error: Can't send an empty message")
    })

    it('throws an error when message is not specified', async () => {
      let error = false
      await orbit.join(channel)
      try {
        await orbit.send(channel)
      } catch (e) {
        error = e.toString()
      }
      expect(error).to.equal("Error: Can't send an empty message")
    })
  })

  describe('get', () => {
    before(() => {
      rmrf.sync(path.join(defaultOrbitDirectory, 'clean'))
    })

    it('returns the latest message', async () => {
      const ts = new Date().getTime()
      const content = 'hi' + ts

      const orbitNoCache = new Orbit(ipfs, {
        cachePath: path.join(defaultOrbitDirectory, 'clean'),
        maxHistory: 0,
        keystorePath: keystorePath
      })

      await orbitNoCache.connect(username)
      await orbitNoCache.join(channel)
      const sentEntryHash = await orbitNoCache.send(channel, content)

      const feed = orbitNoCache._getChannelFeed(channel)
      const sentEntry = feed._oplog._entryIndex[sentEntryHash]

      const firstKey = Object.keys(feed._oplog._entryIndex)[0]
      const firstEntry = feed._oplog._entryIndex[firstKey]

      expect(firstKey).to.equal(firstEntry.hash)
      expect(Object.keys(feed._oplog._entryIndex)).to.have.a.lengthOf(1)
      expect(firstKey.startsWith('zdpu')).to.equal(true)
      expect(firstEntry.payload.value.content).to.equal(content)
      expect(firstEntry.payload.value.content).to.equal(sentEntry.payload.value.content)
      expect(firstEntry.sig).to.not.equal(null)
      expect(firstEntry.key).to.not.equal(null)
    })

    it('returns all messages in the right order', async () => {
      const orbitNoCache = new Orbit(ipfs, {
        cachePath: null,
        maxHistory: 0,
        keystorePath: keystorePath
      })
      const content = 'hello'
      const channel2 = 'channel-' + new Date().getTime()

      await orbitNoCache.connect(username)
      await orbitNoCache.join(channel2)

      await mapSeries([1, 2, 3, 4, 5], i => orbitNoCache.send(channel2, content + i), {
        concurrency: 1
      })

      const feed = await orbitNoCache._getChannelFeed(channel2)

      expect(Object.keys(feed._oplog._entryIndex)).to.have.a.lengthOf(5)

      Object.values(feed._oplog._entryIndex).forEach((entry, index) => {
        expect(entry.hash).to.not.equal(null)
        expect(entry.hash.startsWith('zdpu')).to.equal(true)
        expect(entry.payload.value.content).to.equal(content + (index + 1))
        expect(entry.sig).to.not.equal(null)
        expect(entry.key).to.not.equal(null)
        expect(entry.payload.value.meta).to.not.equal(null)
      })

      await orbitNoCache.disconnect()
    })

    it('is able to load older messages', async () => {
      const orbitCached = new Orbit(ipfs, {
        cachePath: './orbit',
        maxHistory: 0,
        keystorePath: keystorePath
      })
      const content = 'hello'
      const channel2 = 'channel-' + new Date().getTime()

      await orbitCached.connect(username)
      await orbitCached.join(channel2)
      await mapSeries(
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
        i => orbitCached.send(channel2, content + i),
        {
          concurrency: 1
        }
      )
      await orbitCached.disconnect()

      await orbitCached.connect(username)
      await orbitCached.join(channel2)
      const channel = orbitCached.channels[channel2]

      let loadNum = 1

      await new Promise((resolve, reject) => {
        channel.on('load.done', () => {
          expect(Object.keys(channel.feed._oplog._entryIndex)).to.have.a.lengthOf(10 * loadNum)
          loadNum++
          resolve()
        })
        channel.load(10)
      })
      await channel.loadMore(10)
    })

    it("throws an error if trying to get from a channel that hasn't been joined", async () => {
      const orbitNoCache = new Orbit(ipfs, {
        cachePath: null,
        maxHistory: 0,
        keystorePath: keystorePath
      })
      let error = false

      await orbitNoCache.connect(username)

      try {
        await orbitNoCache._getChannelFeed(channel)
      } catch (e) {
        error = true
      }

      expect(error).to.equal(true)

      await orbitNoCache.disconnect()
    })
  })

  describe('addFile', () => {
    beforeEach(async () => {
      await orbit.connect(username)
    })

    afterEach(async () => {
      await orbit.disconnect()
    })

    it('adds a file', async () => {
      const filename = 'mocha.opts'
      const filePath = path.join(process.cwd(), '/test', filename)
      const fileStats = fs.statSync(filePath)
      const fileBuffer = Buffer.from(fs.readFileSync(filePath))
      const file = {
        filename: filename,
        buffer: fileBuffer,
        meta: { mimeType: fileStats.type, size: fileStats.size }
      }

      await orbit.join(channel)
      const entryHash = await orbit.addFile(channel, file)
      const feed = orbit._getChannelFeed(channel)
      const entry = feed._oplog._entryIndex[entryHash]

      expect(entry.payload.value.meta.type).to.equal('file')
      expect(entryHash.startsWith('zdpu')).to.equal(true)
      expect(entry.payload.value.meta.name).to.equal(filename)
      expect(Object.keys(entry.payload.value.meta)).to.have.a.lengthOf(6)
      expect(entry.payload.value.meta.size).to.equal(fileStats.size)
      expect(entry.payload.value.meta.ts).to.not.equal(null)
    })

    it('throws an error if channel parameter is not given', async () => {
      let error = false
      await orbit.join(channel)
      try {
        await orbit.addFile(null, { filename: 'empty' })
      } catch (e) {
        error = e.message.toString()
      }
      expect(error).to.equal('Channel not specified')
    })

    it('throws an error if neither filename or directory parameter is not given', async () => {
      let error = false
      await orbit.join(channel)
      try {
        await orbit.addFile(channel, null)
      } catch (e) {
        error = e.message.toString()
      }
      expect(error).to.equal('Filename or directory not specified')
    })

    it('throws an error if not joined on channel', async () => {
      let error = false
      try {
        await orbit.addFile(channel, { filename: 'hello' })
      } catch (e) {
        error = e.message.toString()
      }
      expect(error).to.equal("Cannot read property 'feed' of undefined")
    })
  })

  describe('getFile', () => {
    const filename = 'mocha.opts'
    const filePath = path.join(process.cwd(), '/test', filename)
    let hash

    beforeEach(async () => {
      const fileStats = fs.statSync(filePath)
      const file = {
        filename: filename,
        buffer: Buffer.from(fs.readFileSync(filePath)),
        meta: { mimeType: fileStats.type, size: fileStats.size }
      }
      await orbit.connect(username)
      await orbit.join(channel)
      hash = await orbit.addFile(channel, file)
    })

    afterEach(async () => {
      await orbit.disconnect()
    })

    it('returns the contents of a file', async () => {
      const res = await orbit.getFile(hash)
      let data = ''
      let buffer = new Uint8Array(0)
      res.on('error', () => {})
      res.on('data', chunk => {
        const tmp = new Uint8Array(buffer.length + chunk.length)
        tmp.set(buffer)
        tmp.set(chunk, buffer.length)
        buffer = tmp
        console.log(buffer)
        data += chunk
      })
      res.on('end', () => {
        const contents = fs.readFileSync(filePath)
        expect(data).to.equal(contents.toString())
      })
    })
  })

  describe('events', () => {
    beforeEach(async () => {
      await orbit.connect(username)
      await orbit.join(channel + '.events')
    })

    afterEach(async () => {
      await orbit.disconnect()
    })

    it("emits 'message'", async () => {
      orbit.events.on('message', (channelName, message) => {
        expect(channelName).to.equal(channel + '.events')
        expect(message).to.not.equal(undefined)
        expect(message.content).to.equal('hello')
        expect(message.hash.startsWith('Qm')).to.equal(true)
      })
      await orbit.send(channel + '.events', 'hello')
    })
  })
})
