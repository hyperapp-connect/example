'use strict';

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var ws = _interopDefault(require('ws'));
var log = _interopDefault(require('@magic/log'));
var deep = _interopDefault(require('@magic/deep'));
var stream = require('stream');
var fs = _interopDefault(require('fs'));
var path = _interopDefault(require('path'));
var express = _interopDefault(require('express'));

const flattenActions = a => {
  const b = {};
  Object.keys(a).forEach(k => {
    const act = a[k];
    if (typeof act === 'object') {
      b[k] = flattenActions(a[k]);
    } else if (typeof act === 'function') {
      b[k] = 'action';
    }
  });

  return b
};

const mapActions = ({ actions, name }) => {
  let action = actions;

  name.split('.').forEach(k => {
    if (typeof action !== 'function' && action[k]) {
      action = action[k];
    }
  });

  return action
};

const defaultProps = {
  socket: {
    host: 'localhost',
    port: 3001,
    protocol: 'ws',
    actions: {},
  },
};

const socket = args => {
  const { actions, socket: conf, db, jwt } = deep.merge(defaultProps, args);
  const server = new ws.Server(conf);

  server.on('connection', (client, req) => {
    client.on('message', msg => {
      try {
        msg = JSON.parse(msg);
      } catch (err) {
        log.error(err);
      }

      const [name, body] = msg;
      log.info('receive', name, body);

      const request = {
        req,
        name,
        client,
        body,
      };

      const response = {
        send: data => {
          const res = [name.replace('v0.', '')];

          if (data) {
            if (typeof data === 'number' || typeof data === 'string') {
              data = {
                data,
                ok: true,
              };
            }

            res.push(data);
          }

          log.info('send', res);

          client.send(JSON.stringify(res.filter(e => typeof e !== 'undefined')));
        },
      };

      const action = mapActions({ actions: actions, name: request.name });

      if (typeof action === 'function') {
        if (db) {
          response.db = db;
        }
        if (jwt) {
          response.jwt = jwt;
        }

        action(request, response);
      } else {
        client.send('Unknown Action');
      }
    });
  });

  log.info(`socket server listening on ${conf.port}`);
  return server
};

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

