import { init } from '@hypercnt/server'

import * as client from '../client/client'

// define the server side action handlers.
const actions = {
  v0: {
    counter: {
      down: (req, res) => {
        res.send(-1)
      },
      down10: (req, res) => {
        res.send(-10)
      },
      up: (req, res) => {
        res.send(1)
      },
      up10: (req, res) => {
        res.send(10)
      },
    },
  },
}

// gather settings for the servers.
// these are the default settings and could be omitted.
const props = {
  actions,
  client,
  http: {
    host: 'localhost',
    port: 3000,
    protocol: 'http',
    bundleUrl: '/js/bundle.js',
  },
  socket: {
    host: 'localhost',
    port: 3001,
    protocol: 'ws',
  },
}

// start websockets and http server
init(props)
