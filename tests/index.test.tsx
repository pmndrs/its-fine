import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { type NilNode, type HostContainer, act, render, createPortal } from 'react-nil'
import { create } from 'react-test-renderer'
import {
  type Fiber,
  traverseFiber,
  useFiber,
  useContainer,
  useNearestChild,
  useNearestParent,
  useContextBridge,
  FiberProvider,
} from '../src'

interface ReactProps {
  key?: React.Key
  ref?: React.Ref<null>
  children?: React.ReactNode
}

interface PrimitiveProps {
  name?: string
}

type Primitive = NilNode<PrimitiveProps>

declare global {
  namespace JSX {
    interface IntrinsicElements {
      primitive: ReactProps & PrimitiveProps
      element: ReactProps & PrimitiveProps
    }
  }
}

// Classes have internal instances which would be bound to `this`
class ClassComponent extends React.Component<{ children?: React.ReactNode }> {
  render() {
    return <>{this.props?.children}</>
  }
}

describe('useFiber', () => {
  it('throws when used outside of a FiberProvider', async () => {
    let threw = false

    function Test() {
      try {
        useFiber()
      } catch (_) {
        threw = true
      }
      return null
    }
    await act(async () => render(<Test />))

    expect(threw).toBe(true)
  })

  it('gets the current react-internal Fiber', async () => {
    let fiber!: Fiber

    function Test() {
      fiber = useFiber()
      return <primitive />
    }
    const container = await act(async () =>
      render(
        <FiberProvider>
          <Test />
        </FiberProvider>,
      ),
    )

    expect(fiber).toBeDefined()
    expect(fiber.type).toBe(Test)
    expect(fiber.child!.stateNode).toBe(container.head)
  })

  it('works across concurrent renderers', async () => {
    const fibers: Fiber[] = []

    function Test() {
      fibers.push(useFiber())
      return null
    }

    function Wrapper() {
      render(
        <FiberProvider>
          <Test />
        </FiberProvider>,
      )
      return <Test />
    }

    await act(async () =>
      create(
        <FiberProvider>
          <Wrapper />
        </FiberProvider>,
      ),
    )

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
      fiber = useFiber()
      return <primitive name="child" />
    }
    await act(async () =>
      render(
        <FiberProvider>
          <primitive name="parent">
            <Test />
          </primitive>
        </FiberProvider>,
      ),
    )

    const traversed = [] as unknown as [self: Fiber<null>, child: Fiber<Primitive>]
    traverseFiber(fiber, false, (node) => void traversed.push(node))

    expect(traversed.length).toBe(2)

    const [self, child] = traversed
    expect(self.type).toBe(Test)
    expect(child.stateNode.props.name).toBe('child')
  })

  it('iterates ascending through a fiber', async () => {
    let fiber!: Fiber

    function Test() {
      fiber = useFiber()
      return <primitive name="child" />
    }
    const container = await act(async () =>
      render(
        <FiberProvider>
          <primitive name="parent">
            <Test />
          </primitive>
        </FiberProvider>,
      ),
    )

    const traversed = [] as unknown as [self: Fiber<null>, parent: Fiber<Primitive>]
    traverseFiber(fiber, true, (node) => void traversed.push(node))

    const [self, parent] = traversed
    expect(self.type).toBe(Test)
    expect(parent.stateNode.props.name).toBe('parent')
  })

  it('returns the active node when halted', async () => {
    let fiber!: Fiber

    function Test() {
      fiber = useFiber()
      return <primitive name="child" />
    }
    const container = await act(async () =>
      render(
        <FiberProvider>
          <Test />
        </FiberProvider>,
      ),
    )

    const child = traverseFiber<Primitive>(fiber, false, (node) => node.stateNode === container.head)
    expect(child!.stateNode.props.name).toBe('child')
  })
})

