import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import { useStore } from './store'

// A branch edge that shows an ✕ delete button at its midpoint when selected.
export function QAEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  target,
  selected,
}: EdgeProps) {
  const setParent = useStore((s) => s.setParent)
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={path} />
      {selected && (
        <EdgeLabelRenderer>
          <button
            className="edge-x nodrag nopan"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onClick={(e) => {
              e.stopPropagation()
              setParent(target, null) // detach this branch
            }}
            title="刪除這條線"
            aria-label="刪除這條線"
          >
            ×
          </button>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
