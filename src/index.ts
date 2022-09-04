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
export function traverseFiber(fiber: Fiber, selector: FiberSelector, ascending = false): Fiber | undefined {
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
 * Returns the current react-reconciler {@link Container}.
 */
export function useContainer<T = any>(): Container<T> {
  const fiber = useFiber()
  const container = React.useMemo(
    () =>
      traverseFiber(
        fiber,
        (node) => node.type == null && node.stateNode != null && node.stateNode.containerInfo != null,
        true,
      )!.stateNode,
    [fiber],
  )

  return container
}

/**
 * Returns the nearest react-reconciler instance. Pass `true` to `ascending` to search upwards.
 */
export function useNearestInstance<T = any>(ascending: boolean = false): React.MutableRefObject<T | undefined> {
  const fiber = useFiber()
  const instance = React.useRef<T>()

  React.useLayoutEffect(() => {
    instance.current = traverseFiber(fiber, (node) => typeof node.type === 'string', ascending)?.stateNode
  }, [fiber, ascending])

  return instance
}
