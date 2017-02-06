# orbit-core

[![npm version](https://badge.fury.io/js/orbit_.svg)](https://badge.fury.io/js/orbit-db)
[![CircleCI Status](https://circleci.com/gh/haadcode/orbit-core.svg?style=shield)](https://circleci.com/gh/haadcode/orbit-db)
[![](https://img.shields.io/badge/made%20by-Protocol%20Labs-blue.svg?style=flat-square)](http://ipn.io)
[![](https://img.shields.io/badge/freenode-%23ipfs-blue.svg?style=flat-square)](http://webchat.freenode.net/?channels=%23ipfs)
[![Project Status](https://badge.waffle.io/haadcode/orbit.svg?label=In%20Progress&title=Roadmap)](https://waffle.io/haadcode/orbit)

>  Communication protocol on IPFS

Orbit is a serverless, distributed, p2p communication library and protocol that enables feed-based information sharing, such as real-time chat, in the [IPFS](https://ipfs.io) peer-to-peer network.

This repository is the core library of Orbit. This library is intended to be used in your Node.js or Browser applications.

Used in the various Orbit projects:
- [orbit-web](https://github.com/orbitdb/orbit-web) - Orbit browser app
- [orbit-electron](https://github.com/orbitdb/orbit-electron) - Orbit desktop app
- [orbit-textui](https://github.com/orbitdb/orbit-textui) - Orbit terminal client

## Usage

### Install
```
npm install orbit_
```

### Example

See [examples/bot.js]() for a more detailed example.

```javascript
/* NOTE! To run this example, you need to have an IPFS daemon running */

'use strict'

const IpfsApi = require('ipfs-api')
const Orbit = require('orbit_')

const ipfs = IpfsApi()
const orbit = new Orbit(ipfs)

const channel = 'HelloWorld'

orbit.events.on('connected', (network) => {
  console.log(`-!- Connected to ${network.name}`)
  orbit.join(channel)
})

orbit.events.on('joined', (channel) => {
  orbit.send(channel, "/me is now caching this channel")
  console.log(`-!- Joined #${channel}`)
})

// Listen for new messages
orbit.events.on('message', (channel, message) => {
  // Get the actual content of the message
  orbit.getPost(message.payload.value)
    .then((post) => {
      // Get the user info
      orbit.getUser(post.meta.from)
        .then((user) => {
          console.log(`[${post.meta.ts}] < ${user.name}> ${post.content}`)
        })
    })
})

// Connect to Orbit network
orbit.connect('Example Bot')
  .catch((e) => logger.error(e))
```

## Development

### Install Dependencies
```
git clone https://github.com/haadcode/orbit-core.git
cd orbit-core/
npm install
```

### Run Tests
```
npm test
```

### Build Library and Distributables
```
npm run build
```

Library (ES5 for older browsers and Node.js) will be located in `lib/`.

Distributable (ES5 minified for browsers) will be located in `dist/`.
