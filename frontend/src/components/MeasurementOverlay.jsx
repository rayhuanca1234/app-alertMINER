import React, { useState, useEffect, useCallback } from 'react'
import { useMapEvents, Polyline, Polygon, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import * as turf from '@turf/turf'

function MeasurementPoints({ points, mode, onAddPoint, onFinish }) {
  useMapEvents({
    click(e) {
      onAddPoint([e.latlng.lat, e.latlng.lng])
    },
    dblclick(e) {
      L.DomEvent.stopPropagation(e)
      L.DomEvent.preventDefault(e)
      onFinish()
    },
  })
  return null
}

function SegmentLabels({ points }) {
  const map = useMap()

  useEffect(() => {
    const markers = []
    for (let i = 1; i < points.length; i++) {
      const from = points[i - 1]
      const to = points[i]
      const dist = turf.distance(
        turf.point([from[1], from[0]]),
        turf.point([to[1], to[0]]),
        { units: 'kilometers' }
      )
      const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]
      const icon = L.divIcon({
        className: 'measurement-label',
        html: `<div style="background:rgba(59,130,246,0.9);color:white;padding:2px 8px;border-radius:8px;font-size:10px;font-weight:bold;white-space:nowrap;border:1px solid rgba(255,255,255,0.3);box-shadow:0 2px 8px rgba(0,0,0,0.3);">${dist < 1 ? (dist * 1000).toFixed(0) + ' m' : dist.toFixed(2) + ' km'}</div>`,
        iconSize: [0, 0],
      })
      const marker = L.marker(mid, { icon, interactive: false }).addTo(map)
      markers.push(marker)
    }
    return () => {
      markers.forEach(m => map.removeLayer(m))
    }
  }, [points, map])

  return null
}

function PointMarkers({ points, mode, onFinish }) {
  return points.map((p, i) => {
    const isFirst = i === 0
    const icon = L.divIcon({
      className: 'measurement-point',
      html: `<div style="width:12px;height:12px;background:var(--accent, #3b82f6);border:2px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);${isFirst && mode === 'area' ? 'cursor:pointer;transform:scale(1.2);' : ''}"></div>`,
      iconSize: [12, 12],
      iconAnchor: [6, 6],
    })
    
    return (
      <Marker 
        key={i} 
        position={p} 
        icon={icon} 
        interactive={isFirst && mode === 'area'}
        eventHandlers={isFirst && mode === 'area' ? {
          click: (e) => {
            L.DomEvent.stopPropagation(e)
            if (points.length >= 3) onFinish()
          }
        } : undefined}
      />
    )
  })
}

