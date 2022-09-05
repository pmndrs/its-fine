import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { type NilNode, type HostContainer, act, render } from 'react-nil'
import { create } from 'react-test-renderer'
import {
  type Fiber,
  type ContainerInstance,
  traverseFiber,
  useFiber,
  useContainer,
  useNearestChild,
  useNearestParent,
  useContextBridge,
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
  it('gets the current react-internal Fiber', async () => {
    let fiber!: Fiber
    let container!: HostContainer

    function Test() {
      fiber = useFiber()
      return <primitive />
    }
    await act(async () => (container = render(<Test />)))

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
      render(<Test />)
      return <Test />
    }

    await act(async () => create(<Wrapper />))

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
    await act(async () => {
      render(
        <primitive name="parent">
          <Test />
        </primitive>,
      )
    })

    const traversed = [] as unknown as [self: Fiber<null>, child: Fiber<Primitive>]
    traverseFiber(fiber, false, (node) => void traversed.push(node))

    expect(traversed.length).toBe(2)

    const [self, child] = traversed
    expect(self.type).toBe(Test)
    expect(child.stateNode.props.name).toBe('child')
  })

  it('iterates ascending through a fiber', async () => {
    let fiber!: Fiber
    let container!: HostContainer

    function Test() {
      fiber = useFiber()
      return <primitive name="child" />
    }
    await act(async () => {
      container = render(
        <primitive name="parent">
          <Test />
        </primitive>,
      )
    })

    const traversed = [] as unknown as [
      self: Fiber<null>,
      parent: Fiber<Primitive>,
      rootContainer: Fiber<ContainerInstance<HostContainer>>,
    ]
    traverseFiber(fiber, true, (node) => void traversed.push(node))

    expect(traversed.length).toBe(3)

    const [self, parent, rootContainer] = traversed
    expect(self.type).toBe(Test)
    expect(parent.stateNode.props.name).toBe('parent')
    expect(rootContainer.stateNode.containerInfo).toBe(container)
  })

  it('returns the active node when halted', async () => {
    let fiber!: Fiber
    let container!: HostContainer

    function Test() {
      fiber = useFiber()
      return <primitive name="child" />
    }
    await act(async () => (container = render(<Test />)))

    const child = traverseFiber<Primitive>(fiber, false, (node) => node.stateNode === container.head)
    expect(child!.stateNode.props.name).toBe('child')
  })
})

describe('useContainer', () => {
  it('gets the current react-reconciler container', async () => {
    let rootContainer!: HostContainer
    let container!: HostContainer

    function Test() {
      rootContainer = useContainer<HostContainer>()
      return null
    }
    await act(async () => (container = render(<Test />)))

    expect(rootContainer).toBe(container)
  })
})

describe('useNearestChild', () => {
  it('gets the nearest child instance', async () => {
    const instances: React.MutableRefObject<Primitive | undefined>[] = []

    function Test(props: React.PropsWithChildren) {
      instances.push(useNearestChild<Primitive>())
      return <>{props.children}</>
    }

    await act(async () => {
      render(
        <>
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
          <Test>
            <primitive name="three" />
            <primitive name="four" />
          </Test>
        </>,
      )
    })

    expect(instances.map((ref) => ref.current?.props?.name)).toStrictEqual([undefined, 'one', 'two', 'two', 'three'])
  })
})

describe('useNearestParent', () => {
  it('gets the nearest parent instance', async () => {
    const instances: React.MutableRefObject<Primitive | undefined>[] = []

    function Test(props: React.PropsWithChildren) {
      instances.push(useNearestParent<Primitive>())
      return <>{props.children}</>
    }

    await act(async () => {
      render(
        <>
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
            </>
          </primitive>
        </>,
      )
    })

    expect(instances.map((ref) => ref.current?.props?.name)).toStrictEqual([undefined, 'one', 'one', 'one', 'two'])
  })
})

describe('useContextBridge', () => {
  it('forwards live context between renderers', async () => {
    const Context1 = React.createContext<string>(null!)
    const Context2 = React.createContext<string>(null!)

    const outer: string[] = []
    const inner: string[] = []

    function Test({ secondary }: { secondary?: boolean }) {
      ;(secondary ? inner : outer).push(React.useContext(Context1), React.useContext(Context2))

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

    function Providers(props: { children: React.ReactNode }) {
      const [value1, setValue1] = React.useState('value1')
      const [value2, setValue2] = React.useState('value2')

      React.useLayoutEffect(() => void setValue1('value1__new'), [])
      React.useEffect(() => void setValue2('value2__new'), [])

      return (
        <Context1.Provider value="invalid">
          <Context1.Provider value={value1}>
            <Context2.Provider value={value2}>{props.children}</Context2.Provider>
          </Context1.Provider>
        </Context1.Provider>
      )
    }

    await act(async () =>
      create(
        <Providers>
          <Wrapper />
        </Providers>,
      ),
    )

    expect(outer).toStrictEqual(['value1', 'value2', 'value1__new', 'value2__new'])
    expect(inner).toStrictEqual(['value1', 'value2', 'value1__new', 'value2__new'])
  })
})
