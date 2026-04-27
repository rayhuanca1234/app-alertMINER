import { useState, useEffect, useCallback } from 'react'

export function useGeolocation(options = {}) {
  const [position, setPosition] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  const defaultOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 30000,
    ...options
  }

  const updatePosition = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalización no soportada en este navegador')
      setLoading(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp
        })
        setLoading(false)
        setError(null)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
        // Fallback: Puerto Maldonado
        setPosition({ latitude: -12.5933, longitude: -69.1836, accuracy: 0, timestamp: Date.now() })
      },
      defaultOptions
    )
  }, [])

  useEffect(() => {
    updatePosition()

    // Watch position for real-time updates
    let watchId = null
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setPosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            timestamp: pos.timestamp
          })
        },
        (err) => setError(err.message),
        { ...defaultOptions, maximumAge: 5000 }
      )
    }

    return () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    }
  }, [updatePosition])

  return { position, error, loading, refresh: updatePosition }
}
