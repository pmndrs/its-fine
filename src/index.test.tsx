/// <reference types="vitest" />
import * as React from 'react'
import { vi, describe, expect, it } from 'vitest'
import Reconciler from 'react-reconciler'
import { DefaultEventPriority, ConcurrentRoot } from 'react-reconciler/constants.js'
import { type Fiber, useFiber, traverseFiber, useContextBridge } from 'its-fine'

// Mock scheduler to test React features
vi.mock('scheduler', () => require('scheduler/unstable_mock'))

interface ReactProps {
  key?: React.Key
  ref?: React.Ref<null>
  children?: React.ReactNode
}

interface PrimitiveProps {
  name?: string
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      primitive: ReactProps & PrimitiveProps
      element: ReactProps & PrimitiveProps
    }
  }
}

interface Instance<P = Record<string, unknown>> {
  type: string
  props: P
  children: Instance[]
}

interface HostContainer {
  head: Instance | null
}

interface HostConfig {
  type: string
  props: Record<string, unknown>
  container: HostContainer
  instance: Instance
  textInstance: Instance
  suspenseInstance: Instance
  hydratableInstance: never
  publicInstance: null
  hostContext: null
  updatePayload: {}
  childSet: never
  timeoutHandle: number
  noTimeout: -1
}

// react-reconciler exposes some sensitive props. We don't want them exposed in public instances
const REACT_INTERNAL_PROPS = ['ref', 'key', 'children']
function getInstanceProps(props: Reconciler.Fiber['pendingProps']): HostConfig['props'] {
  const instanceProps: HostConfig['props'] = {}

  for (const key in props) {
    if (!REACT_INTERNAL_PROPS.includes(key)) instanceProps[key] = props[key]
  }

  return instanceProps
}

const config: Reconciler.HostConfig<
  HostConfig['type'],
  HostConfig['props'],
  HostConfig['container'],
  HostConfig['instance'],
  HostConfig['textInstance'],
  HostConfig['suspenseInstance'],
  HostConfig['hydratableInstance'],
  HostConfig['publicInstance'],
  HostConfig['hostContext'],
  HostConfig['updatePayload'],
  HostConfig['childSet'],
  HostConfig['timeoutHandle'],
  HostConfig['noTimeout']
> = {
  isPrimaryRenderer: true,
  supportsMutation: true,
  supportsPersistence: false,
  supportsHydration: false,
  scheduleTimeout: setTimeout,
  cancelTimeout: clearTimeout,
  noTimeout: -1,
  createInstance: (type, props) => ({ type, props: getInstanceProps(props), children: [] }),
  hideInstance() {},
  unhideInstance() {},
  createTextInstance: (value) => ({ type: 'text', props: { value }, children: [] }),
  hideTextInstance() {},
  unhideTextInstance() {},
  appendInitialChild: (parent, child) => parent.children.push(child),
  appendChild: (parent, child) => parent.children.push(child),
  appendChildToContainer: (container, child) => (container.head = child),
  insertBefore: (parent, child, beforeChild) => parent.children.splice(parent.children.indexOf(beforeChild), 0, child),
  removeChild: (parent, child) => parent.children.splice(parent.children.indexOf(child), 1),
  removeChildFromContainer: (container) => (container.head = null),
  getPublicInstance: () => null,
  getRootHostContext: () => null,
  getChildHostContext: () => null,
  shouldSetTextContent: () => false,
  finalizeInitialChildren: () => false,
  prepareUpdate: () => ({}),
  commitUpdate: (instance, _, __, ___, props) => (instance.props = getInstanceProps(props)),
  commitTextUpdate: (instance, _, value) => (instance.props.value = value),
  prepareForCommit: () => null,
  resetAfterCommit() {},
  preparePortalMount() {},
  clearContainer: (container) => (container.head = null),
  getCurrentEventPriority: () => DefaultEventPriority,
  beforeActiveInstanceBlur() {},
  afterActiveInstanceBlur() {},
  detachDeletedInstance() {},
  getInstanceFromNode: () => null,
  prepareScopeUpdate() {},
  getInstanceFromScope: () => null,
}

type _Reconciler = typeof Reconciler