function app(state, actions, view, container) {
  var map = [].map;
  var rootElement = (container && container.children[0]) || null;
  var oldNode = rootElement && recycleElement(rootElement);
  var lifecycle = [];
  var skipRender;
  var isRecycling = true;
  var globalState = clone(state);
  var wiredActions = wireStateToActions([], globalState, clone(actions));

  scheduleRender();

  return wiredActions

  function recycleElement(element) {
    return {
      nodeName: element.nodeName.toLowerCase(),
      attributes: {},
      children: map.call(element.childNodes, function(element) {
        return element.nodeType === 3 // Node.TEXT_NODE
          ? element.nodeValue
          : recycleElement(element)
      })
    }
  }

  function resolveNode(node) {
    return typeof node === "function"
      ? resolveNode(node(globalState, wiredActions))
      : node != null ? node : ""
  }

  function render() {
    skipRender = !skipRender;

    var node = resolveNode(view);

    if (container && !skipRender) {
      rootElement = patch(container, rootElement, oldNode, (oldNode = node));
    }

    isRecycling = false;

    while (lifecycle.length) lifecycle.pop()();
  }

  function scheduleRender() {
    if (!skipRender) {
      skipRender = true;
      setTimeout(render);
    }
  }

  function clone(target, source) {
    var out = {};

    for (var i in target) out[i] = target[i];
    for (var i in source) out[i] = source[i];

    return out
  }

  function set(path$$1, value, source) {
    var target = {};
    if (path$$1.length) {
      target[path$$1[0]] =
        path$$1.length > 1 ? set(path$$1.slice(1), value, source[path$$1[0]]) : value;
      return clone(source, target)
    }
    return value
  }

  function get(path$$1, source) {
    var i = 0;
    while (i < path$$1.length) {
      source = source[path$$1[i++]];
    }
    return source
  }

  function wireStateToActions(path$$1, state, actions) {
    for (var key in actions) {
      typeof actions[key] === "function"
        ? (function(key, action) {
            actions[key] = function(data) {
              var result = action(data);

              if (typeof result === "function") {
                result = result(get(path$$1, globalState), actions);
              }

              if (
                result &&
                result !== (state = get(path$$1, globalState)) &&
                !result.then // !isPromise
              ) {
                scheduleRender(
                  (globalState = set(path$$1, clone(state, result), globalState))
                );
              }

              return result
            };
          })(key, actions[key])
        : wireStateToActions(
            path$$1.concat(key),
            (state[key] = clone(state[key])),
            (actions[key] = clone(actions[key]))
          );
    }

    return actions
  }

  function getKey(node) {
    return node ? node.key : null
  }

  function eventListener(event) {
    return event.currentTarget.events[event.type](event)
  }

  function updateAttribute(element, name, value, oldValue, isSvg) {
    if (name === "key") ; else if (name === "style") {
      for (var i in clone(oldValue, value)) {
        var style = value == null || value[i] == null ? "" : value[i];
        if (i[0] === "-") {
          element[name].setProperty(i, style);
        } else {
          element[name][i] = style;
        }
      }
    } else {
      if (name[0] === "o" && name[1] === "n") {
        name = name.slice(2);

        if (element.events) {
          if (!oldValue) oldValue = element.events[name];
        } else {
          element.events = {};
        }

        element.events[name] = value;

        if (value) {
          if (!oldValue) {
            element.addEventListener(name, eventListener);
          }
        } else {
          element.removeEventListener(name, eventListener);
        }
      } else if (name in element && name !== "list" && !isSvg) {
        element[name] = value == null ? "" : value;
      } else if (value != null && value !== false) {
        element.setAttribute(name, value);
      }

      if (value == null || value === false) {
        element.removeAttribute(name);
      }
    }
  }

  function createElement(node, isSvg) {
    var element =
      typeof node === "string" || typeof node === "number"
        ? document.createTextNode(node)
        : (isSvg = isSvg || node.nodeName === "svg")
          ? document.createElementNS(
              "http://www.w3.org/2000/svg",
              node.nodeName
            )
          : document.createElement(node.nodeName);

    var attributes = node.attributes;
    if (attributes) {
      if (attributes.oncreate) {
        lifecycle.push(function() {
          attributes.oncreate(element);
        });
      }

      for (var i = 0; i < node.children.length; i++) {
        element.appendChild(
          createElement(
            (node.children[i] = resolveNode(node.children[i])),
            isSvg
          )
        );
      }

      for (var name in attributes) {
        updateAttribute(element, name, attributes[name], null, isSvg);
      }
    }

    return element
  }

  function updateElement(element, oldAttributes, attributes, isSvg) {
    for (var name in clone(oldAttributes, attributes)) {
      if (
        attributes[name] !==
        (name === "value" || name === "checked"
          ? element[name]
          : oldAttributes[name])
      ) {
        updateAttribute(
          element,
          name,
          attributes[name],
          oldAttributes[name],
          isSvg
        );
      }
    }

    var cb = isRecycling ? attributes.oncreate : attributes.onupdate;
    if (cb) {
      lifecycle.push(function() {
        cb(element, oldAttributes);
      });
    }
  }

  function removeChildren(element, node) {
    var attributes = node.attributes;
    if (attributes) {
      for (var i = 0; i < node.children.length; i++) {
        removeChildren(element.childNodes[i], node.children[i]);
      }

      if (attributes.ondestroy) {
        attributes.ondestroy(element);
      }
    }
    return element
  }

  function removeElement(parent, element, node) {
    function done() {
      parent.removeChild(removeChildren(element, node));
    }

    var cb = node.attributes && node.attributes.onremove;
    if (cb) {
      cb(element, done);
    } else {
      done();
    }
  }

  function patch(parent, element, oldNode, node, isSvg) {
    if (node === oldNode) ; else if (oldNode == null || oldNode.nodeName !== node.nodeName) {
      var newElement = createElement(node, isSvg);
      parent.insertBefore(newElement, element);

      if (oldNode != null) {
        removeElement(parent, element, oldNode);
      }

      element = newElement;
    } else if (oldNode.nodeName == null) {
      element.nodeValue = node;
    } else {
      updateElement(
        element,
        oldNode.attributes,
        node.attributes,
        (isSvg = isSvg || node.nodeName === "svg")
      );

      var oldKeyed = {};
      var newKeyed = {};
      var oldElements = [];
      var oldChildren = oldNode.children;
      var children = node.children;

      for (var i = 0; i < oldChildren.length; i++) {
        oldElements[i] = element.childNodes[i];

        var oldKey = getKey(oldChildren[i]);
        if (oldKey != null) {
          oldKeyed[oldKey] = [oldElements[i], oldChildren[i]];
        }
      }

      var i = 0;
      var k = 0;

      while (k < children.length) {
        var oldKey = getKey(oldChildren[i]);
        var newKey = getKey((children[k] = resolveNode(children[k])));

        if (newKeyed[oldKey]) {
          i++;
          continue
        }

        if (newKey == null || isRecycling) {
          if (oldKey == null) {
            patch(element, oldElements[i], oldChildren[i], children[k], isSvg);
            k++;
          }
          i++;
        } else {
          var keyedNode = oldKeyed[newKey] || [];

          if (oldKey === newKey) {
            patch(element, keyedNode[0], keyedNode[1], children[k], isSvg);
            i++;
          } else if (keyedNode[0]) {
            patch(
              element,
              element.insertBefore(keyedNode[0], oldElements[i]),
              keyedNode[1],
              children[k],
              isSvg
            );
          } else {
            patch(element, oldElements[i], null, children[k], isSvg);
          }

          newKeyed[newKey] = children[k];
          k++;
        }
      }

      while (i < oldChildren.length) {
        if (getKey(oldChildren[i]) == null) {
          removeElement(element, oldElements[i], oldChildren[i]);
        }
        i++;
      }

      for (var i in oldKeyed) {
        if (!newKeyed[i]) {
          removeElement(element, oldKeyed[i][0], oldKeyed[i][1]);
        }
      }
    }
    return element
  }
}

