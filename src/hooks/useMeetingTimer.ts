import { useCallback, useEffect, useRef, useState } from 'react'
import { addElapsed, totalElapsed } from '../utils/meetingTimer'

/**
 * Minuteur de réunion : le temps écoulé est compté pour le point en cours (si l'on passe au point suivant, le compteur
 * continue sur le nouveau point). Mesuré à l'horloge, pas au nombre de tics : un onglet mis en arrière-plan ne fait pas
 * perdre de temps.
 */
export function useMeetingTimer(currentPoint: number) {
  const [perPoint, setPerPoint] = useState<Record<number, number>>({})
  const [running, setRunning] = useState(false)
  const lastTick = useRef(0)
  const pointRef = useRef(currentPoint)
  pointRef.current = currentPoint

  useEffect(() => {
    if (!running) return
    lastTick.current = Date.now()
    const id = setInterval(() => {
      const now = Date.now()
      const seconds = (now - lastTick.current) / 1000
      lastTick.current = now
      setPerPoint((prev) => addElapsed(prev, pointRef.current, seconds))
    }, 500)
    return () => clearInterval(id)
  }, [running])

  const toggle = useCallback(() => setRunning((r) => !r), [])
  const reset = useCallback(() => {
    setRunning(false)
    setPerPoint({})
  }, [])

  return { perPoint, total: totalElapsed(perPoint), running, toggle, reset }
}
