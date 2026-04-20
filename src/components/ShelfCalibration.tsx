'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  imageDataUrl: string
  rows: number // expected number of shelves
  onCancel: () => void
  onConfirm: (yBoundaries: number[]) => void
}

/**
 * Calibrate shelf Y-boundaries on a whole-shelf photo before auto-split.
 * Admin sees `rows + 1` horizontal lines starting evenly spaced; drags each
 * onto the real shelf edge. Sorts lines after drag so they stay top-down.
 */
export default function ShelfCalibration({ imageDataUrl, rows, onCancel, onConfirm }: Props) {
  const expected = rows + 1
  const [lines, setLines] = useState<number[]>(() =>
    Array.from({ length: expected }, (_, i) => i / rows),
  )
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // If rows changes while open, reset.
    setLines(Array.from({ length: rows + 1 }, (_, i) => i / rows))
  }, [rows])

  function yFromEvent(clientY: number): number {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const y = (clientY - rect.top) / rect.height
    return Math.max(0.001, Math.min(0.999, y))
  }

  function onPointerDownLine(e: React.PointerEvent, i: number) {
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setDragIdx(i)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragIdx === null) return
    const y = yFromEvent(e.clientY)
    setLines(prev => {
      const next = [...prev]
      next[dragIdx] = y
      return next
    })
  }

  function onPointerUp() {
    if (dragIdx === null) return
    setLines(prev => [...prev].sort((a, b) => a - b))
    setDragIdx(null)
  }

  function resetEven() {
    setLines(Array.from({ length: expected }, (_, i) => i / rows))
  }

  function confirm() {
    const sorted = [...lines].sort((a, b) => a - b)
    onConfirm(sorted)
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 overflow-y-auto">
      <div className="min-h-screen flex flex-col">
        <div className="sticky top-0 z-10 bg-black/80 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-base leading-tight">Trace your shelves</p>
            <p className="text-xs text-gray-300">Drag each line onto a shelf edge · top first, bottom last</p>
          </div>
          <button onClick={onCancel} className="text-gray-300 text-sm font-semibold">Cancel</button>
        </div>

        <div className="flex-1 flex items-center justify-center p-3">
          <div
            ref={containerRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            className="relative w-full max-w-3xl select-none"
            style={{ touchAction: 'none' }}
          >
            <img
              src={imageDataUrl}
              alt="Shelf"
              className="block w-full h-auto rounded-xl"
              draggable={false}
            />
            {lines.map((y, i) => {
              const isEdge = i === 0 || i === lines.length - 1
              const isActive = dragIdx === i
              return (
                <div
                  key={i}
                  onPointerDown={e => onPointerDownLine(e, i)}
                  className="absolute left-0 right-0 flex items-center cursor-ns-resize"
                  style={{
                    top: `${y * 100}%`,
                    transform: 'translateY(-50%)',
                    touchAction: 'none',
                    padding: '10px 0',
                  }}
                >
                  <div
                    className={`flex-1 h-[2px] ${isActive ? 'bg-brand' : isEdge ? 'bg-white/85' : 'bg-brand/85'}`}
                    style={{ boxShadow: isActive ? '0 0 12px rgba(46,168,255,0.8)' : '0 0 4px rgba(0,0,0,0.4)' }}
                  />
                  <div
                    className={`absolute left-2 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shadow-md ${
                      isActive ? 'bg-brand text-white scale-110' : isEdge ? 'bg-white text-gray-900' : 'bg-brand text-white'
                    }`}
                  >
                    {isEdge ? (i === 0 ? '↑' : '↓') : i}
                  </div>
                  <div className="absolute right-2 w-4 h-4 rounded-full bg-white border-2 border-brand" />
                </div>
              )
            })}
          </div>
        </div>

        <div className="sticky bottom-0 bg-black/80 backdrop-blur border-t border-white/10 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-gray-300">
              <span className="font-bold text-white">{rows}</span> shelves · <span className="font-bold text-white">{expected}</span> lines
            </p>
            <button onClick={resetEven} className="text-xs font-semibold text-brand">Reset evenly</button>
          </div>
          <button onClick={confirm} className="w-full bg-brand text-white font-bold py-3.5 rounded-full">
            Slice along these lines →
          </button>
        </div>
      </div>
    </div>
  )
}
