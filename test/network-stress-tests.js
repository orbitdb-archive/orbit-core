'use strict'

const fs = require('fs')
const rmrf = require('rimraf')
const path = require('path')
const assert = require('assert')
const pMap = require('p-map')
const pEachSeries = require('p-each-series')
const pWhilst = require('p-whilst')
// const mapSeries = require('../src/promise-map-series')
const mapSeries = require('p-each-series')
const Post = require('ipfs-post')
const IPFS = require('ipfs')
const Orbit = require('../src/Orbit')
const startIpfs = require('./start-ipfs')

// Mute logging
require('logplease').setLogLevel('NONE')

// Root path for data
const rootPath = './orbit/network-tests'

// Init storage for saving test keys
const keystorePath = path.join(process.cwd(), '/test/keys')

// Settings for the test ipfs daemons
const config = require('./daemons.conf.js')

// Orbit
const defaultOrbitDirectory = path.join('./', '/orbit')
const username1 = 'testrunner1'
const username2 = 'testrunner2'
const channelName = 'orbit-network-stress-tests'

const hasIpfsApiWithPubsub = (ipfs) => {
  return ipfs.object.get !== undefined
      && ipfs.object.put !== undefined
      && ipfs.pubsub.publish !== undefined
      && ipfs.pubsub.subscribe !== undefined
}

const waitForPeers = (ipfs, channel) => {
  return new Promise((resolve, reject) => {
    // console.log(`'${channel.feed.id}' waiting for peers on #${channel.name}...`)
    const interval = setInterval(() => {
      ipfs.pubsub.peers(channel.feed.path)
        .then((peers) => {
          if (peers.length > 0) {
            // console.log("Found peers, starting the test...")
            clearInterval(interval)
            resolve()
          }
        })
        .catch((e) => {
          clearInterval(interval)
          reject(e)
        })
    }, 1000)
  })
}

describe.skip('Orbit - Send and Receive Tests', function() {
  // We need a huge timeout since we're running
  // very long-running tests (takes minutes)
  this.timeout(1000 * 60 * 20) // 20 mins

  const tests = [
    {
      description: 'send and receive two ways - concurrent',
      messages: 100,
      maxInterval: -1,
      minInterval: 0,
      content: 'Hello #',
      clients: [
        { name: 'daemon1' },
        { name: 'daemon2' },
        { name: 'daemon3' },
        { name: 'daemon4' },
      ],
    },
    {
      description: 'send and receive two ways - concurrent, as fast as possible',
      messages: 1000,
      maxInterval: -1,
      minInterval: 0,
      content: 'Hello world, ',
      clients: [
        { name: 'daemon1' },
        { name: 'daemon2' },
      ],
    },
    {
      description: 'send and receive two ways - concurrent, random, slow write times',
      messages: 200,
      maxInterval: 2000,
      minInterval: 200,
      content: 'Hello world, ',
      clients: [
        { name: 'daemon1' },
        { name: 'daemon2' },
        { name: 'daemon3' },
        { name: 'daemon4' },
      ],
    },
  ]


  tests.forEach(test => {
    it(test.description, (done) => {
      const messageCount = test.messages
      const maxInterval = test.maxInterval
      const minInterval = test.minInterval || 0
      const sequential = test.sequential
      const clientData = test.clients

      rmrf.sync(rootPath)

      // Create IPFS instances
      const createIpfsInstance = (c) => {
        const repoPath = path.join(rootPath, c.name, '/ipfs/network-stress-test-ipfs-' + new Date().getTime())
        console.log("Starting IPFS instance <<>>", repoPath)
        return startIpfs(Object.assign({}, config.defaultIpfsConfig, {
          repo: repoPath,
          start: true,
        }))
      }

      const startOrbitClient = (c, ipfs) => {
        const orbit = new Orbit(ipfs, {
          keystorePath: path.join(keystorePath, c.name), 
          cachePath: path.join('./orbit/network-tests/', c.name),
        })

        return orbit.connect(c.name)
      }

      let texts = []
      let allMessages = []

      const setupAllMessages = (clients) => {
        // Create the messages that each client will send
        texts = []
        for (let i = 1; i < messageCount + 1; i ++) {
          texts.push(test.content + i)
        }

        const setupMessages = (client) => texts.reduce((res, acc) => {
          return res.concat([{ orbit: client, content: acc }])
        }, [])

        allMessages = clients.map(orbit => {
          return {
            name: orbit.user.name,
            messages: setupMessages(orbit),
          }
        })
      }

      const sendAllMessages = () => {
        if (sequential) {
          return pEachSeries(allMessages, e => pEachSeries(e.messages, sendMessage))
            .then(() => console.log())
        } else {
          return pMap(allMessages, e => pEachSeries(e.messages, sendMessage))
            .then(() => console.log())
        }
      }

      let i = 0
      let a = 0

      const sendMessage = (message) => {
        return new Promise((resolve, reject) => {
          a ++
          if (maxInterval === -1) {
              message.orbit.send(channelName, message.content)
                .then(() => process.stdout.write(`\rSent: ${Math.floor(++i / clients.length)} (x${clients.length}) total: ${a}`))
                .then(resolve)
                .catch(reject)
          } else {
            setTimeout(() => {
              message.orbit.send(channelName, message.content)
                .then(() => process.stdout.write(`\rSent: ${Math.floor(++i / clients.length)} (x${clients.length}) total: ${a}`))
                .then(resolve)
                .catch(reject)
            }, Math.floor(Math.random() * maxInterval) + minInterval)
          }
        })
      }

      const waitForAllMessages = (channelName) => {
        let msgCount = 0
        return pWhilst(
          () => msgCount < clients.length * messageCount * clients.length,
          () => new Promise(resolve => {
            return getAllMessages(channelName)
              .then(res => {
                msgCount = res.reduce((val, acc) => val += acc.length, 0)
              })
              .then(() => process.stdout.write("\rReceived: " + msgCount.toString() + ' / ' + messageCount * clients.length * clients.length))
              .then(() => setTimeout(resolve, 100))
          })
        )
      }

      const getAllMessages = (channelName) => {
        return pMap(clients, orbit => orbit.get(channelName, null, null, -1))
      }
          
      // Start the test
      let clients = []
      let allChannels = [] 
      let waitForAllPeers = [] 

      pMap(clientData, c => {
        return createIpfsInstance(c)
          .then(ipfs => startOrbitClient(c, ipfs))
      }, { concurrency: 1 })
      .then((result) => {
        clients = result
        allChannels = clients.map(orbit => orbit.join(channelName))
        waitForAllPeers = clients.map(orbit => waitForPeers(orbit._ipfs, orbit.getChannel(channelName)))
        return setupAllMessages(clients)
      })
      .then(() => Promise.all(allChannels))
      .then(() => Promise.all(waitForAllPeers))
      .then(() => console.log(`Sending ${messageCount} messages. This will take a while...`))
      .then(() => sendAllMessages())
      .then(() => console.log('Messages sent. Waiting for all messages to arrive...'))
      .then(() => waitForAllMessages(channelName))
      .then(() => getAllMessages(channelName))
      .then((result) => {
        // Both clients have the same amount of messages
        result.forEach(messages => {
          assert.equal(messages.length, messageCount * clients.length)
        })

        // Both clients have the same messages in same order
        result.reduce((prev, messages) => {
          assert.deepEqual(messages, prev)
          return messages
        }, result[0])

        // Success
        pEachSeries(clients, orbit => orbit.disconnect())
          .then(() => done())
      })
      .catch(done)
    })
  })
})
