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
 * Traverses through a {@link Fiber}, return `true` to halt. `ascending` is true by default.
 */
export function __unsafe_traverse_fiber(fiber: Fiber, selector: FiberSelector, ascending = true): Fiber | undefined {
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
 * Returns the nearest {@link Fiber} instance. Pass `true` to `parent` to search upwards.
 */
export function useInstance<T = any>(parent: boolean = false): React.MutableRefObject<T | undefined> {
  const fiber = useFiber()
  const instance = React.useRef<T>()

  React.useLayoutEffect(() => {
    instance.current = __unsafe_traverse_fiber(
      fiber,
      (node) => node.stateNode != null && !(node.stateNode instanceof React.Component),
      parent,
    )?.stateNode
  }, [fiber, parent])

  return instance
}
