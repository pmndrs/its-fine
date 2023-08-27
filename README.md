# its-fine

[![Size](https://img.shields.io/bundlephobia/minzip/its-fine?label=gzip&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/package/its-fine)
[![Version](https://img.shields.io/npm/v/its-fine?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/its-fine)
[![Downloads](https://img.shields.io/npm/dt/its-fine.svg?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/its-fine)
[![Twitter](https://img.shields.io/twitter/follow/pmndrs?label=%40pmndrs&style=flat&colorA=000000&colorB=000000&logo=twitter&logoColor=000000)](https://twitter.com/pmndrs)
[![Discord](https://img.shields.io/discord/740090768164651008?style=flat&colorA=000000&colorB=000000&label=discord&logo=discord&logoColor=000000)](https://discord.gg/poimandres)

<p align="left">
  <a id="cover" href="#cover">
    <img src=".github/itsfine.jpg" alt="It's gonna be alright" />
  </a>
</p>

A collection of low-level escape hatches for React.

As such, you can go beyond React's component abstraction; components are self-aware and can tap into the [React Fiber](https://youtu.be/ZCuYPiUIONs) tree. This enables powerful abstractions that can modify or extend React behavior without explicitly taking reconciliation into your own hands.

## useFiber

Returns the current react-internal `Fiber`. This is an implementation detail of [react-reconciler](https://github.com/facebook/react/tree/main/packages/react-reconciler).

```tsx
import { type Fiber, useFiber } from 'its-fine'

function Component() {
  // Returns the current component's react-internal Fiber
  const fiber: Fiber = useFiber()

  // function Component() {}
  console.log(fiber.type)
}
```

## useContextBridge

React Context currently cannot be shared across [React renderers](https://reactjs.org/docs/codebase-overview.html#renderers) but explicitly forwarded between providers (see [react#17275](https://github.com/facebook/react/issues/17275)). This hook returns a `ContextBridge` of live context providers to pierce Context across renderers.

Pass `ContextBridge` as a component to a secondary renderer to enable context-sharing within its children.

```tsx
import * as React from 'react'
// react-nil is a secondary renderer that is usually used for testing.
// This also includes Fabric, react-three-fiber, etc
import * as ReactNil from 'react-nil'
// react-dom is a primary renderer that works on top of a secondary renderer.
// This also includes react-native, react-pixi, etc.
import * as ReactDOM from 'react-dom/client'
import { type ContextBridge, useContextBridge } from 'its-fine'

function Canvas(props: { children: React.ReactNode }) {
  // Returns a bridged context provider that forwards context
  const Bridge: ContextBridge = useContextBridge()
  // Renders children with bridged context into a secondary renderer
  ReactNil.render(<Bridge>{props.children}</Bridge>)
}

// A React Context whose provider lives in react-dom
const DOMContext = React.createContext<string>(null!)

// A component that reads from DOMContext
function Component() {
  // "Hello from react-dom"
  console.log(React.useContext(DOMContext))
}

// Renders into a primary renderer like react-dom or react-native,
// DOMContext wraps Canvas and is bridged into Component
ReactDOM.createRoot(document.getElementById('root')!).render(
  <DOMContext.Provider value="Hello from react-dom">
    <Canvas>
      <Component />
    </Canvas>
  </DOMContext.Provider>,
)
```

## traverse

Traverses up or down a `Fiber`, return `true` to stop and select a node.

```ts
import { type Fiber, traverse } from 'its-fine'

// Traverses down the Fiber tree, returns the current node when `true` is passed via selector
const parentDiv: Fiber | undefined = traverse(
  // Input Fiber to traverse.
  fiber as Fiber,
  // A Fiber node selector, returns the first match when `true` is passed.
  (node: Fiber) => node.type === 'div',
  // Whether to ascend and walk up the tree. Will walk down if `false`. Default is `false`.
  false,
)
```
