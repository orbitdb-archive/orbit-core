'use strict'

const fs = require('fs')
const rmrf = require('rimraf')
const path = require('path')
const assert = require('assert')
const mapSeries = require('../src/promise-map-series')
const Post = require('ipfs-post')
const IpfsNodeDaemon = require('ipfs-daemon/src/ipfs-node-daemon')
const IpfsNativeDaemon = require('ipfs-daemon/src/ipfs-native-daemon')
const Orbit = require('../src/Orbit')

// Mute logging
require('logplease').setLogLevel('NONE')

// Init storage for saving test keys
const keystorePath = path.join(process.cwd(), '/test/keys')

// Settings for the test ipfs daemons
const daemons = require('./daemons.conf.js')

// Default ipfs-daemon IPFS repo directory
const defaultIpfsDirectory = './ipfs'

// Orbit
const defaultOrbitDirectory = path.join('./', '/orbit')
const username = 'testrunner'
let userId = 'QmXWWRTZzygRCnWP8sBcTuygreYBTaQR73zVpZvyxeuUqA'

const hasIpfsApiWithPubsub = (ipfs) => {
  return ipfs.object.get !== undefined
      && ipfs.object.put !== undefined
      && ipfs.pubsub.publish !== undefined
      && ipfs.pubsub.subscribe !== undefined
}

let ipfs, ipfsDaemon, isJsIpfs

