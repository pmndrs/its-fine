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
 * Traverses through a {@link Fiber}, return `true` to stop traversing.
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
    () => traverseFiber(fiber, true, (node) => node.type == null && node.stateNode.containerInfo != null)!.stateNode,
    [fiber],
  )

  return container
}

/**
 * Returns the nearest react-reconciler child instance.
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
 * Returns the nearest react-reconciler parent instance.
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
 * Represents a react-context bridge component.
 */
export type ContextBridge = React.FC<React.PropsWithChildren<{}>>

/**
 * Returns a {@link ContextBridge} of live context providers to pierce context across renderers.
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
