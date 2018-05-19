import { app } from 'hyperapp'
import { connect } from '@hypercnt/client'

import { state, actions, view } from './client'

export const connected = app(state, actions, view, document.body)

// socket server connection options
const options = {
  host: 'localhost',
  protocol: 'ws',
  port: 3001,
}

// wires the app and mounts it.
export const ws = connect(connected, options)
