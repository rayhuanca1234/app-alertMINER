import React from 'react'
import { useMap } from 'react-leaflet'
import { X } from 'lucide-react'

const LAYERS = [
  {
    id: 'standard',
    name: 'Estándar',
    emoji: '🗺️',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>',
    preview: 'linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 50%, #e8f5e9 100%)',
  },
  {
    id: 'satellite',
    name: 'Satélite',
    emoji: '🛰️',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri',
    preview: 'linear-gradient(135deg, #1a3a1a 0%, #2d5016 50%, #0d2b0d 100%)',
  },
  {
    id: 'terrain',
    name: 'Relieve',
    emoji: '⛰️',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>',
    preview: 'linear-gradient(135deg, #f5e6d3 0%, #d4a574 50%, #8fbc8f 100%)',
  },
  {
    id: 'dark',
    name: 'Oscuro',
    emoji: '🌑',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    preview: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
  },
]

export { LAYERS }

export default function MapLayerSwitcher({ isOpen, onClose, activeLayer, onSelectLayer }) {
  if (!isOpen) return null

  return (
    <div className="absolute top-4 right-16 z-[1000] animate-fadeIn" onClick={(e) => e.stopPropagation()}>
      <div className="rounded-2xl overflow-hidden shadow-2xl p-3 w-56"
        style={{ background: 'var(--glass)', backdropFilter: 'blur(16px)', border: '1px solid var(--border)' }}>
        
        <div className="flex items-center justify-between mb-3 px-1">
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>Capas del Mapa</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {LAYERS.map(layer => (
            <button
              key={layer.id}
              onClick={() => { onSelectLayer(layer); onClose() }}
              className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all border"
              style={{
                background: activeLayer === layer.id ? 'var(--accent-glow)' : 'transparent',
                borderColor: activeLayer === layer.id ? 'var(--accent)' : 'var(--border)',
              }}>
              <div className="w-full h-10 rounded-lg" style={{ background: layer.preview }} />
              <span className="text-[10px] font-medium" style={{
                color: activeLayer === layer.id ? 'var(--accent)' : 'var(--text-secondary)'
              }}>
                {layer.emoji} {layer.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
