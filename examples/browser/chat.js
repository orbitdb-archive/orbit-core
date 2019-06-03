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

const username =
  'Anonymous' +
  new Date()
    .getTime()
    .toString()
    .slice(-4)

const channelName = 'orbit-browser-example'

const ipfsOptions = {
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
}

const orbitOptions = {
  dbOptions: { maxHistory: visibleMessages }
}

let messages = []

function startIpfs (username) {
  userField.value = username
  usernameElement.innerHTML = username

  // Change the repo path so it includes our username
  // This makes each chat per username an independent instance
  ipfsOptions.repo = `/orbit/browser-example/${username}`
  const ipfs = new Ipfs(ipfsOptions)
  ipfs.on('ready', () => initOrbit(ipfs, username))
}

function initOrbit (ipfs, username) {
  // Change the db directory path so it includes our username
  // This makes each chat per username an independent instance
  orbitOptions.dbOptions.directory = `/orbit/browser-example/${username}`
  const orbit = new Orbit(ipfs, orbitOptions)
  orbit.events.on('connected', () => orbit.join(channelName))
  orbit.events.on('joined', onJoinedChannel)
  orbit.connect(username)

  connectButton = replaceElement(connectButton)
  connectButton.addEventListener('click', async () => {
    // Reconnect
    await orbit.disconnect()
    await ipfs.stop()
    startIpfs(userField.value)
  })

  orbit.events.on('entry', (entry, channelName) => {
    const post = entry.payload.value
    console.log(`[${post.meta.ts}] < ${post.meta.from.name}> ${post.content}`)
  })
}

function onJoinedChannel (channelName, channel) {
  messages = []

  // Replace HTML elements so their eventListeners are cleared
  messageField = replaceElement(messageField)
  sendButton = replaceElement(sendButton)
  sendGreetingButton = replaceElement(sendGreetingButton)

  channelNameElement.innerHTML = '#' + channelName

  channel.on('ready', async () => {
    channel.sendMessage(`/me has joined ${channelName}`)
    channel.peers.then(renderPeers)
  })

  channel.on('entry', entry => {
    messages = [...messages, entry.payload.value].sort((a, b) => a.meta.ts - b.meta.ts)
    renderMessages(messages)
    channel.peers.then(renderPeers)
  })

  sendGreetingButton.addEventListener('click', () => sendGreeting(channel))
  sendButton.addEventListener('click', () => sendMessage(channel))
  messageField.addEventListener('keyup', event => {
    if (event.keyCode === 13) sendMessage(channel)
  })

  channel.load(10)
}

function sendMessage (channel) {
  channel.sendMessage(messageField.value)
  messageField.value = null
}

function sendGreeting (channel) {
  const creatures = ['👻', '🐙', '🐷', '🐬', '🐞', '🐈', '🙉', '🐸', '🐓']
  channel.sendMessage('Greetings! ' + creatures[Math.floor(Math.random() * creatures.length)])
}

function renderMessages (messages) {
  messagesElement.innerHTML = messages
    .slice(-visibleMessages)
    .map(msg => `${formatTimestamp(msg.meta.ts)} &lt;${msg.meta.from.name}&gt; ${msg.content}<br/>`)
    .join('\n')
}

function renderPeers (peers) {
  peersElm.innerHTML = 'Peers: ' + (peers ? peers.length : 0)
}

function replaceElement (oldElement) {
  const newElement = oldElement.cloneNode(true)
  oldElement.parentNode.replaceChild(newElement, oldElement)
  return newElement
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

startIpfs(username)
