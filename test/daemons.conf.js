module.exports = {
  daemon1: {
    repo: '/tmp/orbit-db-tests-1',
    start: true,
    config: {
      Addresses: {
        API: '/ip4/127.0.0.1/tcp/0',
        Swarm: ['/ip4/0.0.0.0/tcp/0'],
        Gateway: '/ip4/0.0.0.0/tcp/0'
      },
      Bootstrap: []
    },
    EXPERIMENTAL: {
      pubsub: true,
    },
  },
  daemon2: {
    repo: '/tmp/orbit-db-tests-2',
    start: true,
    config: {
      Addresses: {
        API: '/ip4/127.0.0.1/tcp/0',
        Swarm: ['/ip4/0.0.0.0/tcp/0'],
        Gateway: '/ip4/0.0.0.0/tcp/0'
      },
      Bootstrap: []
    },
    EXPERIMENTAL: {
      pubsub: true,
    },
  },
}
