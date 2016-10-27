# orbit-core

>  Communication protocol on IPFS

**WIP module for Orbit**

Use for:
- Chat applications
- Data pipelines
- CLI clients

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

### Build Library and Distributables
```
npm run build
```

Library (ES5 for Node.js) will be located in `lib/`.

Distributable (ES5 minified for browsers) will be located in `dist/`.

### Run Test
```
npm test
```
