# its-fine

A collection of escape hatches for React.

![](.github/itsfine.png)

This a growing exploration of `React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`. As such you will be able to betray Reacts component abstraction, like injecting a context, or accessing the nearest parent of your component. I'm sure you want me to tell you how safe and stable this all is.

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

Returns the current react-reconciler `Container`.

```tsx
import * as React from 'react'
import { useContainer } from 'its-fine'

function Component() {
  const container = useContainer()

  React.useLayoutEffect(() => {
    // Zustand store (e.g. R3F)
    console.log(container.containerInfo.getState())
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
    // { type: 'primitive', props: {}, children: [] } (e.g. react-nil)
    console.log(childRef.current)
  }, [])

  return <primitive />
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
    // { type: 'primitive', props: {}, children: [] } (e.g. react-nil)
    console.log(parentRef.current)
  }, [])

  return null
}

export default () => (
  <primitive>
    <Component />
  </primitive>
)
```

### useContextBridge

Returns a `ContextBridge` of live context providers to pierce context across renderers.

```tsx
import * as React from 'react'
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
