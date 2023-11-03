import { useRef, useState, useMemo, createElement } from 'react'
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
 * Traverses up or down a {@link Fiber}, return `true` to stop and select a node.
 */
export function traverse(
  /** Input {@link Fiber} to traverse. */
  fiber: Fiber,
  /** A {@link Fiber} node selector, returns the first match when `true` is passed. */
  selector: FiberSelector,
  /** Whether to ascend and walk up the tree. Will walk down if `false`. Default is `false`. */
  ascending: boolean,
): Fiber | undefined {
  if (!fiber || selector(fiber)) return fiber

  let child = ascending ? fiber.return : fiber.child
  while (child) {
    const match = traverse(child, selector, ascending)
    if (match) return match

    child = ascending ? null : child.sibling
  }
}

/**
 * Returns the current react-internal {@link Fiber}. This is an implementation detail of [react-reconciler](https://github.com/facebook/react/tree/main/packages/react-reconciler).
 */
export function useFiber(): Fiber {
  const fiber = useRef<Fiber>()

  useState(() => {
    const bind = Function.prototype.bind
    Function.prototype.bind = function (self, maybeFiber) {
      if (self === null && typeof maybeFiber?.type === 'function') {
        fiber.current = maybeFiber
        Function.prototype.bind = bind
      }
      return bind.apply(this, arguments as any)
    }
  })

  return fiber.current!
}

/**
 * Represents a react-context bridge provider component.
 */
export type ContextBridge = React.FC<React.PropsWithChildren<{}>>

/**
 * React Context currently cannot be shared across [React renderers](https://reactjs.org/docs/codebase-overview.html#renderers) but explicitly forwarded between providers (see [react#17275](https://github.com/facebook/react/issues/17275)). This hook returns a {@link ContextBridge} of live context providers to pierce Context across renderers.
 *
 * Pass {@link ContextBridge} as a component to a secondary renderer to enable context-sharing within its children.
 */
export function useContextBridge(): ContextBridge {
  const fiber = useFiber()
  const [contextMap] = useState(() => new Map<React.Context<any>, any>())

  // Collect live context
  contextMap.clear()
  traverse(
    fiber,
    (node) => {
      const context = node.type?._context
      if (context && !contextMap.has(context)) {
        contextMap.set(context, context._currentValue)
      }
    },
    true,
  )

  // Flatten context and their memoized values into a `ContextBridge` provider
  return useMemo(
    () =>
      ({ children }) => {
        for (const [context, value] of contextMap) {
          children = createElement(context.Provider, { value }, children)
        }
        return children as any
      },
    [contextMap],
  )
}