describe('useContainer', () => {
  it('gets the current react-reconciler container', async () => {
    let container!: HostContainer

    function Test() {
      container = useContainer<HostContainer>()
      return null
    }

    const rootContainer = await act(async () =>
      render(
        <FiberProvider>
          <Test />
        </FiberProvider>,
      ),
    )
    expect(container).toBe(rootContainer)

    const portalContainer: HostContainer = { head: null }
    await act(async () => render(<FiberProvider>{createPortal(<Test />, portalContainer)}</FiberProvider>))
    expect(container).toBe(portalContainer)
  })
})

describe('useNearestChild', () => {
  it('gets the nearest child instance', async () => {
    const instances: React.MutableRefObject<Primitive | undefined>[] = []

    function Test(props: React.PropsWithChildren<{ strict?: boolean }>) {
      instances.push(useNearestChild<Primitive>(props.strict ? 'element' : undefined))
      return <>{props.children}</>
    }

    await act(async () => {
      render(
        <FiberProvider>
          <Test />
          <Test>
            <primitive name="one" />
          </Test>
          <Test>
            <>
              <primitive name="two" />
            </>
          </Test>
          <Test>
            <ClassComponent>
              <primitive name="two" />
            </ClassComponent>
          </Test>
          <Test strict>
            <primitive name="three" />
            <element name="four" />
          </Test>
        </FiberProvider>,
      )
    })

    expect(instances.map((ref) => ref.current?.props?.name)).toStrictEqual([undefined, 'one', 'two', 'two', 'four'])
  })
})

describe('useNearestParent', () => {
  it('gets the nearest parent instance', async () => {
    const instances: React.MutableRefObject<Primitive | undefined>[] = []

    function Test(props: React.PropsWithChildren<{ strict?: boolean }>) {
      instances.push(useNearestParent<Primitive>(props.strict ? 'element' : undefined))
      return <>{props.children}</>
    }

    await act(async () => {
      render(
        <FiberProvider>
          <Test />
          <primitive name="one">
            <>
              <Test />
              <>
                <Test />
              </>
              <ClassComponent>
                <Test />
              </ClassComponent>
              <primitive name="two">
                <Test />
              </primitive>
              <element name="four">
                <primitive name="three">
                  <Test strict />
                </primitive>
              </element>
            </>
          </primitive>
        </FiberProvider>,
      )
    })

    expect(instances.map((ref) => ref.current?.props?.name)).toStrictEqual([
      undefined,
      'one',
      'one',
      'one',
      'two',
      'four',
    ])
  })
})

describe('useContextBridge', () => {
  it('forwards live context between renderers', async () => {
    const Context1 = React.createContext<string>(null!)
    const Context2 = React.createContext<string>(null!)

    const outer: string[] = []
    const inner: string[] = []

    function Test({ secondary }: { secondary?: boolean }) {
      const target = secondary ? inner : outer
      target.push(React.useContext(Context1), React.useContext(Context2))

      return null
    }

    function Wrapper() {
      const Bridge = useContextBridge()
      render(
        <Bridge>
          <Test secondary />
        </Bridge>,
      )

      return (
        <>
          <Test />
          <Context2.Provider value="invalid" />
        </>
      )
    }

    function Providers(props: { values: [value1: string, value2: string]; children: React.ReactNode }) {
      const [value1, value2] = props.values
      return (
        <FiberProvider>
          <Context1.Provider value="invalid">
            <Context1.Provider value={value1}>
              <Context2.Provider value={value2}>{props.children}</Context2.Provider>
            </Context1.Provider>
          </Context1.Provider>
        </FiberProvider>
      )
    }

    await act(async () =>
      create(
        <Providers values={['value1', 'value2']}>
          <Wrapper />
        </Providers>,
      ),
    )

    await act(async () =>
      create(
        <Providers values={['value1__new', 'value2__new']}>
          <Wrapper />
        </Providers>,
      ),
    )

    expect(outer).toStrictEqual(['value1', 'value2', 'value1__new', 'value2__new'])
    expect(inner).toStrictEqual(['value1', 'value2', 'value1__new', 'value2__new'])
  })
})
