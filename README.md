## hyperconnect example app

This is a minimal example of using [hyperconnect](https://github.com/hyperapp-connect/connect)
to connect your hyperapp to an action-driven websocket/http api server.

Action-driven means that all you need to add to make an action resolve serverside is a server action.


#### Example:


##### Client
```javascript
  // src/client.js
  import { mapActions } from 'hyperconnect-client'

  const state = {
    value: 0
  }

  const local = {
    add: () => state => ({ value: state.value + 1 })
  }

  const remote = {
    sub: () => state => ({ value: state.value - 1 })
  }

  const actions = mapActions(local, remote)

  const view = (state, actions) => {
    <div>
      <div>{state.value}</div>
      // Clientside Action
      <button onclick={actions.add}>add</button>

      // Serverside Action
      <button onclick={actions.sub}>sub</button>
    </div>
  }

  const connected = app(state, actions, view, document.body)
```

##### Server
```javascript
  // src/server.js

  import init from '@hyperconnect/server'

  // import the client for ssr
  import * as client from './client'

  // define the server side action handlers.
  const actions = {
    v0: { // api version
      sub: (req, res) => {
        const value = Math.max(0, parseInt(req.body.value, 10) - 1)
        res.send({ value })
      }
    }
  }

  // gather settings for the servers.
  // the commented fields are default settings and can be omitted.
  const props = {
    actions,
    client, // needed for ssr
    // sockets: {
    //   host: 'localhost',
    //   port: 3001,
    //   protocol: 'ws',
    // },
    // http: {
    //   host: 'localhost',
    //   port: 3000,
    //   protocol: 'http',
    //   bundleUrl: '/js/bundle.js',
    // },
  }

  // start websockets and http server
  const { socket, http } = init(props)

  // socket is a ws server
  // http is a expressjs server
```
