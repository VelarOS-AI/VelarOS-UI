import React from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'

import { MarqueeText } from '../../src/primitives/display/MarqueeText'

import '../../src/styles/components/primitives/marquee-text.css'

const root = createRoot(document.getElementById('root')!)
const title = '这是一个足够长的会话标题，用来检查跑马灯在侧栏缩放和循环时是否会抖动。'

function render(active: boolean, width: number): void {
  flushSync(() => root.render(
    <div style={{ width, zoom: 1.25, font: '13px/20px sans-serif' }}>
      <MarqueeText title={title} active={active} />
    </div>
  ))
}

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message)
}

function nextFrame(): Promise<number> {
  return new Promise(requestAnimationFrame)
}

Object.assign(window, {
  async runMarqueeTextRegression(): Promise<string> {
    render(false, 183.5)
    const viewport = document.querySelector<HTMLElement>('.velar-marquee-text')!
    const resting = viewport.querySelector<HTMLElement>('.velar-marquee-text-item')!
    const original = resting.getBoundingClientRect()
    const cursor = { x: original.left + 12, y: original.top + original.height / 2 }
    const hoverTarget = document.elementFromPoint(cursor.x, cursor.y)
    render(true, 183.5)
    await nextFrame()

    const track = viewport.querySelector<HTMLElement>('.velar-marquee-text-track')!
    const animation = track.getAnimations()[0]!
    animation.pause()
    const duration = Number(animation.effect!.getTiming().duration)
    for (const fraction of [0, 0.25, 0.6, 0.999, 1.001]) {
      animation.currentTime = duration * fraction
      const current = resting.getBoundingClientRect()
      expect(Math.abs(current.left - original.left) < 0.1, 'Scrolling moved the original text box')
      expect(Math.abs(current.width - original.width) < 0.1, 'Scrolling resized the original text box')
      expect(document.elementFromPoint(cursor.x, cursor.y) === hoverTarget, 'Scrolling changed the hover target')
    }

    const [first, second] = track.children
    animation.currentTime = 0
    const start = first!.getBoundingClientRect()
    animation.currentTime = duration - 0.01
    expect(Math.abs(second!.getBoundingClientRect().left - start.left) < 0.1, 'A loop did not return to the same pixel position')

    render(true, 132.25)
    await nextFrame()
    expect(track.getAnimations()[0] === animation, 'Resizing the sidebar restarted the marquee')
    render(false, 132.25)
    expect(viewport.getAnimations({ subtree: true }).length === 0, 'The marquee continued scrolling after hover ended')
    expect(getComputedStyle(resting).textOverflow === 'ellipsis', 'The resting title lost its ellipsis')
    return 'steady layout and hit target across the loop and resize'
  },
})
