import * as React from 'react'
import type ReactReconciler from 'react-reconciler'

/**
 * Represents a react-internal Fiber node.
 */
export type Fiber = ReactReconciler.Fiber

/**
 * Represents a {@link Fiber} node selector for traversal.
 */
export type FiberSelector = (node: Fiber) => boolean | void

/**
 * Traverses up or down through a {@link Fiber}, return `true` to stop and select a node.
 */
export function traverseFiber(fiber: Fiber, ascending: boolean, selector: FiberSelector): Fiber | undefined {
  let halted = false
  let selected: Fiber | undefined

  let node = fiber[ascending ? 'return' : 'child']
  let sibling = fiber.sibling
  while (node) {
    while (sibling) {
      halted ||= !!selector(sibling)
      if (halted) {
        selected = sibling
        break
      }

      sibling = sibling.sibling
    }

    halted ||= !!selector(node)
    if (halted) {
      selected = node
      break
    }

    node = node[ascending ? 'return' : 'child']
  }

  return selected
}

declare module 'react' {
  namespace __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED {
    const ReactCurrentOwner: React.RefObject<Fiber>
  }
}

/**
 * Returns the current react-internal {@link Fiber}. This is an implementation detail of react-reconciler.
 */
export function useFiber(): Fiber {
  const [fiber] = React.useState<Fiber>(
    () => React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner.current!,
  )
  return fiber
}

/**
 * Represents a reconciler container.
 */
export interface Container<T = {}> extends Fiber {
  containerInfo: T
}

/**
 * Returns the current react-reconciler {@link Container} or the Fiber created from {@link ReactReconciler.Reconciler.createContainer}.
 *
 * In react-dom, {@link Container.containerInfo} will point to the root DOM element; in react-three-fiber, it will point to the root Zustand store.
 */
export function useContainer<T = any>(): Container<T> {
  const fiber = useFiber()
  const container = React.useMemo(
    () => traverseFiber(fiber, true, (node) => node.type == null && node.stateNode.containerInfo != null)!.stateNode,
    [fiber],
  )

  return container
}

/**
 * Returns the nearest react-reconciler child instance or the node created from {@link ReactReconciler.HostConfig.createInstance}.
 *
 * In react-dom, this would be a DOM element; in react-three-fiber this would be an instance descriptor.
 */
export function useNearestChild<T = any>(): React.MutableRefObject<T | undefined> {
  const fiber = useFiber()
  const instance = React.useRef<T>()

  React.useLayoutEffect(() => {
    instance.current = traverseFiber(fiber, false, (node) => typeof node.type === 'string')?.stateNode
  }, [fiber])

  return instance
}

/**
 * Returns the nearest react-reconciler parent instance or the node created from {@link ReactReconciler.HostConfig.createInstance}.
 *
 * In react-dom, this would be a DOM element; in react-three-fiber this would be an instance descriptor.
 */
export function useNearestParent<T = any>(): React.MutableRefObject<T | undefined> {
  const fiber = useFiber()
  const instance = React.useRef<T>()

  React.useLayoutEffect(() => {
    instance.current = traverseFiber(fiber, true, (node) => typeof node.type === 'string')?.stateNode
  }, [fiber])

  return instance
}

/**
 * Represents a react-context bridge provider component.
 */
export type ContextBridge = React.FC<React.PropsWithChildren<{}>>

/**
 * React Context currently cannot be shared across renderers but explicitly forwarded between providers (see [react#17275](https://github.com/facebook/react/issues/17275)). This hook returns a {@link ContextBridge} of live context providers to pierce Context across renderers.
 *
 * Pass {@link ContextBridge} as a component to a secondary renderer to enable context-sharing within its children.
 */
export function useContextBridge(): ContextBridge {
  const fiber = useFiber()
  const contexts = React.useMemo(() => {
    const unique = new Set<React.Context<any>>()

    traverseFiber(fiber, true, (node) => {
      const context = node.type?._context
      if (context && !unique.has(context)) unique.add(context)
    })

    return Array.from(unique)
  }, [fiber])

  return contexts.reduce(
    (Prev, context) => {
      const value = React.useContext(context)
      return (props) => (
        <Prev>
          <context.Provider {...props} value={value} />
        </Prev>
      )
    },
    (props) => <React.Fragment {...props} />,
  )
}
