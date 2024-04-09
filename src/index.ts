import {
  type MutableRefObject,
  type Context,
  type FC,
  type PropsWithChildren,
  useLayoutEffect,
  useEffect,
  Fragment,
  useRef,
  useState,
  useMemo,
  createElement,
} from 'react'
import type ReactReconciler from 'react-reconciler'

/**
 * An SSR-friendly useLayoutEffect.
 *
 * React currently throws a warning when using useLayoutEffect on the server.
 * To get around it, we can conditionally useEffect on the server (no-op) and
 * useLayoutEffect elsewhere.
 *
 * @see https://github.com/facebook/react/issues/14927
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' && (window.document?.createElement || window.navigator?.product === 'ReactNative')
    ? useLayoutEffect
    : useEffect

/**
 * Represents a react-internal Fiber node.
 */
export type Fiber<T = any> = Omit<ReactReconciler.Fiber, 'stateNode'> & { stateNode: T }

/**
 * Represents a {@link Fiber} node selector for traversal.
 */
export type FiberSelector<T = any> = (
  /** The current {@link Fiber} node. */
  node: Fiber<T | null>,
) => boolean | void

/**
 * Traverses up or down a {@link Fiber}, return `true` to stop and select a node.
 */
export function traverseFiber<T = any>(
  /** Input {@link Fiber} to traverse. */
  fiber: Fiber | undefined,
  /** Whether to ascend and walk up the tree. Will walk down if `false`. */
  ascending: boolean,
  /** A {@link Fiber} node selector, returns the first match when `true` is passed. */
  selector: FiberSelector<T>,
): Fiber<T> | undefined {
  if (!fiber) return
  if (selector(fiber) === true) return fiber

  let child = ascending ? fiber.return : fiber.child
  while (child) {
    const match = traverseFiber(child, ascending, selector)
    if (match) return match

    child = ascending ? null : child.sibling
  }
}

/**
 * @deprecated since v1.2.0.
 */
export const FiberProvider = Fragment

/**
 * Returns the current react-internal {@link Fiber}. This is an implementation detail of [react-reconciler](https://github.com/facebook/react/tree/main/packages/react-reconciler).
 */
export function useFiber(): Fiber<null> | undefined {
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

  return fiber.current
}

/**
 * Represents a react-reconciler container instance.
 */
export interface ContainerInstance<T = any> {
  containerInfo: T
}

/**
 * Returns the current react-reconciler container info passed to {@link ReactReconciler.Reconciler.createContainer}.
 *
 * In react-dom, a container will point to the root DOM element; in react-three-fiber, it will point to the root Zustand store.
 */
export function useContainer<T = any>(): T | undefined {
  const fiber = useFiber()
  const root = useMemo(
    () => traverseFiber<ContainerInstance<T>>(fiber, true, (node) => node.stateNode?.containerInfo != null),
    [fiber],
  )

  return root?.stateNode.containerInfo
}

/**
 * Returns the nearest react-reconciler child instance or the node created from {@link ReactReconciler.HostConfig.createInstance}.
 *
 * In react-dom, this would be a DOM element; in react-three-fiber this would be an instance descriptor.
 */
export function useNearestChild<T = any>(
  /** An optional element type to filter to. */
  type?: keyof JSX.IntrinsicElements,
): MutableRefObject<T | undefined> {
  const fiber = useFiber()
  const childRef = useRef<T>()

  useIsomorphicLayoutEffect(() => {
    childRef.current = traverseFiber<T>(
      fiber,
      false,
      (node) => typeof node.type === 'string' && (type === undefined || node.type === type),
    )?.stateNode
  }, [fiber])

  return childRef
}

/**
 * Returns the nearest react-reconciler parent instance or the node created from {@link ReactReconciler.HostConfig.createInstance}.
 *
 * In react-dom, this would be a DOM element; in react-three-fiber this would be an instance descriptor.
 */
export function useNearestParent<T = any>(
  /** An optional element type to filter to. */
  type?: keyof JSX.IntrinsicElements,
): MutableRefObject<T | undefined> {
  const fiber = useFiber()
  const parentRef = useRef<T>()

  useIsomorphicLayoutEffect(() => {
    parentRef.current = traverseFiber<T>(
      fiber,
      true,
      (node) => typeof node.type === 'string' && (type === undefined || node.type === type),
    )?.stateNode
  }, [fiber])

  return parentRef
}

export type ContextMap = Map<Context<any>, any> & {
  get<T>(context: Context<T>): T | undefined
}

/**
 * Returns a map of all contexts and their values.
 */
export function useContextMap(): ContextMap {
  const fiber = useFiber()
  const [contextMap] = useState(() => new Map<Context<any>, any>())

  // Collect live context
  contextMap.clear()
  let node = fiber
  while (node) {
    if (node.type && typeof node.type === 'object') {
      // https://github.com/facebook/react/pull/28226
      const enableRenderableContext = node.type._context === undefined && node.type.Provider === node.type
      const context = enableRenderableContext ? node.type : node.type._context
      if (context && !contextMap.has(context)) {
        contextMap.set(context, context._currentValue)
      }
    }

    node = node.return!
  }

  return contextMap
}

/**
 * Represents a react-context bridge provider component.
 */
export type ContextBridge = FC<PropsWithChildren<{}>>

/**
 * React Context currently cannot be shared across [React renderers](https://reactjs.org/docs/codebase-overview.html#renderers) but explicitly forwarded between providers (see [react#17275](https://github.com/facebook/react/issues/17275)). This hook returns a {@link ContextBridge} of live context providers to pierce Context across renderers.
 *
 * Pass {@link ContextBridge} as a component to a secondary renderer to enable context-sharing within its children.
 */
export function useContextBridge(): ContextBridge {
  const contextMap = useContextMap()

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