export default function MeasurementOverlay({ mode, onClear }) {
  // mode: null | 'distance' | 'area'
  const [points, setPoints] = useState([])
  const [finished, setFinished] = useState(false)

  // Reset when mode changes
  useEffect(() => {
    setPoints([])
    setFinished(false)
  }, [mode])

  const handleAddPoint = useCallback((point) => {
    if (finished) return
    setPoints(prev => [...prev, point])
  }, [finished])

  const handleFinish = useCallback(() => {
    setFinished(true)
  }, [])

  const handleClear = useCallback(() => {
    setPoints([])
    setFinished(false)
    if (onClear) onClear()
  }, [onClear])

  // Esc key to cancel
  useEffect(() => {
    if (!mode) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClear()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, handleClear])

  if (!mode) return null

  // Calculate total distance
  const totalDistance = points.length >= 2
    ? points.reduce((sum, p, i) => {
        if (i === 0) return 0
        return sum + turf.distance(
          turf.point([points[i - 1][1], points[i - 1][0]]),
          turf.point([p[1], p[0]]),
          { units: 'kilometers' }
        )
      }, 0)
    : 0

  // Calculate area for polygon mode
  let areaValue = 0
  if (mode === 'area' && points.length >= 3) {
    try {
      const closed = [...points.map(p => [p[1], p[0]]), [points[0][1], points[0][0]]]
      const polygon = turf.polygon([closed])
      areaValue = turf.area(polygon) // m²
    } catch (e) {
      areaValue = 0
    }
  }

  const formatArea = (m2) => {
    if (m2 >= 1_000_000) return (m2 / 1_000_000).toFixed(2) + ' km²'
    if (m2 >= 10_000) return (m2 / 10_000).toFixed(2) + ' ha'
    return m2.toFixed(0) + ' m²'
  }

  return (
    <>
      {/* Click handler */}
      {!finished && (
        <MeasurementPoints
          points={points}
          mode={mode}
          onAddPoint={handleAddPoint}
          onFinish={handleFinish}
        />
      )}

      {/* Draw polyline for distance mode */}
      {mode === 'distance' && points.length >= 2 && (
        <Polyline
          positions={points}
          pathOptions={{
            color: '#3b82f6',
            weight: 3,
            dashArray: '8,6',
            opacity: 0.9,
          }}
        />
      )}

      {/* Draw polygon for area mode */}
      {mode === 'area' && points.length >= 3 && (
        <Polygon
          positions={points}
          pathOptions={{
            fillColor: '#3b82f6',
            color: '#3b82f6',
            fillOpacity: 0.2,
            weight: 2,
            dashArray: finished ? null : '8,6',
          }}
        />
      )}

      {/* Area mode with less than 3 points: show line */}
      {mode === 'area' && points.length >= 2 && points.length < 3 && (
        <Polyline
          positions={points}
          pathOptions={{ color: '#3b82f6', weight: 2, dashArray: '8,6', opacity: 0.7 }}
        />
      )}

      {/* Point markers */}
      <PointMarkers points={points} mode={mode} onFinish={handleFinish} />

      {/* Segment distance labels */}
      {points.length >= 2 && <SegmentLabels points={points} />}

      {/* Measurement results badge */}
      {points.length >= 2 && (
        <div className="leaflet-top leaflet-left" style={{ top: 60, left: 10, position: 'absolute', zIndex: 1000 }}>
          <div className="rounded-2xl p-3 shadow-2xl animate-fadeIn" style={{
            background: 'var(--glass, rgba(15,23,42,0.9))',
            backdropFilter: 'blur(16px)',
            border: '1px solid var(--border, rgba(51,65,85,0.5))',
            minWidth: 180,
          }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent, #3b82f6)' }}>
                {mode === 'distance' ? '📏 Distancia' : '📐 Área'}
              </span>
              <button onClick={handleClear} className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
                style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--danger, #ef4444)' }}>
                Limpiar
              </button>
            </div>

            {mode === 'distance' && (
              <div className="text-lg font-black" style={{ color: 'var(--text-primary, white)' }}>
                {totalDistance < 1
                  ? `${(totalDistance * 1000).toFixed(0)} m`
                  : `${totalDistance.toFixed(2)} km`}
              </div>
            )}

            {mode === 'area' && points.length >= 3 && (
              <div className="text-lg font-black" style={{ color: 'var(--text-primary, white)' }}>
                {formatArea(areaValue)}
              </div>
            )}

            <div className="text-[10px] mt-1" style={{ color: 'var(--text-muted, #64748b)' }}>
              {finished
                ? `${points.length} puntos • Completado`
                : `${points.length} puntos • Doble-click para terminar`}
            </div>
          </div>
        </div>
      )}

      {/* Instruction tooltip when no points */}
      {points.length === 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-[1000]">
          <div className="px-4 py-2 rounded-full text-xs font-medium animate-fadeIn shadow-lg"
            style={{ background: 'var(--accent, #3b82f6)', color: 'white' }}>
            {mode === 'distance' ? 'Click en el mapa para medir distancia' : 'Click para dibujar el área'}
          </div>
        </div>
      )}
    </>
  )
}
