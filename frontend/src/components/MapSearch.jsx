import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useMap } from 'react-leaflet'
import { Search, X, MapPin, Loader2 } from 'lucide-react'

export default function MapSearch({ isOpen, onClose, onSelectLocation }) {
  const map = useMap()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const searchPlaces = useCallback(async (q) => {
    if (q.length < 3) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=6&accept-language=es`
      )
      const data = await response.json()
      setResults(data.map(r => ({
        id: r.place_id,
        name: r.display_name.split(',').slice(0, 3).join(', '),
        fullName: r.display_name,
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        type: r.type,
      })))
    } catch (e) {
      console.warn('Search error:', e)
      setResults([])
    }
    setLoading(false)
  }, [])

  const handleInput = (value) => {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchPlaces(value), 400)
  }

  const handleSelect = (result) => {
    map.flyTo([result.lat, result.lon], 16, { duration: 1.5 })
    if (onSelectLocation) onSelectLocation(result)
    setQuery(result.name)
    setResults([])
  }

  if (!isOpen) return null

  return (
    <div className="absolute top-4 left-4 right-16 z-[1000] animate-fadeIn" onClick={(e) => e.stopPropagation()}>
      <div className="rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border)' }}>
        
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3">
          <Search size={16} style={{ color: 'var(--accent)' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInput(e.target.value)}
            placeholder="Buscar lugar, dirección..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-500"
            style={{ color: 'var(--text-primary)' }}
          />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]) }}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
              style={{ color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          )}
          <button onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Loading indicator */}
        {loading && (
          <div className="flex items-center justify-center py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent)' }} />
            <span className="ml-2 text-xs" style={{ color: 'var(--text-secondary)' }}>Buscando...</span>
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {results.map((result, idx) => (
              <button
                key={result.id || idx}
                onClick={() => handleSelect(result)}
                className="w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-white/5"
                style={{ borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <MapPin size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{result.name}</p>
                  <p className="text-[10px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{result.fullName}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* No results */}
        {query.length >= 3 && !loading && results.length === 0 && (
          <div className="py-4 text-center text-xs" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
            No se encontraron resultados
          </div>
        )}
      </div>
    </div>
  )
}
