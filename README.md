# its-fine

![](.github/itsfine.png)

A collection of escape hatches exploring `React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`. As such you will be able to betray Reacts component abstraction, like injecting context into a foreign React root, or accessing the nearest parent of your component. I'm sure you want me to tell you how safe and stable this all is.

### useFiber

Returns the current react-internal `Fiber`.

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

Returns the current react-reconciler `Container`, which is the fiber accociated with the object given to `Reconciler.createContainer`. In react-dom `container.containerInfo` will point to the root DOM element. In react-three-fiber `container.containerInfo` will point to the zustand state.

```tsx
import * as React from 'react'
import { useContainer } from 'its-fine'

function Component() {
  const container = useContainer()

  React.useLayoutEffect(() => {
    console.log(container.containerInfo)
  }, [container])
}
```

### useNearestChild

Returns the nearest react-reconciler child instance.

```tsx
import * as React from 'react'
import { useNearestChild } from 'its-fine'

function Component() {
  const childRef = useNearestChild()

  React.useLayoutEffect(() => {
    console.log(childRef.current) // <div> (e.g. react-dom)
  }, [])

  return <div />
}
```

### useNearestParent

Returns the nearest react-reconciler parent instance.

```tsx
import * as React from 'react'
import { useNearestParent } from 'its-fine'

function Component() {
  const parentRef = useNearestParent()

  React.useLayoutEffect(() => {
    console.log(parentRef.current) // <div> (e.g. react-dom)
  }, [])

  return null
}

export default () => (
  <div>
    <Component />
  </div>
)
```

### useContextBridge

React context [cannot be shared](https://github.com/pmndrs/react-three-fiber/issues/43) among multiple React roots. If you wanted to use, for instance, react-router (redux etc) in a secondary renderer, like react-three-fiber, you needed to be able to access the original context first and then [forward it](https://docs.pmnd.rs/react-three-fiber/advanced/gotchas#consuming-context-from-a-foreign-provider).

This cumbersome practice ends here. `useContextBridge` returns a `ContextBridge` of live context providers to pierce context across renderers. Render it as the first element in your custom React renderer and its contents will be able to access host context.

```tsx
import * as React from 'react'
// react-nil is a custom React-renderer, usually used for testing
import * as ReactNil from 'react-nil'
import * as ReactDOM from 'react-dom/client'
import { useContextBridge } from 'its-fine'

function Canvas(props: { children: React.ReactNode }) {
  const Bridge = useContextBridge()
  ReactNil.render(<Bridge>{props.children}</Bridge>)
  return null
}

ReactDOM.createRoot(window.root).render(
  <Providers>
    <Canvas />
  </Providers>,
)
```

### traverseFiber

Traverses through a `Fiber`, return `true` to stop traversing.

```ts
import { type Fiber, traverseFiber } from 'react-nil'

const ascending = true
const prevElement: Fiber = traverseFiber(fiber, ascending, (node: Fiber) => node.type === 'element')
```