/*! Hyperapp Render | MIT Licence | https://github.com/hyperapp/render */

var styleNameCache = new Map();
var uppercasePattern = /([A-Z])/g;
var msPattern = /^ms-/;
var voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
var ignoreAttributes = new Set(['key', 'innerHTML', '__source']);
var escapeRegExp = /["&'<>]/g;
var escapeLookup = new Map([['"', '&quot;'], ['&', '&amp;'], ["'", '&#39;'], ['<', '&lt;'], ['>', '&gt;']]);

function escaper(match) {
  return escapeLookup.get(match);
}

function escapeHtml(value) {
  if (typeof value === 'number') {
    return '' + value;
  }

  return ('' + value).replace(escapeRegExp, escaper);
}

function hyphenateStyleName(styleName) {
  return styleNameCache.get(styleName) || styleNameCache.set(styleName, styleName.replace(uppercasePattern, '-$&').toLowerCase().replace(msPattern, '-ms-')).get(styleName);
}

function stringifyStyles(styles) {
  var out = '';
  var delimiter = '';
  var styleNames = Object.keys(styles);

  for (var i = 0; i < styleNames.length; i++) {
    var styleName = styleNames[i];
    var styleValue = styles[styleName];

    if (styleValue != null) {
      if (styleName === 'cssText') {
        out += delimiter + styleValue;
      } else {
        out += delimiter + hyphenateStyleName(styleName) + ':' + styleValue;
      }

      delimiter = ';';
    }
  }

  return out || null;
}

function renderFragment(_ref, stack) {
  var nodeName = _ref.nodeName,
      attributes = _ref.attributes,
      children = _ref.children;
  var out = '';
  var footer = '';

  if (nodeName) {
    out += '<' + nodeName;
    var keys = Object.keys(attributes);

    for (var i = 0; i < keys.length; i++) {
      var name = keys[i];
      var value = attributes[name];

      if (name === 'style' && value && typeof value === 'object') {
        value = stringifyStyles(value);
      }

      if (value != null && value !== false && typeof value !== 'function' && !ignoreAttributes.has(name)) {
        out += ' ' + name;

        if (value !== true) {
          out += '="' + escapeHtml(value) + '"';
        }
      }
    }

    if (voidElements.has(nodeName)) {
      out += '/>';
    } else {
      out += '>';
      footer = '</' + nodeName + '>';
    }
  }

  var innerHTML = attributes.innerHTML;

  if (innerHTML != null) {
    out += innerHTML;
  }

  if (children.length > 0) {
    stack.push({
      childIndex: 0,
      children: children,
      footer: footer
    });
  } else {
    out += footer;
  }

  return out;
}

function resolveNode(node, state, actions) {
  if (typeof node === 'function') {
    return resolveNode(node(state, actions), state, actions);
  }

  return node;
}

function renderer(view, state, actions) {
  var stack = [{
    childIndex: 0,
    children: [view],
    footer: ''
  }];
  var end = false;
  return function (bytes) {
    if (end) {
      return null;
    }

    var out = '';

    while (out.length < bytes) {
      if (stack.length === 0) {
        end = true;
        break;
      }

      var frame = stack[stack.length - 1];

      if (frame.childIndex >= frame.children.length) {
        out += frame.footer;
        stack.pop();
      } else {
        var node = resolveNode(frame.children[frame.childIndex++], state, actions);

        if (node != null && typeof node !== 'boolean') {
          if (node.pop) {
            stack.push({
              childIndex: 0,
              children: node,
              footer: ''
            });
          } else if (node.attributes) {
            out += renderFragment(node, stack);
          } else {
            out += escapeHtml(node);
          }
        }
      }
    }

    return out;
  };
}
function renderToString(view, state, actions) {
  return renderer(view, state, actions)(Infinity);
}

function renderToStream(view, state, actions) {
  var _read = renderer(view, state, actions);

  return new stream.Readable({
    read: function read(size) {
      try {
        this.push(_read(size));
      } catch (err) {
        this.emit('error', err);
      }
    }
  });
}
function withRender$1(nextApp) {
  return function (initialState, actionsTemplate, view, container) {
    var actions = nextApp(initialState, Object.assign({}, actionsTemplate, {
      getState: function getState() {
        return function (state) {
          return state;
        };
      }
    }), view, container);

    actions.toString = function () {
      return renderToString(view, actions.getState(), actions);
    };

    actions.toStream = function () {
      return renderToStream(view, actions.getState(), actions);
    };

    return actions;
  };
}

let fp = path.join(process.cwd(), 'src', 'client', 'index.html');
// default index.html file
if (!fs.existsSync(fp)) {
  fp = path.normalize('../../client/index.html');
}

const html = fs.readFileSync(fp).toString();
const splitPoint = '<body>';
const [head, footer] = html.split(splitPoint);

const render = client => (req, res) => {
  res.type('text/html');
  res.write(head + splitPoint);

  const pathname = req.path;

  // make the router render the correct view
  client.state.location = {
    pathname,
    prev: pathname,
  };

  const main = withRender$1(app)(client.state, client.actions, client.view);
  const stream$$1 = main.toStream();

  stream$$1.pipe(res, { end: false });
  stream$$1.on('end', () => {
    res.write(footer);
    res.end();
  });
};

const router = express.Router();

const routeActions = (props = {}) => {

  Object.keys(props.actions).forEach(name => {
    const action = props.actions[name];
    const path$$1 = props.parent ? `${props.parent}/${name}` : `/${name}`;

    if (typeof action === 'object') {
      routeActions({ parent: path$$1, actions: action, router });
    }

    if (typeof action === 'function') {
      props.router.get(path$$1, (req, res) => res.end('GET not supported, use POST'));
      props.router.post(path$$1, action);
    }
  });
};

const routes = ({ actions }) => {
  // define the home route
  router.get('/', (req, res) => {
    res.redirect('/v0');
  });

  router.get('/v0', (req, res) => {
    const actionNames = flattenActions(actions);
    res.send(actionNames);
  });

  routeActions({ actions, router });

  return router
};

// this is needed for ssr rendering.
// if window is not set rendering will throw
global.window = {
  location: {
    pathname: '/',
  },
};

global.history = {
  pushState: () => {},
  replaceState: () => {},
};

const defaultProps$1 = {
  http: {
    host: 'localhost',
    port: 3000,
    protocol: 'http',
    serve: [path.join(process.cwd(), 'dist'), path.join(process.cwd(), 'src', 'client', 'assets')],
  },
  actions: {},
};

const http = (props = {}) => {
  props = deep.merge(defaultProps$1, props);

  const { actions, client } = props;
  const { host, port, protocol, serve } = props.http;

  const app = express();

  serve.forEach(p => app.use(express.static(p, { index: 'index.html' })));

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.use('/api', routes({ actions }));

  app.use((req, res, next) => {
    // this is needed for ssr rendering the hyperapp/routes
    global.window.location = {
      pathname: req.path,
    };

    if (props.db) {
      res.db = props.db;
    }
    if (props.jwt) {
      res.jwt = props.jwt;
    }

    next();
  });

  app.use(render(client));

  app.listen(port, () => log.info(`http server listening to ${port}`));
  return app
};

const env = process.env.NODE_ENV || 'development';

const init = async (props = {}) => ({
  socket: await socket(props),
  http: await http(props),
});

init.socket = socket;
init.http = http;

const init$1 = init;
init$1.init = init;

const error = (...msg) => console.error(...msg);

const isString = o => typeof o === 'string';

const stringify = msg => {
  try {
    if (isString(msg)) {
      msg = JSON.parse(msg);
    }

    return JSON.stringify(msg)
  } catch (e) {
    error(e);
  }
};

let ws$1 = undefined;
let open = false;
let apiVersion = 'v0';

const send = msg => {
  if (open && ws$1) {
    if (typeof msg[0] === 'string') {
      msg[0] = `${apiVersion}.${msg[0]}`;
    }
    ws$1.send(stringify(msg));
  }
};

const mapActions$1 = (actions = {}, remote = {}, parent = null) => {
  Object.keys(remote).forEach(name => {
    const action = remote[name];
    const key = parent ? `${parent}.${name}` : name;

    if (typeof action === 'function') {
      actions[name + '_done'] = (res) => (state, actions) => {
        if (!res.ok || !res.hasOwnProperty('data')) {
          if (!res.errors && !res.error) {
            res = {
              error: 'Unknown Error',
              res,
            };
          }
          return {
            errors: res.errors || [res.error],
          }
        }
        return action(res)(state, actions)
      };

      actions[name] = data => (state = {}) => {
        if (state.jwt) {
          data.jwt = state.jwt;
        }

        const msg = [key, data];
        send(msg);
      };

      return
    }

    if (typeof action === 'object') {
      actions[name] = mapActions$1(actions[name], action, key);
      return
    }
  });

  if (!actions.socketServerConnect) {
    actions.socketServerConnect = t => () => ({ connected: t });
  }

  return actions
};

// just a usual hyperapp state
const state$1 = {
  counter: {
    value: 0,
  },
};

// just usual hyperapp actions.
// careful, remote actions overwrite actions.
const local = {
  local: val => () => ({ input: val }),
  counter: {
    up20: () => ({ value }) => ({ value: value + 20 }),
  },
};

// remote actions first get wrapped to allow server roundtrips
// and then merged into the actions
const remote = {
  counter: {
    down: ({ data }) => ({ value }) => ({ value: value + data }),
    down10: ({ data }) => ({ value }) => ({ value: value + data }),
    up: ({ data }) => ({ value }) => ({ value: value + data }),
    up10: ({ data }) => ({ value }) => ({ value: value + data }),
  },
};

// create the actions
const actions$1 = mapActions$1(local, remote);

// just a usual hyperapp view
const view = (state$$1, actions$$1) => (
  h('div', null, [
    h('h1', null, [state$$1.counter.value]),

    h('div', null, [JSON.stringify(state$$1)]),

    h('button', {onclick: actions$$1.counter.up}, ["+"]),
    h('button', {onclick: actions$$1.counter.up10}, ["+10"]),
    h('button', {onclick: actions$$1.counter.up20}, ["+20"]),

    h('button', {onclick: actions$$1.counter.down}, ["-"]),
    h('button', {onclick: actions$$1.counter.down10}, ["-10"]),

    h('input', {type: "text", onkeyup: e => actions$$1.local(e.target.value)}),
    h('span', null, ["text, no server roundtrip: ", state$$1.input])
  ])
);

var client = {
  state: state$1,
  actions: actions$1,
  view,
}

var client$1 = /*#__PURE__*/Object.freeze({
  state: state$1,
  local: local,
  remote: remote,
  actions: actions$1,
  view: view,
  default: client
});

// define the server side action handlers.
const actions$2 = {
  v0: {
    counter: {
      down: (req, res) => {
        res.send(-1);
      },
      down10: (req, res) => {
        res.send(-10);
      },
      up: (req, res) => {
        res.send(1);
      },
      up10: (req, res) => {
        res.send(10);
      },
    },
  },
};

// gather settings for the servers.
// these are the default settings and could be omitted.
const props = {
  actions: actions$2,
  client: client$1,
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
};

// start websockets and http server
init$1(props);
//# sourceMappingURL=server.js.map
