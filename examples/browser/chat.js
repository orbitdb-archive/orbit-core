/* global Ipfs, Orbit */

window.LOG = 'debug'

let connectButton = document.getElementById('connect')
let messageField = document.getElementById('message')
let sendButton = document.getElementById('send')
let sendGreetingButton = document.getElementById('send2')
const channelNameElement = document.getElementById('channel')
const messagesElement = document.getElementById('messages')
const usernameElement = document.getElementById('username')
const userField = document.getElementById('user')
const peersElm = document.getElementById('peersCount')

const visibleMessages = 20

let username =
  'Anonymous' +
  new Date()
    .getTime()
    .toString()
    .slice(-4)

const channelName = 'orbit-browser-example'

// Init IPFS
const ipfs = new Ipfs({
  repo: '/orbit/browser-example',
  EXPERIMENTAL: {
    pubsub: true,
    sharding: false,
    dht: false
  },
  preload: { enabled: false },
  config: {
    Addresses: {
      Swarm: ['/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star']
    }
  }
})

ipfs.on('ready', () => {
  let orbit
  let peerIntervalId

  const connect = () => {
    // Replace HTML elements so their eventListeners are cleared
    connectButton = replaceElement(connectButton)
    messageField = replaceElement(messageField)
    sendButton = replaceElement(sendButton)
    sendGreetingButton = replaceElement(sendGreetingButton)

    messagesElement.innerHTML = ''
    username = userField.value || username

    if (orbit) {
      // Reconnecting
      clearInterval(peerIntervalId)
      const _orbit = orbit
      _orbit.leave(channelName).then(() => {
        _orbit.disconnect()
      })
    }

    // Setup Orbit
    orbit = new Orbit(ipfs, {
      dbOptions: { maxHistory: visibleMessages, directory: username + '/orbit-db' }
    })

    // Connect
    orbit
      .connect(username)
      .then(() => {
        connectButton.addEventListener('click', connect)
        userField.value = username
        usernameElement.innerHTML = username
        return orbit.join(channelName)
      })
      .then(() => {
        const channel = orbit.channels[channelName]

        channelNameElement.innerHTML = '#' + channelName

        sendButton.addEventListener('click', () => sendMessage(orbit, channelName))
        sendGreetingButton.addEventListener('click', () => sendGreeting(orbit, channelName))

        messageField.addEventListener('keyup', event => {
          if (event.keyCode === 13) sendMessage(orbit, channelName)
        })

        channel.feed.load()

        // Handle new messages
        channel.feed.events.on('write', () => updateMessages(channel))
        channel.feed.events.on('replicated', () => updateMessages(channel))

        channel.feed.events.on('ready', () => {
          setTimeout(
            sendMessage.bind(null, orbit, channelName, `/me has joined ${channelName}`),
            2000
          )
        })

        peerIntervalId = setInterval(updatePeers.bind(null, ipfs, channel), 1000)
      })
      .catch(handleError)
  }

  connect()
})

ipfs.on('error', handleError)

function sendMessage (orbit, channelName, message = null) {
  orbit.send(channelName, message || messageField.value)
  messageField.value = null
}

function sendGreeting (orbit, channelName) {
  const creatures = ['👻', '🐙', '🐷', '🐬', '🐞', '🐈', '🙉', '🐸', '🐓']
  const idx = Math.floor(Math.random() * creatures.length)
  sendMessage(orbit, channelName, 'Greetings! ' + creatures[idx])
}

function updateMessages (channel) {
  const entries = channel.feed.iterator({ limit: visibleMessages }).collect()
  const history = entries
    .sort((a, b) => a.payload.value.meta.ts - b.payload.value.meta.ts)
    .map(
      entry =>
        `${formatTimestamp(entry.payload.value.meta.ts)} &lt;${
          entry.payload.value.meta.from.name
        }&gt; ${entry.payload.value.content}<br/>`
    )
    .join('\n')
  messagesElement.innerHTML = history
}

function updatePeers (ipfs, channel) {
  ipfs.pubsub
    .peers(channel.feed.address.toString())
    .then(peers => (peersElm.innerHTML = 'Peers: ' + (peers ? peers.length : 0)))
}

function replaceElement (oldElement) {
  const newElement = oldElement.cloneNode(true)
  oldElement.parentNode.replaceChild(newElement, oldElement)
  return newElement
}

function handleError (e) {
  console.error(e.stack)
}

function formatTimestamp (timestamp) {
  const safeTime = time => ('0' + time).slice(-2)
  const date = new Date(timestamp)
  return (
    safeTime(date.getHours()) +
    ':' +
    safeTime(date.getMinutes()) +
    ':' +
    safeTime(date.getSeconds())
  )
}
