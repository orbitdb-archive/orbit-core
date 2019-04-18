'use strict'

const rmrf = require('rimraf')
const path = require('path')
const assert = require('assert')
const IPFS = require('ipfs')
const Orbit = require('../src/Orbit')

// Mute logging
require('logplease').setLogLevel('NONE')

// Init storage for saving test keys
const keystorePath = path.join(process.cwd(), '/test/keys')

// Settings for the test ipfs daemons
const config = require('./daemons.conf.js')

// Orbit
const defaultOrbitDirectory = path.join('./', '/orbit')
const username1 = 'testrunner1'
const username2 = 'testrunner2'
const userId1 = 'QmXWWRTZzygRCnWP8sBcTuygreYBTaQR73zVpZvyxeuUqA'
const userId2 = 'QmXWWRTZzygRCnWP8sBcTuygreYBTaQR73zVpZvyxeuUqB'

const hasIpfsApiWithPubsub = ipfs => {
  return (
    ipfs.object.get !== undefined &&
    ipfs.object.put !== undefined &&
    ipfs.pubsub.publish !== undefined &&
    ipfs.pubsub.subscribe !== undefined
  )
}

const waitForPeers = (ipfs, channel) => {
  return new Promise((resolve, reject) => {
    console.log(`Waiting for peers on #${channel.name}...`)
    const interval = setInterval(() => {
      ipfs.pubsub
        .peers(channel.feed.path)
        .then(peers => {
          if (peers.length > 0) {
            console.log('Found peers, running tests...')
            clearInterval(interval)
            resolve()
          }
        })
        .catch(e => {
          clearInterval(interval)
          reject(e)
        })
    }, 1000)
  })
}

let ipfs1, ipfs2

describe.skip('Orbit- History', function () {
  this.timeout(40000)

  let orbit1, orbit2
  const channel = 'orbit-tests'

  before(function (done) {
    rmrf.sync(defaultOrbitDirectory)
    rmrf.sync(config.daemon1.repo)
    rmrf.sync(config.daemon2.repo)
    ipfs1 = new IPFS(config.daemon1)
    ipfs1.on('error', done)
    ipfs1.on('ready', () => {
      assert.strict.equal(hasIpfsApiWithPubsub(ipfs1), true)
      ipfs2 = new IPFS(config.daemon2)
      ipfs2.on('error', done)
      ipfs2.on('ready', () => {
        assert.strict.equal(hasIpfsApiWithPubsub(ipfs2), true)
        done()
      })
    })
  })

  after(done => {
    if (orbit1) orbit1.disconnect()
    if (orbit2) orbit2.disconnect()
    orbit1 = null
    orbit2 = null
    ipfs1.stop()
    ipfs2.stop()
    rmrf.sync(config.daemon1.repo)
    rmrf.sync(config.daemon2.repo)
    rmrf.sync(defaultOrbitDirectory)
    done()
  })

  describe('send', function () {
    beforeEach(done => {
      orbit1 = new Orbit(ipfs1, {
        keystorePath: path.join(keystorePath, 'daemon1'),
        cachePath: './orbit1'
      })

      orbit2 = new Orbit(ipfs2, {
        keystorePath: path.join(keystorePath, 'daemon2'),
        cachePath: './orbit2'
      })

      Promise.all([orbit1.connect(username1), orbit2.connect(username2)])
        .then(res => done())
        .catch(done)
    })

    afterEach(() => {
      if (orbit1) orbit1.disconnect()
      if (orbit2) orbit2.disconnect()
    })

    it('loads history', done => {
      const content = 'hello1'
      let message
      let c

      Promise.all([orbit1.join(channel), orbit2.join(channel)])
        .then(() => (c = orbit1.getChannel(channel)))
        .then(() => waitForPeers(ipfs1, c))
        .then(() => waitForPeers(ipfs2, c))
        .then(() => orbit1.send(channel, content))
        .then(m => (message = m))
        .then(() => new Promise(resolve => setTimeout(resolve, 200)))
        .then(() => {
          return orbit2.get(channel)
        })
        .then(messages => {
          console.log('3')
          console.log(message)
          console.log('---')
          console.log(messages)
          console.log('>', orbit1.user)
          console.log('>', orbit2.user)
          assert.strict.equal(messages.length, 1)
          assert.strict.notEqual(messages[0].Hash, undefined)
          assert.strict.equal(messages[0].Hash.startsWith('Qm'), true)
          assert.strict.equal(messages[0].Post.content, content)
          assert.strict.equal(messages[0].Post.content, message.Post.content)
          assert.strict.notEqual(messages[0].Post.sig, null)
          assert.strict.notEqual(messages[0].Post.signKey, null)
          assert.strict.notEqual(messages[0].Post.meta, null)
          assert.strict.equal(messages[0].Post.meta.ts, message.Post.meta.ts)
          assert.strict.equal(messages[0].Post.meta.from.id, message.Post.meta.from.id)
          done()
        })
        .catch(done)
    })
  })
})