for (const suite of ['development', 'production']) {
  describe(`React ${suite}`, () => {
    vi.stubEnv('NODE_ENV', suite)

    const Reconciler: _Reconciler = require(suite === 'development'
      ? '../node_modules/react-reconciler/cjs/react-reconciler.development.js'
      : '../node_modules/react-reconciler/cjs/react-reconciler.production.min.js')

    function createRoot(overrides?: Partial<typeof config>) {
      const container: HostContainer = { head: null }
      const reconciler = Reconciler({ ...config, ...overrides })
      const root = reconciler.createContainer(container, ConcurrentRoot, null, false, null, '', console.error, null)

      return {
        async render(element: React.ReactNode): Promise<HostContainer> {
          return new Promise((res) => reconciler.updateContainer(element, root, null, () => res(container)))
        },
      }
    }

    const primary = createRoot()
    const secondary = createRoot({ isPrimaryRenderer: false })

    const resolved = new WeakMap<Promise<any>, boolean>()
    function suspend<T>(value: Promise<T>): T {
      if (resolved.get(value)) return value as T

      if (!resolved.has(value)) {
        resolved.set(value, false)
        value.then(() => resolved.set(value, true))
      }

      throw value
    }

    describe('useFiber', () => {
      it('gets the current react-internal Fiber', async () => {
        let fiber!: Fiber

        function Test() {
          fiber = useFiber()!
          return <primitive />
        }
        const container = await primary.render(<Test />)

        expect(fiber).toBeDefined()
        expect(fiber.type).toBe(Test)
        expect(fiber.child!.stateNode).toBe(container.head)
      })

      it('works in concurrent mode', async () => {
        const promise = Promise.resolve()
        function AsyncFragment(props: any) {
          suspend(promise)
          return props.children
        }

        let fiber!: Fiber

        function Test(props: any) {
          fiber = useFiber()!
          return <primitive {...props} />
        }
        const Test1 = Test
        const Test2 = Test
        const Test3 = Test

        // Parent
        const container = await primary.render(
          <AsyncFragment>
            <Test1 />
          </AsyncFragment>,
        )
        expect(fiber).toBeDefined()
        expect(fiber.type).toBe(Test1)
        expect(fiber.child!.stateNode).toBe(container.head)

        // Child
        await primary.render(
          <Test2>
            <AsyncFragment />
          </Test2>,
        )
        expect(fiber).toBeDefined()
        expect(fiber.type).toBe(Test2)
        expect(fiber.child!.stateNode).toBe(container.head)

        // Sibling
        await primary.render(
          <>
            <Test3 />
            <AsyncFragment />
          </>,
        )
        expect(fiber).toBeDefined()
        expect(fiber.type).toBe(Test3)
        expect(fiber.child!.stateNode).toBe(container.head)
      })

      it('works across concurrent renderers', async () => {
        const fibers: Fiber[] = []

        function Test() {
          fibers.push(useFiber()!)
          return null
        }

        function Wrapper() {
          secondary.render(<Test />)
          return <Test />
        }

        await primary.render(<Wrapper />)

        const [outer, inner] = fibers
        expect(outer).not.toBe(inner)
        expect(outer.type).toBe(Test)
        expect(inner.type).toBe(Test)
      })
    })

    describe('traverseFiber', () => {
      it('iterates descending through a fiber', async () => {
        let fiber!: Fiber

        function Test() {
          fiber = useFiber()!
          return <primitive name="child" />
        }
        await primary.render(
          <primitive name="parent">
            <Test />
          </primitive>,
        )

        const traversed = [] as unknown as [self: Fiber, child: Fiber]
        traverseFiber(fiber, false, (node) => void traversed.push(node))

        expect(traversed.length).toBe(2)

        const [self, child] = traversed
        expect(self.type).toBe(Test)
        expect(child.stateNode.props.name).toBe('child')
      })

      it('iterates ascending through a fiber', async () => {
        let fiber!: Fiber

        function Test() {
          fiber = useFiber()!
          return <primitive name="child" />
        }
        await primary.render(
          <primitive name="ancestor">
            <primitive name="parent">
              <Test />
            </primitive>
            <primitive name="other" />
          </primitive>,
        )

        const traversed: Fiber[] = []
        traverseFiber(fiber, true, (node) => void traversed.push(node))

        expect(traversed.filter((o) => o.stateNode?.props?.name === 'other').length).toBe(0)
        expect(traversed.filter((o) => o.stateNode?.props?.name === 'ancestor').length).toBe(1)
        expect(traversed.filter((o) => o.stateNode?.props?.name === 'parent').length).toBe(1)

        const [self, parent, ancestor] = traversed
        expect(self.type).toBe(Test)
        expect(parent.stateNode?.props?.name).toBe('parent')
        expect(ancestor.stateNode?.props?.name).toBe('ancestor')
      })

      it('returns the active node when halted', async () => {
        let fiber!: Fiber

        function Test() {
          fiber = useFiber()!
          return <primitive name="child" />
        }
        const container = await primary.render(<Test />)

        const child = traverseFiber(fiber, false, (node) => node.stateNode === container.head)
        expect(child!.stateNode.props.name).toBe('child')
      })
    })

    describe('useContextBridge', () => {
      it('forwards live context between renderers', async () => {
        let value = -1
        const context = React.createContext<number>(null!)

        function Two() {
          value = React.useContext(context)
          return null
        }

        function One() {
          const Bridge = useContextBridge()
          secondary.render(
            <Bridge>
              <Two />
            </Bridge>,
          )
          return null
        }

        await primary.render(<One />)
        expect(value).toBe(null)

        await primary.render(
          <context.Provider value={1}>
            <One />
          </context.Provider>,
        )
        expect(value).toBe(1)

        await primary.render(
          <context.Provider value={2}>
            <One />
          </context.Provider>,
        )
        expect(value).toBe(2)
      })
    })

    vi.unstubAllEnvs()
  })
}