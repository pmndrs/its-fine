import * as React from 'react'
import type Reconciler from 'react-reconciler'

/**
 * Represents a react-internal Fiber node.
 */
export type Fiber = Reconciler.Fiber

/**
 * Represents a {@link Fiber} node selector for traversal.
 */
export type FiberSelector = (node: Fiber) => boolean | void

/**
 * Traverses through a {@link Fiber}, return `true` to halt. `ascending` is `false` by default.
 */
export function __unsafe_traverse_fiber(fiber: Fiber, selector: FiberSelector, ascending = false): Fiber | undefined {
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
 * Returns the current react-internal {@link Fiber}.
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
export interface Container<T = {}> {
  containerInfo: T
}

/**
 * Returns the nearest reconciler {@link Container}.
 */
export function useNearestContainer<T = any>(): React.MutableRefObject<Container<T> | undefined> {
  const fiber = useFiber()
  const container = React.useRef<Container<T>>(null!)

  React.useLayoutEffect(() => {
    container.current = __unsafe_traverse_fiber(
      fiber,
      (node) => node.stateNode != null && node.stateNode.containerInfo != null,
      true,
    )?.stateNode
  }, [fiber])

  return container
}

/**
 * Returns the nearest reconciler instance. Pass `true` to `ascending` to search upwards.
 */
export function useNearestInstance<T = any>(ascending: boolean = false): React.MutableRefObject<T | undefined> {
  const fiber = useFiber()
  const instance = React.useRef<T>()

  React.useLayoutEffect(() => {
    instance.current = __unsafe_traverse_fiber(
      fiber,
      (node) =>
        node.stateNode != null &&
        !(node.stateNode instanceof React.Component) &&
        node.stateNode.containerInfo === undefined,
      ascending,
    )?.stateNode
  }, [fiber, ascending])

  return instance
}
