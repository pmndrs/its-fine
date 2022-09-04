# its-fine

[![Size](https://img.shields.io/bundlephobia/minzip/its-fine?label=gzip&style=flat&colorA=000000&colorB=000000)](https://bundlephobia.com/package/its-fine)
[![Version](https://img.shields.io/npm/v/its-fine?style=flat&colorA=000000&colorB=000000)](https://npmjs.com/package/its-fine)
[![Twitter](https://img.shields.io/twitter/follow/pmndrs?label=%40pmndrs&style=flat&colorA=000000&colorB=000000&logo=twitter&logoColor=000000)](https://twitter.com/pmndrs)
[![Discord](https://img.shields.io/discord/740090768164651008?style=flat&colorA=000000&colorB=000000&label=discord&logo=discord&logoColor=000000)](https://discord.gg/poimandres)

<p align="left">
  <a id="cover" href="#cover">
    <img src=".github/itsfine.png" alt="It's gonna be alright" />
  </a>
</p>

A collection of escape hatches exploring `React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED` and React Fiber. As such, you can go beyond React's component abstraction, enabling stateless queries to access elements outside your component or share context across renderers.

## Table of Contents

- [Installation](#installation)
- [Hooks](#hooks)
  - [useFiber](#useFiber)
  - [useContainer](#useContainer)
  - [useNearestChild](#useNearestChild)
  - [useNearestParent](#useNearestParent)
  - [useContextBridge](#useContextBridge)
- [Utils](#utils)
  - [traverseFiber](#traverseFiber)

## Installation

```bash
# NPM
npm install its-fine
# Yarn
yarn add its-fine
# PNPM
pnpm add its-fine
```

## Hooks

Useful React hook abstractions for manipulating and querying from a component.

### useFiber

Returns the current react-internal `Fiber`. This is an implementation detail of react-reconciler.

```tsx
import * as React from 'react'
import { type Fiber, useFiber } from 'its-fine'

function Component() {
  const fiber: Fiber = useFiber()

  React.useLayoutEffect(() => {
    // function Component() {}
    console.log(fiber.type)
  }, [fiber])
}
```

### useContainer

Returns the current react-reconciler `Container` or the Fiber created from `Reconciler.createContainer`.

In react-dom, `container.containerInfo` will point to the root DOM element; in react-three-fiber, it will point to the root Zustand store.

```tsx
import * as React from 'react'
import { useContainer } from 'its-fine'

function Component() {
  const container = useContainer<HTMLDivElement>()

  React.useLayoutEffect(() => {
    // <div> (e.g. react-dom)
    console.log(container.containerInfo)
  }, [container])
}
```

### useNearestChild

Returns the nearest react-reconciler child instance or the node created from `Reconciler.createInstance`.

In react-dom, this would be a DOM element; in react-three-fiber this would be an `Instance` descriptor.

```tsx
import * as React from 'react'
import { useNearestChild } from 'its-fine'

function Component() {
  const childRef = useNearestChild<HTMLDivElement>()

  React.useLayoutEffect(() => {
    // <div> (e.g. react-dom)
    console.log(childRef.current)
  }, [])

  return <div />
}
```

### useNearestParent

Returns the nearest react-reconciler parent instance or the node created from `Reconciler.createInstance`.

In react-dom, this would be a DOM element; in react-three-fiber this would be an instance descriptor.

```tsx
import * as React from 'react'
import { useNearestParent } from 'its-fine'

function Component() {
  const parentRef = useNearestParent<HTMLDivElement>()

  React.useLayoutEffect(() => {
    // <div> (e.g. react-dom)
    console.log(parentRef.current)
  }, [])
}

export default () => (
  <div>
    <Component />
  </div>
)
```

### useContextBridge

React Context currently cannot be shared across [React renderers](https://reactjs.org/docs/codebase-overview.html#renderers) but explicitly forwarded between providers (see [react#17275](https://github.com/facebook/react/issues/17275)). This hook returns a `ContextBridge` of live context providers to pierce Context across renderers.

Pass `ContextBridge` as a component to a secondary renderer to enable context-sharing within its children.

```tsx
import * as React from 'react'
// react-nil is a custom React renderer, usually used for testing.
// This also works with react-art, react-three-fiber, etc
import * as ReactNil from 'react-nil'
import * as ReactDOM from 'react-dom/client'
import { useContextBridge } from 'its-fine'

function Canvas(props: { children: React.ReactNode }) {
  const Bridge = useContextBridge()
  ReactNil.render(<Bridge>{props.children}</Bridge>)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <Providers>
    <Canvas />
  </Providers>,
)
```

## Utils

Additional exported utility functions for raw handling of Fibers.

### traverseFiber

Traverses up or down through a `Fiber`, return `true` to stop and select a node.

```ts
import { type Fiber, traverseFiber } from 'its-fine'

const ascending = true
const prevElement: Fiber = traverseFiber(fiber, ascending, (node: Fiber) => node.type === 'element')
```
