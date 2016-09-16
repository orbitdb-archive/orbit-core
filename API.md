# Orbit API Documentation
### Constructor

#### new Orbit(ipfs, options = {})
Create an instance of Orbit.

`ipfs` - An IPFS instance. Either [`js-ipfs`](https://github.com/ipfs/js-ipfs) or [`js-ipfs-api`](https://github.com/ipfs/js-ipfs-api).

`options` - Default options are:
``` 
{
  keystorePath: <path>, // path where to keep keys
  cacheFile: <file>,    // path to orbit-db cache file
  maxHistory: 64        // how many messages to retrieve from history on joining a channel
}
```

**Usage**

```javascript
const Orbit = require('orbit-core')
const ipfs = require('ipfs-api')() // default: 'localhost:5001'
const orbit = new Orbit(ipfs)
```

### Properties

#### user
Returns the current user.

**Usage**

```javascript
const user = orbit.user
console.log(user.name, user.id)
```

#### network
Returns the network info.

**Usage**

```javascript
const network = orbit.network
console.log(network.name)
```

#### channels
Returns the channels the user is currently joined on.

#### peers
Returns a list of IPFS swarm peers.

### Methods

#### connect(username)
Connect to a network as `username`.

TODO: return value, thrown errors, example

**Usage**

```javascript
orbit.events.on('connected', (network) => {
  console.log(`Connected to ${network.name} as ${orbit.user.name}`)
})

orbit.connect('Haad')
```

#### disconnect()
Disconnect from the currently connected network.

TODO: return value, thrown errors, example

**Usage**

```javascript
orbit.disconnect()
```

#### join(channel)
Join a `channel`. Upon successfully joining a channel, `events` will emit `'joined'` event.

Returns `true` if joined a channel, `false` if orbit is already joined on the `channel`.

**Usage**

```javascript
orbit.events.on('joined', (channel) => console.log(`Joined #${channel}`))
orbit.join('mychannel')
```

Or

```javascript
orbit.join('mychannel')
  .then((channel) => console.log(`Joined #${channel}`)))
```

#### leave(channel)
Leave a `channel`.

TODO: return value, thrown errors, example

```javascript
orbit.leave()
```
#### send(channel, message)
Send a `message` to a `channel`. Channel must be joined first.

TODO: return value, thrown errors, example

```javascript
orbit.events.on('message', (channel, message) => console.log(message))
orbit.send('mychannel', 'hello world')
```

To get the actual content of the message, you need to get the POST from `message.payload.value` with:
```javascript
orbit.getPost(message.payload.value)
    .then((post) => console.log(post))

/*
{
  content: 'hello world',
  ...
}
*/
```

#### get(channel, lessThanHash, greaterThanHash, amount)
Get messages from a channel. Returns a Promise that resolves to an `Array` of messages.

TODO: params, thrown errors, example

#### getPost(hash)
Get the contents of a message.

TODO: params, return value, thrown errors, example

```javascript
orbit.getPost(message.payload.value)
  .then((post) => {
    // Get the user info
    orbit.getUser(post.meta.from)
      .then((user) => {
        console.log(`${post.meta.ts} < ${user.name}> ${post.content}`)
      })
  })
```

### TODO

#### addFile(channel, filePath || buffer)
Add a file to a `channel`. 

TODO: params, return value, thrown errors, example

#### getFile(hash)
Returns contents of a file from IPFS.

TODO: params, return value, thrown errors, example

#### getDirectory(hash)
Returns a directory listing as an `Array`

TODO: params, return value, thrown errors, example
