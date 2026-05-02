import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, Polygon, Polyline, useMap } from 'react-leaflet'
import { useSearchParams, useNavigate } from 'react-router-dom'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import * as turf from '@turf/turf'
import { Crosshair, AlertTriangle, Menu, Navigation, X } from 'lucide-react'
import { useAlertStore } from '../store/alertStore'
import { useAuthStore } from '../store/authStore'
import { useGeolocation } from '../hooks/useGeolocation'
import { useAlerts } from '../hooks/useAlerts'
import MapToolbar from '../components/MapToolbar'
import MapSearch from '../components/MapSearch'
import MapLayerSwitcher, { LAYERS } from '../components/MapLayerSwitcher'
import MeasurementOverlay from '../components/MeasurementOverlay'

// Fix default markers
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
})

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
})

const searchIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
})

// Component to recenter map
function RecenterMap({ position }) {
  const map = useMap()
  useEffect(() => {
    if (position) map.flyTo([position.latitude, position.longitude], map.getZoom(), { duration: 1 })
  }, [position?.latitude, position?.longitude])
  return null
}

// Fly to bounds component
function FitBounds({ bounds }) {
  const map = useMap()
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, duration: 1.5 })
    }
  }, [bounds])
  return null
}

// Animated route line component
function AnimatedRouteLine({ from, to }) {
  const map = useMap()
  const linesRef = useRef([])

  useEffect(() => {
    if (!from || !to || from.length < 2 || to.length < 2 || isNaN(from[0]) || isNaN(from[1]) || isNaN(to[0]) || isNaN(to[1])) return
    // Clean up previous lines
    linesRef.current.forEach(l => map.removeLayer(l))
    linesRef.current = []

    // Glow outer line
    const glow = L.polyline([from, to], {
      color: 'rgba(99,102,241,0.25)',
      weight: 14,
      lineCap: 'round',
    }).addTo(map)

    // Solid base line
    const base = L.polyline([from, to], {
      color: '#6366f1',
      weight: 4,
      lineCap: 'round',
    }).addTo(map)

    // Animated dashed overlay (marching ants)
    const dash = L.polyline([from, to], {
      color: '#a5b4fc',
      weight: 3,
      dashArray: '12 8',
      dashOffset: '0',
      lineCap: 'round',
      className: 'route-animated-dash',
    }).addTo(map)

    linesRef.current = [glow, base, dash]
    return () => {
      linesRef.current.forEach(l => { try { map.removeLayer(l) } catch {} })
    }
  }, [from, to, map])

  return null
}

// Custom distance label on polyline midpoint
function DistanceLabel({ from, to }) {
  const map = useMap()
  
  if (!from || !to || from.length < 2 || to.length < 2 || isNaN(from[0]) || isNaN(from[1]) || isNaN(to[0]) || isNaN(to[1])) {
    return null;
  }

  // from and to are [lat, lng], but turf expects [lng, lat]
  const dist = turf.distance(turf.point([from[1], from[0]]), turf.point([to[1], to[0]]), { units: 'kilometers' })
  const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]

  useEffect(() => {
    const icon = L.divIcon({
      className: 'distance-label',
      html: `<div style="background:rgba(15,23,42,0.9);color:#a5b4fc;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:bold;border:1px solid rgba(99,102,241,0.4);white-space:nowrap;box-shadow:0 2px 12px rgba(99,102,241,0.3);">${dist < 1 ? `${(dist*1000).toFixed(0)} m` : `${dist.toFixed(2)} km`}</div>`,
      iconSize: [0, 0],
    })
    const marker = L.marker([mid[0], mid[1]], { icon, interactive: false }).addTo(map)
    return () => { map.removeLayer(marker) }
  }, [from, to, map, dist])

  return null
}

