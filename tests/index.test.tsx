import * as React from 'react'
import { describe, expect, it } from 'vitest'
import { act, render, type HostContainer, type NilNode } from 'react-nil'
import { type Fiber, useFiber, useNearestInstance, useNearestContainer } from '../src'

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
})

describe('useNearestContainer', () => {
  it('gets the nearest reconciler container', async () => {
    let containerRef!: React.MutableRefObject<HostContainer | undefined>
    let container!: HostContainer

    function Test() {
      containerRef = useNearestContainer()
      return null
    }
    await act(async () => (container = render(<Test />)))

    expect(containerRef.current!).toBe(container)
  })
})

describe('useNearestInstance', () => {
  it('gets the nearest child instance', async () => {
    const instances: React.MutableRefObject<NilNode<PrimitiveProps> | undefined>[] = []

    function Test(props: React.PropsWithChildren) {
      instances.push(useNearestInstance())
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

  it('gets the nearest parent instance', async () => {
    const instances: React.MutableRefObject<NilNode<PrimitiveProps> | undefined>[] = []

    function Test(props: React.PropsWithChildren) {
      instances.push(useNearestInstance(true))
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
