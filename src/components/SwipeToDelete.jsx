/**
 * SwipeToDelete — wraps any list item with swipe-left-to-reveal-delete.
 * On desktop: shows a persistent small trash icon on hover.
 * On mobile: swipe left reveals a red delete zone; tap it to delete.
 *
 * Uses pointer events (works for both touch and mouse).
 */
import { useRef, useState, useCallback } from 'react'
import { Trash2 } from 'lucide-react'

const SWIPE_THRESHOLD = 60   // px to start revealing
const SWIPE_REVEAL    = 80   // px to show full delete button
const SWIPE_FULL      = 120  // px at which we auto-trigger

export default function SwipeToDelete({
  children,
  onDelete,
  deleteLabel = 'Delete',
  disabled = false,
}) {
  const [offset, setOffset]       = useState(0)   // current swipe px
  const [revealed, setRevealed]   = useState(false)
  const [deleting, setDeleting]   = useState(false)
  const startX    = useRef(null)
  const startY    = useRef(null)
  const isSwipe   = useRef(false)
  const itemRef   = useRef(null)

  /* ── Pointer down ── */
  const onPointerDown = useCallback(e => {
    if (disabled) return
    startX.current  = e.clientX
    startY.current  = e.clientY
    isSwipe.current = false
  }, [disabled])

  /* ── Pointer move ── */
  const onPointerMove = useCallback(e => {
    if (startX.current === null) return
    const dx = startX.current - e.clientX   // positive = swipe left
    const dy = Math.abs(e.clientY - startY.current)

    // Ignore vertical scrolling
    if (!isSwipe.current && dy > 10 && dy > Math.abs(dx)) {
      startX.current = null
      return
    }

    if (dx > 5) {
      isSwipe.current = true
      e.preventDefault()
      const clamped = Math.min(dx, SWIPE_REVEAL)
      setOffset(clamped)
    }
  }, [])

  /* ── Pointer up ── */
  const onPointerUp = useCallback(async () => {
    if (startX.current === null) return
    startX.current = null

    if (offset >= SWIPE_FULL) {
      // Auto-trigger delete
      await triggerDelete()
    } else if (offset >= SWIPE_REVEAL * 0.7) {
      setRevealed(true)
      setOffset(SWIPE_REVEAL)
    } else {
      // Snap back
      setOffset(0)
      setRevealed(false)
    }
  }, [offset])

  /* ── Tap anywhere outside to close ── */
  const handleBlur = useCallback(() => {
    if (revealed) {
      setOffset(0)
      setRevealed(false)
    }
  }, [revealed])

  /* ── Actual delete ── */
  const triggerDelete = async () => {
    setDeleting(true)
    setOffset(SWIPE_REVEAL)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
      setOffset(0)
      setRevealed(false)
    }
  }

  const containerStyle = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 'inherit',
  }

  const innerStyle = {
    transform: `translateX(-${offset}px)`,
    transition: isSwipe.current ? 'none' : 'transform 0.25s cubic-bezier(0.32,0.72,0,1)',
    position: 'relative',
    zIndex: 1,
    touchAction: 'pan-y',
    userSelect: 'none',
  }

  const deleteZoneStyle = {
    position: 'absolute', top: 0, right: 0, bottom: 0,
    width: SWIPE_REVEAL,
    backgroundColor: 'var(--expense)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 4, flexDirection: 'column',
    cursor: 'pointer',
    opacity: offset / SWIPE_REVEAL,
    transition: isSwipe.current ? 'none' : 'opacity 0.2s',
    borderRadius: '0 12px 12px 0',
  }

  return (
    <div
      style={containerStyle}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onBlur={handleBlur}
      tabIndex={-1}
    >
      {/* Red delete zone (revealed on swipe) */}
      <div
        style={deleteZoneStyle}
        onClick={e => { e.stopPropagation(); triggerDelete() }}
        aria-label={deleteLabel}
      >
        <Trash2 size={18} color="#fff" />
        <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {deleting ? '…' : 'Delete'}
        </span>
      </div>

      {/* Content */}
      <div ref={itemRef} style={innerStyle}>
        {children}
      </div>
    </div>
  )
}
