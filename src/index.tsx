import React from 'react'
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
const useIsomorphicLayoutEffect = /* @__PURE__ */ (() =>
  typeof window !== 'undefined' && (window.document?.createElement || window.navigator?.product === 'ReactNative'))()
  ? React.useLayoutEffect
  : React.useEffect

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

// In development, React will warn about using contexts between renderers.
// Hide the warning because its-fine fixes this issue
// https://github.com/facebook/react/pull/12779
function wrapContext<T>(context: React.Context<T>): React.Context<T> {
  try {
    return Object.defineProperties(context, {
      _currentRenderer: {
        get() {
          return null
        },
        set() {},
      },
      _currentRenderer2: {
        get() {
          return null
        },
        set() {},
      },
    })
  } catch (_) {
    return context
  }
}

const FiberContext = /* @__PURE__ */ wrapContext(/* @__PURE__ */ React.createContext<Fiber>(null!))

/**
 * A react-internal {@link Fiber} provider. This component binds React children to the React Fiber tree. Call its-fine hooks within this.
 */
export class FiberProvider extends React.Component<{ children?: React.ReactNode }> {
  private _reactInternals!: Fiber

  render() {
    return <FiberContext.Provider value={this._reactInternals}>{this.props.children}</FiberContext.Provider>
  }
}

/**
 * Returns the current react-internal {@link Fiber}. This is an implementation detail of [react-reconciler](https://github.com/facebook/react/tree/main/packages/react-reconciler).
 */
