import { h } from 'hyperapp'
import { mapActions } from '@hypercnt/client'

// just a usual hyperapp state
export const state = {
  counter: {
    value: 0,
  },
}

// just usual hyperapp actions.
// careful, remote actions overwrite actions.
export const local = {
  local: val => () => ({ input: val }),
  counter: {
    up20: () => ({ value }) => ({ value: value + 20 }),
  },
}

// remote actions first get wrapped to allow server roundtrips
// and then merged into the actions
export const remote = {
  counter: {
    down: ({ data }) => ({ value }) => ({ value: value + data }),
    down10: ({ data }) => ({ value }) => ({ value: value + data }),
    up: ({ data }) => ({ value }) => ({ value: value + data }),
    up10: ({ data }) => ({ value }) => ({ value: value + data }),
  },
}

// create the actions
export const actions = mapActions(local, remote)

// just a usual hyperapp view
export const view = (state, actions) => (
  <div>
    <h1>{state.counter.value}</h1>

    <div>{JSON.stringify(state)}</div>

    <button onclick={actions.counter.up}>+</button>
    <button onclick={actions.counter.up10}>+10</button>
    <button onclick={actions.counter.up20}>+20</button>

    <button onclick={actions.counter.down}>-</button>
    <button onclick={actions.counter.down10}>-10</button>

    <input type="text" onkeyup={e => actions.local(e.target.value)} />
    <span>text, no server roundtrip: {state.input}</span>
  </div>
)

export default {
  state,
  actions,
  view,
}
