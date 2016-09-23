'use strict'

const ipfsd = require('ipfsd-ctl')

const defaultOptions = {
  dataDir: '/tmp/ipfs',
  Addresses: {
    API: '/ip4/127.0.0.1/tcp/0',
    Swarm: ['/ip4/0.0.0.0/tcp/0'],
    Gateway: '/ip4/127.0.0.1/tcp/0',
  }
}

const getDaemon = (options) => {
  const opts = Object.assign({}, defaultOptions)
  Object.assign(opts, options)

  return new Promise((resolve, reject) => {
    console.log("Starting IPFS daemon...")
    console.log("Using data directory:", opts.dataDir)
    ipfsd.local(opts.dataDir, opts, (err, ipfsDaemon) => {
      if(err) reject(err)
      ipfsDaemon.init({ directory: opts.dataDir }, (err, node) => {
        ipfsDaemon.startDaemon(['--enable-pubsub-experiment'], (err, ipfs) => {
          if (err) reject(err)
          resolve(ipfs)          
        })
      })
    })
  })  
}

module.exports = (options) => getDaemon(options)