export function useFiber(): Fiber<null> | undefined {
  const root = React.useContext(FiberContext)
  if (root === null) throw new Error('its-fine: useFiber must be called within a <FiberProvider />!')

  const id = React.useId()
  const fiber = React.useMemo(() => {
    for (const maybeFiber of [root, root?.alternate]) {
      if (!maybeFiber) continue
      const fiber = traverseFiber<null>(maybeFiber, false, (node) => {
        let state = node.memoizedState
        while (state) {
          if (state.memoizedState === id) return true
          state = state.next
        }
      })
      if (fiber) return fiber
    }
  }, [root, id])

  return fiber
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
  const root = React.useMemo(
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
  type?: keyof React.JSX.IntrinsicElements,
): React.RefObject<T | undefined> {
  const fiber = useFiber()
  const childRef = React.useRef<T>(undefined)

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
  type?: keyof React.JSX.IntrinsicElements,
): React.RefObject<T | undefined> {
  const fiber = useFiber()
  const parentRef = React.useRef<T>(undefined)

  useIsomorphicLayoutEffect(() => {
    parentRef.current = traverseFiber<T>(
      fiber,
      true,
      (node) => typeof node.type === 'string' && (type === undefined || node.type === type),
    )?.stateNode
  }, [fiber])

  return parentRef
}

export type ContextMap = Map<React.Context<any>, any> & {
  get<T>(context: React.Context<T>): T | undefined
}

const REACT_CONTEXT_TYPE = Symbol.for('react.context')

const isContext = <T,>(type: unknown): type is React.Context<T> =>
  type !== null && typeof type === 'object' && '$$typeof' in type && type.$$typeof === REACT_CONTEXT_TYPE

/**
 * Returns a map of all contexts and their values.
 */
export function useContextMap(): ContextMap {
  const fiber = useFiber()
  const [contextMap] = React.useState(() => new Map<React.Context<any>, any>())

  // Collect live context
  contextMap.clear()
  let node = fiber
  while (node) {
    const context = node.type
    if (isContext(context) && context !== FiberContext && !contextMap.has(context)) {
      contextMap.set(context, React.use(wrapContext(context)))
    }

    node = node.return!
  }

  return contextMap
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
  const contextMap = useContextMap()

  // Flatten context and their memoized values into a `ContextBridge` provider
  return React.useMemo(
    () =>
      Array.from(contextMap.keys()).reduce(
        (Prev, context) => (props) =>
          (
            <Prev>
              <context.Provider {...props} value={contextMap.get(context)} />
            </Prev>
          ),
        (props) => <FiberProvider {...props} />,
      ),
    [contextMap],
  )
}

/** A component that forwards ancestor Activity visibility into another React root. */
export type ActivityBridge = React.FC<React.PropsWithChildren<{}>>

function requestFrame(callback: () => void): () => void {
  if (typeof requestAnimationFrame === 'function') {
    const frame = requestAnimationFrame(callback)
    return () => cancelAnimationFrame(frame)
  }
  const timeout = setTimeout(callback, 16)
  return () => clearTimeout(timeout)
}

/**
 * Forwards ancestor Activity visibility into another root. Requires React 19.2+,
 * an Activity capable destination renderer, and a {@link FiberProvider}.
 *
 * Suspense does not hide the destination. While Suspense hides the source,
 * visibility is sampled once per frame and changes between samples can be missed.
 * Source deletion hides the destination without unmounting its root.
 */
export function useActivityBridge(): ActivityBridge {
  if (!React.Activity) throw new Error('its-fine: useActivityBridge requires React 19.2 or later!')
  const fiber = useFiber()
  const [bridge] = React.useState(() => {
    const activities: { _visibility: number }[] = []
    let suspensible = false
    traverseFiber(fiber, true, (node) => {
      if (node.elementType === React.Activity) {
        // Fiber alternates share Activity's Offscreen instance.
        const instance = node.child?.tag === 22 ? node.child.stateNode : null
        if (typeof instance?._visibility !== 'number')
          throw new Error('its-fine: unsupported React Activity internals!')
        activities.push(instance)
      } else if (node.tag === 22 && node.return?.elementType !== React.Activity) {
        suspensible = true
      }
    })

    // Keep the destination hidden until the source commits.
    let mode: 'hidden' | 'visible' = 'hidden'
    const listeners = new Set<() => void>()
    let cancelPoll: (() => void) | undefined
    const store = {
      mounted: false,
      connected: false,
      subscribe(listener: () => void) {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
      sync(sample: boolean) {
        // Suspense can keep layout effects disconnected after Activity reveals.
        if (store.mounted && !store.connected && suspensible && activities.length > 0) {
          // Schedule before notifying listeners so an update error does not stop polling.
          if (!cancelPoll) {
            cancelPoll = requestFrame(() => {
              cancelPoll = undefined
              store.sync(true)
            })
          }
        } else {
          cancelPoll?.()
          cancelPoll = undefined
        }

        let next = mode
        if (!store.mounted) next = 'hidden'
        else if (store.connected) next = 'visible'
        else if (sample) next = activities.every((activity) => (activity._visibility & 1) !== 0) ? 'visible' : 'hidden'
        if (mode === next) return
        mode = next
        for (const listener of listeners) listener()
      },
      Bridge({ children }: React.PropsWithChildren<{}>) {
        // Subscribe outside Activity so hidden children can be revealed.
        return (
          <React.Activity
            mode={React.useSyncExternalStore(
              store.subscribe,
              () => mode,
              () => 'hidden' as const,
            )}
          >
            {children}
          </React.Activity>
        )
      },
    }
    return store
  })

  // Insertion effects stay mounted while hidden and clean up on deletion.
  React.useInsertionEffect(() => {
    bridge.mounted = true
    // Defer updates until insertion effects finish and ancestor visibility settles.
    queueMicrotask(() => bridge.sync(false))
    return () => {
      bridge.mounted = false
      queueMicrotask(() => bridge.sync(false))
    }
  }, [bridge])

  // Activity and Suspense disconnect layout effects when hiding the source.
  React.useLayoutEffect(() => {
    bridge.connected = true
    bridge.sync(false)
    return () => {
      bridge.connected = false
      bridge.sync(true)
    }
  }, [bridge])
  return bridge.Bridge
}
