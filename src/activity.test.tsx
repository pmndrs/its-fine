// @vitest-environment jsdom
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FiberProvider, useActivityBridge, type ActivityBridge } from './index'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

type Mode = 'visible' | 'hidden'
type Input = {
  wrap?: boolean
  outer?: Mode
  inner?: Mode
  suspended?: boolean
  removed?: boolean
  second?: boolean
}
type Options = {
  destination?: 'dom' | 'test'
  suspense?: boolean
  strict?: boolean
}

describe.skipIf(!React.Activity)('useActivityBridge', () => {
  const cleanups: (() => void)[] = []

  beforeEach(() => {
    vi.spyOn(console, 'error')
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
  })

  afterEach(async () => {
    try {
      await React.act(async () => {
        for (const cleanup of cleanups.splice(0).reverse()) cleanup()
      })
      // React reports invalid effect updates through console.error.
      expect(
        vi.mocked(console.error).mock.calls.filter(([message]) => !/react-test-renderer is deprecated/.test(message)),
      ).toEqual([])
    } finally {
      vi.restoreAllMocks()
      vi.useRealTimers()
      vi.unstubAllGlobals()
    }
  })

  function frame() {
    return React.act(async () => {
      vi.advanceTimersToNextFrame()
    })
  }

  async function harness(initial: Input = {}, { destination = 'dom', suspense = false, strict = false }: Options = {}) {
    const source = createRoot(document.createElement('div'))
    const container = document.createElement('div')
    const bridges: ActivityBridge[] = []
    const events: string[] = []
    const pending = new Promise<never>(() => {})
    cleanups.push(() => source.unmount())

    function Source({ slot }: { slot: number }) {
      bridges[slot] = useActivityBridge()
      return null
    }

    function Suspend({ active }: { active: boolean }) {
      if (active) throw pending
      return null
    }

    function Probe({ slot }: { slot: number }) {
      const [count, setCount] = React.useState(0)
      React.useLayoutEffect(() => {
        events.push(`${slot}:layout setup`)
        return () => events.push(`${slot}:layout cleanup`)
      }, [slot])
      React.useEffect(() => {
        events.push(`${slot}:passive setup`)
        return () => events.push(`${slot}:passive cleanup`)
      }, [slot])
      return (
        <button data-slot={slot} onClick={() => setCount((value) => value + 1)}>
          {count}
        </button>
      )
    }

    function tree(input: Input) {
      const sources = (
        <>
          {!input.removed && <Source slot={0} />}
          {input.second && <Source slot={1} />}
        </>
      )
      const content = suspense ? (
        <React.Suspense fallback={<span>fallback</span>}>
          {sources}
          <Suspend active={input.suspended ?? false} />
        </React.Suspense>
      ) : (
        sources
      )
      const element = (
        <FiberProvider>
          {input.wrap === false ? (
            content
          ) : (
            <React.Activity mode={input.outer ?? 'visible'}>
              <React.Activity mode={input.inner ?? 'visible'}>{content}</React.Activity>
            </React.Activity>
          )}
        </FiberProvider>
      )
      return strict ? <React.StrictMode>{element}</React.StrictMode> : element
    }

    await React.act(async () => source.render(tree(initial)))

    function destinationTree() {
      return bridges.map((Bridge, slot) => (
        <Bridge key={slot}>
          <Probe slot={slot} />
        </Bridge>
      ))
    }

    let testRoot: ReactTestRenderer | undefined
    let renderDestination: () => void
    if (destination === 'dom') {
      const root = createRoot(container)
      renderDestination = () => root.render(destinationTree())
      cleanups.push(() => root.unmount())
      await React.act(async () => renderDestination())
    } else {
      await React.act(async () => {
        testRoot = create(<>{destinationTree()}</>)
      })
      renderDestination = () => testRoot!.update(<>{destinationTree()}</>)
      cleanups.push(() => testRoot!.unmount())
    }

    const node = (slot = 0) => container.querySelector<HTMLElement>(`[data-slot="${slot}"]`)

    return {
      events,
      node,
      text(slot = 0) {
        if (destination === 'test') return testRoot!.root.findByProps({ 'data-slot': slot }).children.join('')
        return node(slot)?.textContent
      },
      visible(slot = 0) {
        if (destination === 'test') return testRoot!.toJSON() !== null
        const element = node(slot)
        return element !== null && element.style.display !== 'none'
      },
      update(input: Input) {
        return React.act(async () => source.render(tree(input)))
      },
      unmount() {
        return React.act(async () => source.unmount())
      },
      increment() {
        return React.act(async () => {
          if (destination === 'test') testRoot!.root.findByProps({ 'data-slot': 0 }).props.onClick()
          else node()!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
      },
      mountDestinations() {
        return React.act(async () => renderDestination())
      },
    }
  }

  it.each(['dom', 'test'] as const)('forwards visibility at commit and preserves state in %s', async (destination) => {
    const h = await harness({}, { destination })
    const node = h.node()
    expect(h.visible()).toBe(true)
    await h.increment()
    expect(h.text()).toBe('1')
    h.events.length = 0
    await h.update({ outer: 'hidden' })
    expect(h.visible()).toBe(false)
    expect(h.events).toContain('0:layout cleanup')
    expect(h.events).toContain('0:passive cleanup')

    h.events.length = 0
    await h.update({})
    expect(h.visible()).toBe(true)
    expect(h.text()).toBe('1')
    if (destination === 'dom') expect(h.node()).toBe(node)
    expect(h.events).toContain('0:layout setup')
    expect(h.events).toContain('0:passive setup')
  })

  it('starts hidden when the source Activity is initially hidden', async () => {
    const h = await harness({ outer: 'hidden' })
    expect(h.visible()).toBe(false)
    expect(h.events).toEqual([])
    await h.update({})
    expect(h.visible()).toBe(true)
    expect(h.events).toContain('0:passive setup')
  })

  it('stays visible without an ancestor Activity even when the source suspends', async () => {
    const h = await harness({ wrap: false }, { suspense: true })
    expect(h.visible()).toBe(true)
    await h.update({ wrap: false, suspended: true })
    expect(h.visible()).toBe(true)
  })

  it('stays hidden while any ancestor Activity is hidden', async () => {
    const h = await harness({ outer: 'hidden', inner: 'visible' })
    await h.update({ outer: 'visible', inner: 'hidden' })
    expect(h.visible()).toBe(false)
    await h.update({ outer: 'hidden', inner: 'visible' })
    expect(h.visible()).toBe(false)
    expect(h.events).toEqual([])
    await h.update({})
    expect(h.visible()).toBe(true)
  })

  it('hides the destination when its source is deleted', async () => {
    const h = await harness()
    await h.update({ removed: true })
    expect(h.visible()).toBe(false)
    expect(h.events).toContain('0:layout cleanup')
  })

  it('hides the destination when a source behind a Suspense fallback is deleted', async () => {
    const h = await harness({}, { suspense: true })
    await h.update({ suspended: true })
    expect(h.visible()).toBe(true)
    await h.unmount()
    expect(h.visible()).toBe(false)
    // A deleted source must release its scheduled work.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('forwards Activity visibility while the source is suspended', async () => {
    const h = await harness({}, { suspense: true })
    await h.update({ suspended: true })
    expect(h.visible()).toBe(true)

    await h.update({ suspended: true, outer: 'hidden' })
    await frame()
    expect(h.visible()).toBe(false)
    await h.update({ suspended: true })
    await frame()
    expect(h.visible()).toBe(true)

    await h.update({})
    expect(h.visible()).toBe(true)
  })

  it('reveals an initially hidden destination while the source remains suspended', async () => {
    const h = await harness({ outer: 'hidden' }, { suspense: true })
    expect(h.visible()).toBe(false)
    await h.update({ outer: 'hidden', suspended: true })
    await h.update({ suspended: true })
    await frame()
    expect(h.visible()).toBe(true)
  })

  it('keeps multiple bridges independent when one source is deleted', async () => {
    const h = await harness({ second: true }, { suspense: true })
    await h.update({ second: true, suspended: true })
    await h.update({ second: true, suspended: true, outer: 'hidden' })
    await frame()
    expect([h.visible(0), h.visible(1)]).toEqual([false, false])
    await h.update({ second: true, suspended: true })
    await frame()
    expect([h.visible(0), h.visible(1)]).toEqual([true, true])

    await h.update({ second: true, removed: true })
    expect([h.visible(0), h.visible(1)]).toEqual([false, true])
    await h.update({ removed: true })
    expect([h.visible(0), h.visible(1)]).toEqual([false, false])
  })

  it('forwards visibility without requestAnimationFrame', async () => {
    vi.useRealTimers().useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    vi.stubGlobal('requestAnimationFrame', undefined)
    const h = await harness({}, { suspense: true })
    await h.update({ suspended: true })
    await h.update({ suspended: true, outer: 'hidden' })
    await React.act(async () => {
      vi.advanceTimersByTime(16)
    })
    expect(h.visible()).toBe(false)
  })

  it('preserves visibility through hide and reveal in StrictMode', async () => {
    const h = await harness({}, { suspense: true, strict: true })
    expect(h.visible()).toBe(true)
    await h.update({ outer: 'hidden' })
    expect(h.visible()).toBe(false)
    await h.update({})
    expect(h.visible()).toBe(true)
  })

  it('reveals a bridge registered while hidden', async () => {
    const h = await harness()
    await h.update({ outer: 'hidden', second: true })
    await h.mountDestinations()
    expect(h.events).not.toContain('1:layout setup')
    await h.update({ second: true })
    expect(h.events).toContain('1:layout setup')
    expect(h.events).toContain('1:passive setup')
  })
})
