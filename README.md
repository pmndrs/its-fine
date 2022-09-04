# its-fine

A collection of react-internal hooks and utils.

![](.github/itsfine.png)

This a growing exploration of `React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED`. As such you will be able to betray Reacts component abstraction, like injecting a context, or accessing the nearest parent of your component. I'm sure you want me to tell you how safe and stable this all is.

### useFiber

Returns the current react-internal `Fiber`.

```tsx
function Component() {
  const fiber = useFiber()

  React.useLayoutEffect(() => {
    console.log(fiber.type) // function Component
  }, [fiber])
}
```

### useContainer

Returns the current react-reconciler `Container`.

```tsx
function Component() {
  const container = useContainer()

  React.useLayoutEffect(() => {
    console.log(container.containerInfo.getState()) // Zustand store (e.g. R3F)
  }, [container])
}
```

### useNearestChild

Returns the nearest react-reconciler child instance.

```tsx
function Component() {
  const childRef = useNearestChild()

  React.useLayoutEffect(() => {
    console.log(childRef.current) // { type: 'primitive', props: {}, children: [] } (e.g. react-nil)
  }, [])

  return <primitive />
}
```

### useNearestParent

Returns the nearest react-reconciler parent instance.

```tsx
function Component() {
  const parentRef = useNearestParent()

  React.useLayoutEffect(() => {
    console.log(parentRef.current) // { type: 'primitive', props: {}, children: [] } (e.g. react-nil)
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
function Canvas(props: { children: React.ReactNode }) {
  const Bridge = useContextBridge()
  render(<Bridge>{props.children}</Bridge>)
  return null
}

ReactDOM.createRoot(window.root).render(
  <Providers>
    <Canvas />
  </Providers>,
)
```

### traverseFiber

Traverses through a `Fiber`, return `true` to halt.

```ts
const ascending = true
const prevElement = traverseFiber(fiber, ascending, (node) => node.type === 'element')
```