// [IpfsNodeDaemon].forEach((IpfsDaemon) => {
// [IpfsNativeDaemon].forEach((IpfsDaemon) => {
// [IpfsNativeDaemon, IpfsNodeDaemon].forEach((IpfsDaemon) => {
[IpfsNodeDaemon, IpfsNativeDaemon].forEach((IpfsDaemon) => {

  describe('Orbit', function() {
    this.timeout(60000)

    let orbit
    let channel = 'orbit-tests'

    before(function (done) {
      rmrf.sync(defaultOrbitDirectory)
      rmrf.sync(daemons.daemon1.IpfsDataDir)
      ipfs = new IpfsDaemon(daemons.daemon1)
      ipfs.on('error', done)
      ipfs.on('ready', () => {
        isJsIpfs = ipfs.constructor.name !== 'IpfsNativeDaemon'
        assert.equal(hasIpfsApiWithPubsub(ipfs), true)
        done()
      })
    })

    beforeEach(function (done) {
      rmrf.sync('./orbit-db')
      if(orbit) orbit.disconnect()
      orbit = new Orbit(ipfs, { 
        keystorePath: keystorePath, 
        cachePath: './orbit' 
      })
      done()
    })

    after((done) => {
      if(orbit) orbit.disconnect()
      orbit = null
      ipfs.stop()
      rmrf.sync(daemons.daemon1.IpfsDataDir)
      rmrf.sync(defaultOrbitDirectory)
      done()
    })

    describe('constructor', function() {
      it('creates an instance', () => {
        assert.notEqual(orbit, null)
        assert.notEqual(orbit._ipfs, null)
        assert.equal(orbit._orbitdb, null)
        assert.equal(orbit._options.maxHistory, 64)
        assert.notEqual(orbit._options.cachePath, null)
        assert.equal(Object.keys(orbit._channels).length, 0)
      })

      it('creates an instance with options', () => {
        const orbitNoCache = new Orbit(ipfs, { cachePath: null, maxHistory: 0, keystorePath: keystorePath })
        assert.equal(orbitNoCache._orbitdb, null)
        assert.equal(orbitNoCache._options.maxHistory, 0)
        assert.equal(orbitNoCache._options.cachePath, null)
      })
    })

    describe('connect', function() {
      it('connects to a network', (done) => {
        orbit.connect(username)
          .then((res) => {
            assert.notEqual(orbit._orbitdb, null)
            // assert.equal(orbit._orbitdb.events.listenerCount('data'), 1)
            orbit.disconnect()
            done()
          })
          .catch(done)
      })

      it('emits \'connected\' event when connected to a network', (done) => {
        orbit.events.on('connected', (networkInfo, user) => {
          assert.notEqual(networkInfo, null)
          assert.notEqual(user, null)
          assert.equal(networkInfo.name, 'Orbit DEV Network')
          assert.equal(user.name, username)
          assert.equal(user.id, userId)
          done()
        })
        orbit.connect(username)
      })

      it('user is defined when connected', (done) => {
        orbit.connect(username)
          .then((res) => {
            assert.notEqual(orbit.user, null)
            assert.equal(orbit.user.id, userId)
            assert.equal(orbit.user.name, username)
            assert.notEqual(orbit.user.signKey, null)
            orbit.disconnect()
            done()
          })
          .catch(done)
      })
    })

    describe('disconnect', function() {
      it('disconnects from a network', (done) => {
        orbit.connect(username)
          .then((res) => {
            orbit.disconnect()
            assert.equal(orbit.orbitdb, null)
            assert.equal(orbit.user, null)
            assert.equal(Object.keys(orbit._channels).length, 0)
            done()
          })
          .catch(done)
      })

      it('emits \'disconnected\' event when disconnected from a network', (done) => {
        orbit.connect(username)
          .then(() => {
            orbit.events.on('disconnected', (networkInfo, userInfo) => {
              assert.equal(orbit.network, null)
              assert.equal(orbit.user, null)
              done()
            })
          })
          .then(() => orbit.disconnect())
          .catch(done)
      })
    })

    describe('join', function() {
      beforeEach((done) => {
        orbit.connect(username)
          .then((res) => done())
          .catch(done)
      })

      afterEach(() => {
        orbit.disconnect()
      })

      it('joins a new channel', () => {
        return orbit.join(channel).then((result) => {
          const c = orbit.channels[channel]
          assert.equal(result, true)
          assert.notEqual(c, null)
          assert.equal(Object.keys(orbit.channels).length, 1)
          assert.equal(c.name, channel)
          assert.equal(c.password, null)
          assert.notEqual(c.feed, null)
        })
      })

      it('joins an existing channel', () => {
        return orbit.join(channel)
          .then(() => orbit.join(channel))
          .then((result) => {
            const c = orbit.channels[channel]
            assert.equal(result, false)
            assert.equal(Object.keys(orbit.channels).length, 1)
            assert.equal(c.name, channel)
            assert.equal(c.password, null)
            assert.notEqual(c.feed, null)
          })
      })

      it('joins another new channel', () => {
        const channel2 = 'test2'
        return orbit.join(channel)
          .then(() => orbit.join(channel2))
          .then((result) => {
            const c1 = orbit.channels[channel]
            const c2 = orbit.channels[channel2]
            assert.equal(result, true)
            assert.equal(Object.keys(orbit.channels).length, 2)
            assert.equal(c1.name, channel)
            assert.equal(c1.password, null)
            assert.notEqual(c1.feed, null)
            assert.equal(c2.name, channel2)
            assert.equal(c2.password, null)
            assert.notEqual(c2.feed, null)
          })
      })

      it('returns \'true\' when a new channel was joined', () => {
        return orbit.join(channel).then((result) => {
          assert.equal(result, true)
        })
      })

      it('returns \'false\' when an excisting channel was joined', () => {
        return orbit.join(channel)
          .then(() => orbit.join(channel))
          .then((result) => {
            assert.equal(result, false)
          })
      })

      it('emits \'joined\' event after joining a new channel', (done) => {
        orbit.events.once('joined', (channelName) => {
          const c = orbit.channels[channel]
          assert.notEqual(channel, null)
          assert.equal(channel, c.name)
          assert.equal(channelName, c.name)
          assert.equal(Object.keys(orbit.channels).length, 1)
          assert.equal(c.name, channel)
          assert.equal(c.password, null)
          assert.notEqual(c.feed, null)
          done()
        })
        orbit.join(channel).catch(done)
      })

      it('doesn\'t emit \'joined\' event after joining an existing channel', (done) => {
        orbit.join(channel).then(() => {
          setTimeout(() => done(), 1000)
          orbit.events.on('joined', () => done(new Error("'joined' event was emitted")))
          orbit.join(channel)
        }).catch(done)
      })

      it('throws an error when channel is not specified', (done) => {
        orbit.join()
          .then((post) => done(new Error("Channel was not specified!")))
          .catch((e) => {
            assert.equal(e.toString(), `Channel not specified`)
            done()
          })
      })
    })

    describe('leave', function() {
      beforeEach((done) => {
        orbit.connect(username)
          .then((res) => done())
          .catch(done)
      })

      it('leaves a channel', (done) => {
        orbit.join(channel).then(() => {
          orbit.leave(channel)
          const channels = orbit.channels
          assert.equal(Object.keys(channels).length, 0)
          assert.equal(channels[channel], null)
          done()
        })
      })

      it('emits \'left\' event after leaving channel', (done) => {
        orbit.join(channel).then(() => {
          orbit.events.on('left', (channelName) => {
            assert.equal(channelName, channel)
            assert.equal(Object.keys(orbit.channels).length, 0)
            done()
          })
          orbit.leave(channel)
        })
      })

      it('emits \'left\' event after calling leave if channels hasn\'t been joined', (done) => {
        orbit.events.on('left', (channelName) => {
          assert.equal(channelName, channel)
            assert.equal(Object.keys(orbit.channels).length, 0)
          done()
        })
        orbit.leave(channel)
      })
    })

    describe('getters', function() {

      describe('defaults', function() {
        it('no users', () => {
          assert.equal(orbit.user, null)
        })
        it('no network', () => {
          assert.equal(orbit.network, null)
        })
        it('no channels', () => {
          assert.equal(Object.keys(orbit.channels).length, 0)
        })
        it('no peers', () => {
          assert.equal(orbit.peers.length, 0)
        })
      })

      describe('return', function() {
        beforeEach((done) => {
          orbit.connect(username)
            .then((res) => done())
            .catch(done)
        })

        afterEach(() => {
          orbit.disconnect()
        })

        it('user', () => {
          assert.notEqual(orbit.user, null)
          assert.equal(orbit.user.name, username)
          assert.equal(orbit.user.id, userId)
        })

        it('network', () => {
          assert.notEqual(orbit.network, null)
          assert.equal(orbit.network.name, 'Orbit DEV Network')
        })

        it.skip('peers', () => {
          // TODO
        })

        describe('channels', function() {
          it('returns a joined channel', (done) => {
            orbit.join(channel).then(() => {
              assert.equal(Object.keys(orbit.channels).length, 1)
              assert.equal(orbit.channels[channel].name, channel)
              done()
            })
          })

          it('returns the channels in correct format', (done) => {
            const channel2 = 'test2'
            orbit.join(channel2).then(() => {
              orbit.join(channel).then(() => {
                const c = orbit.channels[channel]
                assert.equal(Object.keys(orbit.channels).length, 2)
                assert.equal(c.name, channel)
                assert.equal(c.password, null)
                // assert.equal(Object.prototype.isPrototypeOf(c.feed, EventStore), true)
                done()
              })
            })
          })
        })
      })
    })

    describe('send', function() {
      beforeEach((done) => {
        orbit = new Orbit(ipfs, { keystorePath: keystorePath, maxHistory: 0 })
        orbit.connect(username)
          .then((res) => done())
          .catch(done)
      })

      afterEach(() => {
        orbit.disconnect()
      })

      it('sends a message to a channel', (done) => {
        const content = 'hello1'
        let message
        orbit.join(channel, 0)
          .then(() => orbit.send(channel, content))
          .then((res) => message = res)
          .then(() => orbit.get(channel))
          .then((messages) => {
            assert.equal(messages.length, 1)
            assert.notEqual(messages[0].Hash, undefined)
            assert.equal(messages[0].Hash.startsWith('Qm'), true)
            assert.equal(messages[0].Post.content, content)
            assert.equal(messages[0].Post.content, message.Post.content)
            assert.notEqual(messages[0].Post.sig, null)
            assert.notEqual(messages[0].Post.signKey, null)
            assert.notEqual(messages[0].Post.meta, null)
            assert.equal(messages[0].Post.meta.ts, message.Post.meta.ts)
            assert.equal(messages[0].Post.meta.from.id, message.Post.meta.from.id)
            done()
          })
          .catch(done)
      })

      it('returns a Post', (done) => {
        const content = 'hello' + new Date().getTime()
        orbit.join(channel)
          .then(() => orbit.send(channel, content))
          .then((message) => {
            assert.notEqual(message.Post, null)
            assert.equal(message.Hash.startsWith('Qm'), true)
            assert.equal(message.Post.content, content)
            assert.equal(Object.keys(message.Post.meta).length, 4)
            assert.equal(message.Post.meta.type, "text")
            assert.equal(message.Post.meta.size, 15)
            assert.equal(message.Post.meta.from.id, userId)
            assert.notEqual(message.Post.meta.ts, null)
            done()
          })
          .catch(done)
      })

      it('Post was added to IPFS', (done) => {
        const content = 'hello' + new Date().getTime()
        orbit.join(channel)
          .then(() => orbit.send(channel, content))
          .then((data) => {
            assert.equal(data.Post.content, content)
            assert.equal(data.Post.meta.type, "text")
            assert.equal(data.Post.meta.size, 15)
            assert.notEqual(data.Post.meta.ts, null)
            assert.equal(data.Post.meta.from.id, userId)
            done()
          })
          .catch(done)
      })

      it('throws an error when channel is not specified', (done) => {
        orbit.join(channel)
          .then(() => orbit.send(null, 'hello'))
          .then((post) => done(new Error("Channel was not specified!")))
          .catch((e) => {
            assert.equal(e.toString(), `Channel not specified`)
            done()
          })
      })

      it('throws an error when trying to send a message to channel that hasn\'t been joined', (done) => {
        const channel = 'test1'
        const content = 'hello1'
        orbit.send(channel, content)
          .then((post) => done(new Error(`Not joined on #${channel} but the message was sent!`)))
          .catch((e) => {
            assert.equal(e.toString(), `Haven't joined #${channel}`)
            done()
          })
      })

      it('throws an error when trying to send an empty message', (done) => {
        const content = ''
        orbit.join(channel)
          .then(() => orbit.send(channel, content))
          .then((post) => done(new Error("Empty message was sent!")))
          .catch((e) => {
            assert.equal(e.toString(), `Can't send an empty message`)
            done()
          })
      })

      it('throws an error when message is not specified', (done) => {
        orbit.join(channel, null)
          .then(() => orbit.send(channel))
          .then((post) => done(new Error("Empty message was sent!")))
          .catch((e) => {
            assert.equal(e.toString(), `Can't send an empty message`)
            done()
          })
      })
    })

    describe('get', function() {
      it('returns the latest message', (done) => {
        const ts = new Date().getTime()
        const content = 'hi' + ts
        let message
        const orbitNoCache = new Orbit(ipfs, { cachePath: null, maxHistory: 0, keystorePath: keystorePath })
        orbitNoCache.connect(username)
          .then(() => orbitNoCache.join(channel))
          .then(() => orbitNoCache.send(channel, content))
          .then((res) => message = res)
          .then(() => orbitNoCache.get(channel, null, null, 10))
          .then((messages) => {
            assert.equal(messages.length, 1)
            assert.notEqual(messages[0].Hash, null)
            assert.equal(messages[0].Hash.startsWith('Qm'), true)
            assert.equal(messages[0].Post.content, content)
            assert.equal(messages[0].Post.content, message.Post.content)
            assert.notEqual(messages[0].Post.sig, null)
            assert.notEqual(messages[0].Post.signKey, null)
            assert.notEqual(messages[0].Post.meta, null)
            assert.equal(messages[0].Post.meta.ts, message.Post.meta.ts)
            assert.equal(messages[0].Post.meta.from.id, message.Post.meta.from.id)
            // assert.equal(messages[0].payload.op, 'ADD')
            // assert.equal(messages[0].payload.value, message.Hash)
            // assert.notEqual(messages[0].payload.meta, null)
            // assert.notEqual(messages[0].payload.meta.ts, null)
            // assert.equal(messages[0].hash.startsWith('Qm'), true)
            // assert.equal(messages[0].next.length, 0)
            // orbitNoCache.disconnect()
            done()
          })
          .catch(done)
      })

      it('returns all messages in the right order', (done) => {
        const orbitNoCache = new Orbit(ipfs, { cachePath: null, maxHistory: 0, keystorePath: keystorePath })
        const content = 'hello'
        const channel2 = 'channel-' + new Date().getTime()
        let result

        orbitNoCache.connect(username)
          .then(() => orbitNoCache.join(channel2))
          .then(() => {
            return mapSeries([1, 2, 3, 4, 5], (i) => orbitNoCache.send(channel2, content + i), { concurrency: 1 })
          })
          .then((res) => result = res)
          .then(() => orbitNoCache.get(channel2, null, null, -1))
          .then((messages) => {
            assert.equal(messages.length, 5)
            messages.forEach((msg, index) => {
              assert.notEqual(msg.Hash, null)
              assert.equal(msg.Hash.startsWith('Qm'), true)
              assert.equal(msg.Post.content, content + (index + 1))
              assert.notEqual(msg.Post.sig, null)
              assert.notEqual(msg.Post.signKey, null)
              assert.notEqual(msg.Post.meta, null)
              orbitNoCache.disconnect()
            })
            done()
          })
          .catch(done)
      })

      it('throws an error if trying to get from a channel that hasn\'t been joined', (done) => {
        const orbitNoCache = new Orbit(ipfs, { cachePath: null, maxHistory: 0, keystorePath: keystorePath })
        orbitNoCache.connect(username)
          .then(() => orbitNoCache.get(channel))
          .then((res) => done(new Error("Got result but not joined on channel!")))
          .catch((e) => {
            assert.equal(e, `Haven't joined #${channel}`)
            orbitNoCache.disconnect()
            done()
          })
      })
    })

    describe('addFile', function() {
      beforeEach((done) => {
        orbit.connect(username)
          .then(() => done())
          .catch(done)
      })

      afterEach(() => {
        orbit.disconnect()
      })

      it('adds a file', (done) => {
        const filename = 'mocha.opts'
        const filePath = path.join(process.cwd(), '/test' , filename)

        const file = isJsIpfs
          ? { filename: filename, buffer: Buffer(fs.readFileSync(filePath)) }
          : { filename: filePath }

        orbit.join(channel)
          .then(() => orbit.addFile(channel, file))
          .then((res) => {
            assert.notEqual(res.Post, null)
            assert.equal(res.Post instanceof Post.Types.File, true)
            assert.equal(res.Hash.startsWith('Qm'), true)
            assert.equal(res.Post.name, filename)
            assert.equal(res.Post.size, -1)
            assert.equal(Object.keys(res.Post.meta).length, 4)
            assert.equal(res.Post.meta.size, 15)
            assert.equal(res.Post.meta.from.id, userId)
            assert.notEqual(res.Post.meta.ts, null)
            done()
          })
          .catch(done)
      })

      it('adds a directory recursively', (done) => {
        // skip if js-ipfs
        if (isJsIpfs)
          return done()

        const directory = 'test'
        const p = path.join(process.cwd(), directory)
        const dir = { filename: directory, directory: p }

        orbit.join(channel)
          .then(() => orbit.addFile(channel, dir))
          .then((res) => {
            assert.notEqual(res.Post, null)
            assert.equal(res.Post instanceof Post.Types.Directory, true)
            assert.equal(res.Hash.startsWith('Qm'), true)
            assert.equal(res.Post.name, directory)
            // assert.equal(res.Post.size === 409363 || res.Post.size === 409449, true)
            assert.equal(Object.keys(res.Post.meta).length, 4)
            // assert.equal(res.Post.meta.size === 409363 || res.Post.meta.size === 409449, true)
            assert.equal(res.Post.meta.from.id, userId)
            assert.notEqual(res.Post.meta.ts, null)
            done()
          })
          .catch(done)
      })

      it('throws an error if file not found', (done) => {
        // skip if js-ipfs
        if (isJsIpfs)
          return done()

        const filename = 'non-existent'
        const filePath = path.join(process.cwd(), '/test' , filename)
        orbit.join(channel)
          .then(() => orbit.addFile(channel, { filename: filePath }))
          .catch((e) => {
            assert.equal(e.message.toString(), `ENOENT: no such file or directory, stat '${filePath}'`)
            done()
          })
      })


      it('throws an error if channel parameter is not given', (done) => {
        orbit.join(channel)
          .then(() => orbit.addFile(null, { filename: 'empty' }))
          .catch((e) => {
            assert.equal(e, "Channel not specified")
            done()
          })
      })

      it('throws an error if neither filename or directory parameter is not given', (done) => {
        orbit.join(channel)
          .then(() => orbit.addFile(channel, null))
          .catch((e) => {
            assert.equal(e, "Filename or directory not specified")
            done()
          })
      })

      it('throws an error if not joined on channel', (done) => {
        orbit.addFile(channel, { filename: 'hello' })
          .catch((e) => {
            assert.equal(e, `Haven't joined #${channel}`)
            done()
          })
      })
    })

    describe('getFile', function() {
      const filename = 'mocha.opts'
      const filePath = path.join(process.cwd(), '/test' , filename)
      let hash

      beforeEach((done) => {
        const file = isJsIpfs
          ? { filename: filename, buffer: Buffer(fs.readFileSync(filePath)) }
          : { filename: filePath }

        orbit.connect(username)
          .then(() => orbit.join(channel))
          .then(() => orbit.addFile(channel, file))
          .then((res) => hash = res.Post.hash)
          .then(() => done())
          .catch(done)
      })

      afterEach(() => {
        orbit.disconnect()
      })

      it('returns the contents of a file', (done) => {
        orbit.getFile(hash)
          .then((res) => {
            let data = ''
            res.on('data', (chunk) => data += chunk)
            res.on('end', () => {
              const contents = fs.readFileSync(filePath)
              assert.equal(data, contents.toString())
              done()
            })
          })
          .catch(done)
      })
    })

    describe('getDirectory', function() {
      const directory = 'test'
      const filePath = path.join(process.cwd(), directory)
      let hash

      beforeEach((done) => {
        // skip with js-ipfs
        if (isJsIpfs)
          return done()

        orbit.connect(username)
          .then(() => orbit.join(channel))
          .then(() => orbit.addFile(channel, { filename: "test directory", directory: filePath }))
          .then((res) => hash = res.Post.hash)
          .then(() => done())
          .catch(done)
      })

      afterEach(() => {
        orbit.disconnect()
      })

      it('returns a directory', (done) => {
        // skip with js-ipfs
        if (isJsIpfs)
          return done()

        orbit.getDirectory(hash)
          .then((res) => {
            assert.notEqual(res, null)
            assert.equal(res.length, 4)
            assert.equal(Object.keys(res[0]).length, 4)
            done()
          })
          .catch(done)
      })
    })

    describe('events', function() {
      beforeEach((done) => {
        orbit.events.on('joined', () => done())
        orbit.connect(username)
          .then(() => orbit.join(channel + '.events'))
          .catch(done)
      })

      afterEach(() => {
        orbit.disconnect()
      })

      it('emits \'message\'', (done) => {
        orbit.events.on('message', (channelName, message) => {
          assert.equal(channelName, channel + '.events')
          assert.notEqual(message, undefined)
          assert.equal(message.content, 'hello')
          assert.equal(message.hash.startsWith('Qm'), true)
          done()
        })
        orbit.send(channel + '.events', 'hello')
      })
    })

  })

})