// Route info card component
function RouteInfoCard({ alert, distance, onClose, etaSpeedKmh = 30 }) {
  const etaMinutes = Math.round((distance / etaSpeedKmh) * 60) // Uses dynamic speed
  
  const getRelativeTime = (dateStr) => {
    if (!dateStr) return '';
    const diffMin = Math.floor((new Date() - new Date(dateStr)) / 60000);
    if (diffMin < 1) return 'Instante';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Hace ${diffHr}h`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <div className="absolute bottom-20 left-4 right-4 z-[1000] animate-slideUp">
      <div className="rounded-2xl p-4 shadow-2xl"
        style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(99,102,241,0.2)' }}>
              <Navigation size={20} style={{ color: '#6366f1' }} />
            </div>
            <div>
              <h4 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Ruta trazada</h4>
              <p className="text-[10px] mt-0.5 max-w-[200px] truncate" style={{ color: 'var(--text-muted)' }}>
                {alert?.description || 'Ubicación compartida'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-xs px-2 py-1 rounded-lg"
            style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            Cerrar
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex-1 text-center p-2 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-lg font-black" style={{ color: 'var(--accent)' }}>
              {distance < 1 ? `${(distance * 1000).toFixed(0)}m` : `${distance.toFixed(1)}km`}
            </div>
            <div className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>Distancia</div>
          </div>
          <div className="flex-1 text-center p-2 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-lg font-black" style={{ color: 'var(--warning, #f59e0b)' }}>
              {etaMinutes < 60 ? `${etaMinutes}min` : `${Math.floor(etaMinutes / 60)}h${etaMinutes % 60}m`}
            </div>
            <div className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>ETA (vel={etaSpeedKmh}km/h)</div>
          </div>
          <div className="flex-1 text-center p-2 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="text-lg font-black" style={{ color: 'var(--danger)' }}>
              {getRelativeTime(alert?.created_at)}
            </div>
            <div className="text-[9px] font-medium" style={{ color: 'var(--text-muted)' }}>Lanzado</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MapView() {
  const { alerts, settings } = useAlertStore()
  const { user, profile: userProfile } = useAuthStore()
  const { position, loading: gpsLoading } = useGeolocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Tools state
  const [activeTool, setActiveTool] = useState(null)
  const [followUser, setFollowUser] = useState(true)
  const [activeLayer, setActiveLayer] = useState(settings.defaultMapLayer || 'standard')
  const [measureMode, setMeasureMode] = useState(null) // 'distance' | 'area' | null
  const [searchMarker, setSearchMarker] = useState(null)
  const [mapCenter] = useState([-12.5933, -69.1836])

  // Route tracing state
  const [routeAlert, setRouteAlert] = useState(null)
  const [routeBounds, setRouteBounds] = useState(null)

  useAlerts() // Subscribe to realtime alerts

  // Show all active alerts on the map (including the current user's own)
  const activeAlerts = useMemo(
    () => alerts.filter(a => a.is_active && a.latitude && a.longitude),
    [alerts]
  )


  // Handle URL params for route tracing (when clicking alert from Home or chat location)
  useEffect(() => {
    const alertId = searchParams.get('alertId')
    const routeLat = searchParams.get('lat')
    const routeLng = searchParams.get('lng')
    const routeDesc = searchParams.get('desc') || 'Ubicación compartida'
    const route = searchParams.get('route')
    
    if (route === 'true') {
      const parsedLat = parseFloat(routeLat)
      const parsedLng = parseFloat(routeLng)

      if (routeLat && routeLat !== 'undefined' && routeLng && routeLng !== 'undefined' && position && !isNaN(parsedLat) && !isNaN(parsedLng)) {
        // Use coordinates directly from URL (from Push Notification or Chat)
        const dummyAlert = {
          id: alertId || 'shared-location',
          latitude: parsedLat,
          longitude: parsedLng,
          description: routeDesc,
          created_at: new Date().toISOString()
        }
        setRouteAlert(dummyAlert)
        setRouteBounds(L.latLngBounds(
          [position.latitude, position.longitude],
          [dummyAlert.latitude, dummyAlert.longitude]
        ))
        setFollowUser(false)
        setSearchParams({}, { replace: true })
      } else if (alertId && position) {
        // Fallback: wait for alerts array to load and find it by ID
        const alert = alerts.find(a => a.id === alertId)
        if (alert) {
          setRouteAlert(alert)
          setRouteBounds(L.latLngBounds(
            [position.latitude, position.longitude],
            [alert.latitude, alert.longitude]
          ))
          setFollowUser(false)
          setSearchParams({}, { replace: true })
        }
      }
    }
  }, [searchParams, alerts, position])

  // Compute density clusters and convex hulls using Turf.js
  const { hulls, centroids } = useMemo(() => {
    if (activeAlerts.length < 2) return { hulls: [], centroids: [] }

    try {
      const points = turf.featureCollection(
        activeAlerts.map(a => turf.point([a.longitude, a.latitude], { id: a.id }))
      )

      const clustered = turf.clustersDbscan(points, 2, { minPoints: 2 })
      
      const clusterMap = {}
      turf.clusterEach(clustered, 'cluster', (cluster, clusterValue) => {
        if (clusterValue === undefined || clusterValue === null) return
        if (!clusterMap[clusterValue]) clusterMap[clusterValue] = []
        turf.featureEach(cluster, (feature) => {
          clusterMap[clusterValue].push(feature)
        })
      })

      const hullResults = []
      const centroidResults = []

      Object.values(clusterMap).forEach((clusterPoints) => {
        if (clusterPoints.length < 3) {
          const coords = clusterPoints.map(p => p.geometry.coordinates)
          const center = [(coords[0][0] + coords[1][0]) / 2, (coords[0][1] + coords[1][1]) / 2]
          centroidResults.push(center)
          const buffered = turf.buffer(turf.lineString(coords), 0.5, { units: 'kilometers' })
          if (buffered) hullResults.push(buffered.geometry.coordinates[0].map(c => [c[1], c[0]]))
        } else {
          const fc = turf.featureCollection(clusterPoints)
          const hull = turf.convex(fc)
          if (hull) {
            const buffered = turf.buffer(hull, 0.3, { units: 'kilometers' })
            if (buffered) {
              hullResults.push(buffered.geometry.coordinates[0].map(c => [c[1], c[0]]))
            }
            const centroid = turf.centroid(hull)
            centroidResults.push(centroid.geometry.coordinates)
          }
        }
      })

      return { hulls: hullResults, centroids: centroidResults }
    } catch (e) {
      console.warn('Error computing clusters:', e)
      return { hulls: [], centroids: [] }
    }
  }, [activeAlerts])

  // Lines from centroids to user position
  const distanceLines = useMemo(() => {
    if (!position || centroids.length === 0) return []
    return centroids.map(c => ({
      from: [position.latitude, position.longitude],
      to: [c[1], c[0]],
    }))
  }, [position, centroids])

  // Route line for alert navigation
  const routeLine = useMemo(() => {
    if (!routeAlert || !position) return null
    if (isNaN(position.latitude) || isNaN(position.longitude) || isNaN(routeAlert.latitude) || isNaN(routeAlert.longitude)) return null
    
    const from = [position.latitude, position.longitude]
    const to = [routeAlert.latitude, routeAlert.longitude]
    const dist = turf.distance(
      turf.point([position.longitude, position.latitude]),
      turf.point([routeAlert.longitude, routeAlert.latitude]),
      { units: 'kilometers' }
    )
    return { from, to, distance: dist }
  }, [routeAlert, position])

  // Auto-alert proximity check
  useEffect(() => {
    if (!position || !settings.soundEnabled) return
    activeAlerts.forEach(alert => {
      const dist = turf.distance(
        turf.point([position.longitude, position.latitude]),
        turf.point([alert.longitude, alert.latitude]),
        { units: 'kilometers' }
      )
      if (dist <= settings.autoAlertRadius) {
        if (settings.vibrationEnabled && navigator.vibrate) {
          navigator.vibrate([500, 200, 500])
        }
      }
    })
  }, [activeAlerts, position, settings])

  // Tool click handler
  const handleToolClick = useCallback((toolId) => {
    switch (toolId) {
      case 'follow':
        setFollowUser(f => !f)
        break
      case 'search':
        setActiveTool(activeTool === 'search' ? null : 'search')
        break
      case 'layers':
        setActiveTool(activeTool === 'layers' ? null : 'layers')
        break
      case 'distance':
        if (measureMode === 'distance') {
          setMeasureMode(null)
          setActiveTool(null)
        } else {
          setMeasureMode('distance')
          setActiveTool('distance')
        }
        break
      case 'area':
        if (measureMode === 'area') {
          setMeasureMode(null)
          setActiveTool(null)
        } else {
          setMeasureMode('area')
          setActiveTool('area')
        }
        break
      case 'lastAlert':
        if (activeAlerts.length > 0) {
          const latest = activeAlerts[0] // already sorted desc by created_at
          setRouteAlert(latest)
          if (position) {
            setRouteBounds(L.latLngBounds(
              [position.latitude, position.longitude],
              [latest.latitude, latest.longitude]
            ))
          }
          setFollowUser(false)
        }
        break
      case 'settings':
        setActiveTool(activeTool === 'settings' ? null : 'settings')
        break
      default:
        break
    }
  }, [activeTool, measureMode, activeAlerts, position])

  const handleLayerSelect = (layer) => {
    setActiveLayer(layer.id)
    useAlertStore.getState().updateSettings({ defaultMapLayer: layer.id })
  }

  const currentLayer = LAYERS.find(l => l.id === activeLayer) || LAYERS[0]
  const userPos = position ? [position.latitude, position.longitude] : mapCenter

  return (
    <div className="h-full w-full relative">
      <MapContainer center={userPos} zoom={13} className="h-full w-full" zoomControl={false} doubleClickZoom={!measureMode}>
        <TileLayer
          key={currentLayer.id}
          attribution={currentLayer.attribution}
          url={currentLayer.url}
        />

        {followUser && position && <RecenterMap position={position} />}
        {routeBounds && <FitBounds bounds={routeBounds} />}

        {/* User position */}
        {position && (
          <>
            <Marker position={userPos} icon={L.divIcon({
              className: 'custom-user-marker',
              html: `
                <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 44px; height: 44px;">
                  <div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(34, 197, 94, 0.5); filter: blur(8px); animation: pulse 2s infinite;"></div>
                  <img src="${userProfile?.avatar_url || `https://ui-avatars.com/api/?name=${userProfile?.name || 'U'}&background=22c55e&color=fff`}" style="width: 36px; height: 36px; border-radius: 50%; border: 2.5px solid #22c55e; position: relative; z-index: 1; object-fit: cover;" referrerpolicy="no-referrer" />
                  <div style="position: absolute; bottom: -2px; right: -2px; background: #22c55e; border-radius: 50%; width: 14px; height: 14px; border: 2px solid white; z-index: 2;"></div>
                </div>
              `,
              iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -22]
            })}>
              <Popup><b>Tu ubicación</b><br />Precisión: {position.accuracy?.toFixed(0)}m</Popup>
            </Marker>
            <Circle center={userPos} radius={settings.autoAlertRadius * 1000}
              pathOptions={{ fillColor: '#22c55e', color: '#22c55e', fillOpacity: 0.05, weight: 1, dashArray: '10,5' }} />
          </>
        )}

        {/* Search result marker */}
        {searchMarker && (
          <Marker position={[searchMarker.lat, searchMarker.lon]} icon={searchIcon}>
            <Popup>
              <div style={{ minWidth: 150 }}>
                <div style={{ fontWeight: 'bold', fontSize: 12, marginBottom: 4 }}>📍 {searchMarker.name}</div>
                <div style={{ fontSize: 10, color: '#999' }}>{searchMarker.fullName}</div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Alert markers */}
        {activeAlerts.map(alert => {
          const firstWord = alert.description?.split(' ')[0] || ''
          const emoji = /\p{Extended_Pictographic}/u.test(firstWord) ? firstWord : '⚠️'
          const avatarUrl = alert.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${alert.profiles?.name || 'A'}&background=dc2626&color=fff`
          
          return (
            <React.Fragment key={alert.id}>
              <Marker position={[alert.latitude, alert.longitude]} icon={L.divIcon({
                className: 'custom-alert-marker',
                html: `
                  <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 48px; height: 48px;">
                    <div style="position: absolute; inset: 0; border-radius: 50%; background: rgba(220, 38, 38, 0.6); filter: blur(10px); animation: pulse 1.5s infinite;"></div>
                    <img src="${avatarUrl}" style="width: 40px; height: 40px; border-radius: 50%; border: 3px solid #dc2626; position: relative; z-index: 1; object-fit: cover; box-shadow: 0 4px 10px rgba(220,38,38,0.5);" referrerpolicy="no-referrer" />
                    <div style="position: absolute; bottom: -6px; right: -6px; background: white; border-radius: 50%; padding: 3px; font-size: 16px; line-height: 1; box-shadow: 0 2px 6px rgba(0,0,0,0.4); z-index: 2;">
                      ${emoji}
                    </div>
                  </div>
                `,
                iconSize: [48, 48], iconAnchor: [24, 24], popupAnchor: [0, -24]
              })}>
                <Popup>
                  <div style={{ minWidth: 180 }}>
                    <div style={{ fontWeight: 'bold', color: '#dc2626', marginBottom: 4 }}>${emoji} ALERTA</div>
                    <div style={{ fontSize: 12, marginBottom: 4 }}>{alert.description || 'Sin descripción'}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>
                      {new Date(alert.created_at).toLocaleString('es-PE')}
                    </div>
                    {position && (
                      <div style={{ fontSize: 11, color: '#666', marginTop: 4 }}>
                        📏 {turf.distance(
                          turf.point([position.longitude, position.latitude]),
                          turf.point([alert.longitude, alert.latitude]),
                          { units: 'kilometers' }
                        ).toFixed(2)} km de ti
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
              <Circle center={[alert.latitude, alert.longitude]} radius={300}
                pathOptions={{ fillColor: '#dc2626', color: '#dc2626', fillOpacity: 0.15, weight: 1 }} />
            </React.Fragment>
          )
        })}

        {/* Density polygons (convex hulls) */}
        {hulls.map((hull, i) => (
          <Polygon key={`hull-${i}`} positions={hull}
            pathOptions={{ fillColor: '#dc2626', color: '#fbbf24', fillOpacity: 0.15, weight: 2, dashArray: '8,4' }} />
        ))}

        {/* Distance lines from polygon centroids to user */}
        {distanceLines.map((line, i) => (
          <React.Fragment key={`line-${i}`}>
            <Polyline positions={[line.from, line.to]}
              pathOptions={{ color: '#fbbf24', weight: 2, dashArray: '12,8', opacity: 0.8 }} />
            <DistanceLabel from={[line.from[0], line.from[1]]} to={[line.to[0], line.to[1]]} />
          </React.Fragment>
        ))}

        {/* Route line to specific location — animated */}
        {routeLine && (
          <>
            <AnimatedRouteLine from={routeLine.from} to={routeLine.to} />
            <DistanceLabel from={routeLine.from} to={routeLine.to} />
            {/* Destination marker */}
            <Marker position={routeLine.to} icon={L.divIcon({
              className: '',
              html: `
                <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
                  <div style="position:absolute;inset:0;border-radius:50%;background:rgba(99,102,241,0.35);animation:pulse 1.5s infinite;"></div>
                  <div style="width:26px;height:26px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#3b82f6);border:3px solid white;position:relative;z-index:1;box-shadow:0 2px 10px rgba(99,102,241,0.6);"></div>
                </div>
              `,
              iconSize: [40,40], iconAnchor: [20,20]
            })} />
          </>
        )}

        {/* Measurement overlay */}
        <MeasurementOverlay
          mode={measureMode}
          onClear={() => { setMeasureMode(null); setActiveTool(null) }}
        />

        {/* Search panel */}
        <MapSearch
          isOpen={activeTool === 'search'}
          onClose={() => setActiveTool(null)}
          onSelectLocation={(loc) => { setSearchMarker(loc); setActiveTool(null) }}
        />

        {/* Layer switcher */}
        <MapLayerSwitcher
          isOpen={activeTool === 'layers'}
          onClose={() => setActiveTool(null)}
          activeLayer={activeLayer}
          onSelectLayer={handleLayerSelect}
        />
      </MapContainer>

      {/* Map toolbar */}
      <MapToolbar
        activeTool={activeTool}
        onToolClick={handleToolClick}
        followUser={followUser}
      />

      {/* Alert counter badge */}
      <div className="absolute top-4 left-4 z-[1000]">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: 'var(--glass)', backdropFilter: 'blur(12px)', border: '1px solid var(--border)' }}>
          <AlertTriangle size={14} style={{ color: 'var(--danger)' }} />
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{activeAlerts.length}</span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>alertas activas</span>
        </div>
      </div>

      {/* GPS loading indicator */}
      {gpsLoading && (
        <div className="absolute bottom-20 left-4 z-[1000] px-3 py-2 rounded-xl flex items-center gap-2"
          style={{ background: 'rgba(245,158,11,0.9)', backdropFilter: 'blur(8px)' }}>
          <Crosshair size={14} className="text-white animate-pulse" />
          <span className="text-xs text-white font-medium">Buscando GPS...</span>
        </div>
      )}

      {/* Route info card */}
      {routeLine && routeAlert && (
        <RouteInfoCard
          alert={routeAlert}
          distance={routeLine.distance}
          etaSpeedKmh={settings.etaSpeedKmh || 30}
          onClose={() => { setRouteAlert(null); setRouteBounds(null) }}
        />
      )}

      {/* Map settings panel */}
      {activeTool === 'settings' && (
        <div className="absolute bottom-20 right-4 z-[1000] rounded-2xl p-4 w-72 shadow-2xl animate-fadeIn"
          style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border)' }}>
          <h3 className="font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Configuración del Mapa</h3>
          
          <div className="space-y-3">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Radio de alerta automática</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0.5" max="20" step="0.5"
                  value={useAlertStore.getState().settings.autoAlertRadius}
                  onChange={(e) => useAlertStore.getState().updateSettings({ autoAlertRadius: parseFloat(e.target.value) })}
                  className="flex-1 accent-red-500" />
                <span className="text-sm font-bold w-12 text-right" style={{ color: 'var(--text-primary)' }}>
                  {useAlertStore.getState().settings.autoAlertRadius} km
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Velocidad estimada (ETA)</label>
              <div className="flex items-center gap-3">
                <input type="range" min="5" max="120" step="5"
                  value={useAlertStore.getState().settings.etaSpeedKmh || 30}
                  onChange={(e) => useAlertStore.getState().updateSettings({ etaSpeedKmh: parseInt(e.target.value) })}
                  className="flex-1 accent-blue-500" />
                <span className="text-sm font-bold w-16 text-right" style={{ color: 'var(--text-primary)' }}>
                  {useAlertStore.getState().settings.etaSpeedKmh || 30} km/h
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Sonido de alerta</span>
              <button onClick={() => useAlertStore.getState().updateSettings({ soundEnabled: !useAlertStore.getState().settings.soundEnabled })}
                className={`w-10 h-5 rounded-full transition-colors ${useAlertStore.getState().settings.soundEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${useAlertStore.getState().settings.soundEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Vibración</span>
              <button onClick={() => useAlertStore.getState().updateSettings({ vibrationEnabled: !useAlertStore.getState().settings.vibrationEnabled })}
                className={`w-10 h-5 rounded-full transition-colors ${useAlertStore.getState().settings.vibrationEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transform transition-transform ${useAlertStore.getState().settings.vibrationEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>

          <button onClick={() => setActiveTool(null)}
            className="mt-3 w-full text-center text-xs transition-colors hover:opacity-80"
            style={{ color: 'var(--text-muted)' }}>
            Cerrar
          </button>
        </div>
      )}
    </div>
  )
}
