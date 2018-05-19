var app = (function (exports) {
  'use strict';

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

    function set(path, value, source) {
      var target = {};
      if (path.length) {
        target[path[0]] =
          path.length > 1 ? set(path.slice(1), value, source[path[0]]) : value;
        return clone(source, target)
      }
      return value
    }

    function get(path, source) {
      var i = 0;
      while (i < path.length) {
        source = source[path[i++]];
      }
      return source
    }

    function wireStateToActions(path, state, actions) {
      for (var key in actions) {
        typeof actions[key] === "function"
          ? (function(key, action) {
              actions[key] = function(data) {
                var result = action(data);

                if (typeof result === "function") {
                  result = result(get(path, globalState), actions);
                }

                if (
                  result &&
                  result !== (state = get(path, globalState)) &&
                  !result.then // !isPromise
                ) {
                  scheduleRender(
                    (globalState = set(path, clone(state, result), globalState))
                  );
                }

                return result
              };
            })(key, actions[key])
          : wireStateToActions(
              path.concat(key),
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
      if (name === "key") {
      } else if (name === "style") {
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
      if (node === oldNode) {
      } else if (oldNode == null || oldNode.nodeName !== node.nodeName) {
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

  const error = (...msg) => console.error(...msg);

  const isString = o => typeof o === 'string';

  const parse = msg => {
    if (!isString(msg)) {
      return msg
    }

    try {
      return JSON.parse(msg)
    } catch (e) {
      return msg
    }
  };

  const stringify = msg => {
    try {
      if (isString(msg)) {
        return msg
      }

      return JSON.stringify(msg)
    } catch (e) {
      error(e);
    }
  };

  let ws = undefined;

  const cache = [];
  let open = false;
  let apiVersion = 'v0';

  const isFunction = o => typeof o === 'function';

  const reactions = {
    onmessage: actions => e => {
      if (e.data === 'Unknown Action') {
        error('Unknown Action', e);
        return
      }

      const [path, data] = parse(e.data);

      let action = actions;

      path.split('.').forEach(key => {
        const fnName = `${key}_done`;
        const sub = action[fnName];
        if (isFunction(sub)) {
          action = sub;
        } else {
          action = action[key];
        }
      });

      if (isFunction(action)) {
        return action(data)
      }
    },
    open: () => {
      open = true;

      while (cache.length) {
        const msg = cache.shift();
        ws.send(stringify(msg));
      }
    },
  };

  const retryConnect = (url, actions, wait = 1000) =>
    new Promise(resolve => {
      if (open && ws) {
        return ws
      }

      wait += 500;
      setTimeout(() => {
        createSocket(url, actions);
        resolve();
      }, wait);
    });

  const createSocket = (url, actions) => {
    open = false;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      // implement client error logging actions
    }

    ws.onopen = reactions.open;
    ws.onmessage = reactions.onmessage(actions);

    ws.onclose = () => {
      open = false;
      retryConnect(url, actions);
    };
  };

  const connect = (actions, options = {}) => {
    const host = options.host || location.hostname;
    const port = options.port || location.port;
    const protocol = options.protocol || 'ws';

    apiVersion = options.apiVersion || apiVersion || 'v0';

    createSocket(`${protocol}://${host}:${port}`, actions);

    return ws
  };

  const send = msg => {
    if (open && ws) {
      if (typeof msg[0] === 'string') {
        msg[0] = `${apiVersion}.${msg[0]}`;
      }
      ws.send(stringify(msg));
    } else {
      cache.push(msg);
    }
  };

  const mapActions = (actions = {}, remote = {}, parent = null) => {
    Object.keys(remote).forEach(name => {
      const action = remote[name];
      const key = parent ? `${parent}.${name}` : name;

      if (typeof action === 'function') {
        actions[name + '_done'] = (res) => (state, actions) => {
          if (!res.ok && typeof res === 'undefined') {
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
        actions[name] = mapActions(actions[name], action, key);
        return
      }
    });

    return actions
  };

  // just a usual hyperapp state
  var state$1 = {
    counter: {
      value: 0
    }

    // just usual hyperapp actions.
    // careful, remote actions overwrite actions.
  };var local = {
    local: function local(val) {
      return function () {
        return { input: val };
      };
    },
    counter: {
      up20: function up20() {
        return function (_ref) {
          var value = _ref.value;
          return { value: value + 20 };
        };
      }
    }

    // remote actions first get wrapped to allow server roundtrips
    // and then merged into the actions
  };var remote = {
    counter: {
      down: function down(res) {
        return function (state$$1) {
          return console.log({ res: res }) || { value: state$$1.value + res };
        };
      },
      down10: function down10(res) {
        return function (state$$1) {
          return { value: state$$1.value + res };
        };
      },
      up: function up(res) {
        return function (state$$1) {
          return { value: state$$1.value + res };
        };
      },
      up10: function up10(res) {
        return function (state$$1) {
          return { value: state$$1.value + res };
        };
      }
    }

    // create the actions
  };var actions$1 = mapActions(local, remote);

  // just a usual hyperapp view
  var view = function view(state$$1, actions$$1) {
    return h('div', null, [h('h1', null, [state$$1.counter.value]), h('div', null, [JSON.stringify(state$$1)]), h('button', { onclick: actions$$1.counter.up }, ["+"]), h('button', { onclick: actions$$1.counter.up10 }, ["+10"]), h('button', { onclick: actions$$1.counter.up20 }, ["+20"]), h('button', { onclick: actions$$1.counter.down }, ["-"]), h('button', { onclick: actions$$1.counter.down10 }, ["-10"]), h('input', { type: "text", onkeyup: function onkeyup(e) {
        return actions$$1.local(e.target.value);
      } }), h('span', null, ["text, no server roundtrip: ", state$$1.input])]);
  };

  var connected = app(state$1, actions$1, view, document.body);

  // socket server connection options
  var options = {
    host: 'localhost',
    protocol: 'ws',
    port: 3001

    // wires the app and mounts it.
  };var ws$1 = connect(connected, options);

  exports.connected = connected;
  exports.ws = ws$1;

  return exports;

}({}));
//# sourceMappingURL=bundle.js.map
