'use strict'

const ipfsDaemon = require('./ipfs-gimme-daemon')
const Orbit = require('../src/Orbit')
const quotes = require('./quotes.js')

/*
  A simple Orbit bot that listens on a channel.

  Usage:
  node index.js <botname> <channel>

  Eg.
  node index.js Cacher1 ipfs
*/

// Options
let user = process.argv[2] || 'QuoteBot'
let channel = process.argv[3] || 'ipfs'

// State
let orbit, ipfs

function formatTimestamp(timestamp) {
  const safeTime = (time) => ("0" + time).slice(-2)
  const date = new Date(timestamp)
  return safeTime(date.getHours()) + ":" + safeTime(date.getMinutes()) + ":" + safeTime(date.getSeconds())
}

// MAIN
const ipfsDataDir = '/tmp/' + user

// Start an IPFS daemon
ipfsDaemon({ dataDir: ipfsDataDir })
  .then((ipfs) => {
    orbit = new Orbit(ipfs, { maxHistory: 0 })

    orbit.events.on('connected', (network) => {
      console.log(`-!- Connected to ${network.name}`)
      orbit.join(channel)
    })

    orbit.events.on('joined', (channel) => {
      orbit.send(channel, "/me is now caching this channel")
      console.log(`-!- Joined #${channel}`)

      let index = 0
      setInterval(() => {
        const quote = "'" + quotes[index][0] + "' -- " + quotes[index][1]
        orbit.send(channel, quote)
        index = index >= quotes.length - 1 ? 0 : index + 1
      }, 2000)
    })

    // Listen for new messages
    orbit.events.on('message', (channel, message) => {
      // Get the actual content of the message
      orbit.getPost(message.payload.value, true) // true == include user profile in the post
        .then((post) => {
          console.log(`${formatTimestamp(post.meta.ts)} < ${post.meta.from.name}> ${post.content}`)
        })
    })

    // Connect to Orbit DEV network
    orbit.connect(user)
      .catch((e) => logger.error(e))
  })
  .catch((e) => {
    console.log(e)
    process.exit(1)
  })
