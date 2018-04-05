'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var init = _interopDefault(require('@hyperconnect/server'));

function h(name, attributes) {
  var rest = [];
  var children = [];
  var length = arguments.length;

  while (length-- > 2) rest.push(arguments[length]);

  while (rest.length) {
    var node = rest.pop();
    if (node && node.pop) {
      for (length = node.length; length--; ) {
        rest.push(node[length]);
      }
    } else if (node != null && node !== true && node !== false) {
      children.push(node);
    }
  }

  return typeof name === "function"
    ? name(attributes || {}, children)
    : {
        nodeName: name,
        attributes: attributes || {},
        children: children,
        key: attributes && attributes.key
      }
}

let ws = undefined;

const cache = [];
let open = false;
let apiVersion = "v0";

let error = (...msg) => console.error(...msg);

const isString = o => typeof o === "string";

const stringify = msg => {
  try {
    if (isString(msg)) {
      msg = JSON.parse(msg);
    }

    msg[0] = `${apiVersion}.${msg[0]}`;

    return JSON.stringify(msg)
  } catch (e) {
    error(e);
  }
};

const send = msg => (open ? ws.send(stringify(msg)) : cache.push(msg));

const map = (actions = {}, remote = {}, parent = null) => {
  Object.keys(remote).forEach(name => {
    const action = remote[name];

    if (typeof action === "function") {
      actions[name + "_done"] = action;

      actions[name] = (state, actions) => data => {
        const key = parent ? `${parent}.${name}` : name;
        const msg = [key, data].filter(e => !!e);

        send(msg);
      };

      return
    }

    if (typeof action === "object") {
      const remoteActions = map({}, action, name);
      actions[name] = Object.assign({}, actions[name], remoteActions);
      return
    }
  });

  return actions
};

const mapActions = map;

// just a usual hyperapp state
const state = {
  counter: {
    value: 0,
  },
};

// just usual hyperapp actions.
// careful, remote actions overwrite actions.
const local = {
  local: val => () => ({ input: val }),
  counter: {
    up20: val => state => ({ value: state.value + 20 }),
  },
};

// remote actions first get wrapped to allow server roundtrips
// and then merged into the actions
const remote = {
  counter: {
    down: res => () => res,
    down10: res => () => res,
    up: res => () => res,
    up10: res => () => res,
  },
};

// create the actions
const actions = mapActions(local, remote);

// just a usual hyperapp view
const view = (state, actions) => (
  h('div', null, [
    h('h1', null, [state.counter.value]),

    h('div', null, [JSON.stringify(state)]),

    h('button', {onclick: () => actions.counter.up()}, ["+"]),
    h('button', {onclick: () => actions.counter.up10()}, ["+10"]),
    h('button', {onclick: () => actions.counter.up20()}, ["+20"]),

    h('button', {onclick: () => actions.counter.down()}, ["-"]),
    h('button', {onclick: () => actions.counter.down10()}, ["-10"]),

    h('input', {type: "text", onkeyup: e => actions.local(e.target.value)}),
    h('span', null, ["text, no server roundtrip: ", state.input])
  ])
);

var client = /*#__PURE__*/Object.freeze({
  state: state,
  local: local,
  remote: remote,
  actions: actions,
  view: view
});

// define the server side action handlers.
const actions$1 = {
  v0: {
    counter: {
      down: (req, res) => {
        const value = Math.max(0, parseInt(req.body.value, 10) - 1);
        res.send({ value });
      },
      down10: (req, res) => {
        const value = Math.max(0, parseInt(req.body.value, 10) - 10);
        res.send({ value });
      },
      up: (req, res) => {
        const value = parseInt(req.body.value, 10) + 1;
        res.send({ value });
      },
      up10: (req, res) => {
        const value = parseInt(req.body.value, 10) + 10;
        res.send({ value });
      },
    },
  },
};

// gather settings for the servers.
// these are the default settings and could be omitted.
const props = {
  actions: actions$1,
  sockets: {
    host: 'localhost',
    port: 3001,
    protocol: 'ws',
  },
  http: {
    host: 'localhost',
    port: 3000,
    protocol: 'http',
    bundleUrl: '/js/bundle.js',
  },
  client,
};

// start websockets and http server
const { socket, http } = init(props);
//# sourceMappingURL=server.js.map
