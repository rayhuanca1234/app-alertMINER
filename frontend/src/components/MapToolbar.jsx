import React from 'react'
import {
  Navigation, Search, Layers, Ruler, PenTool, AlertTriangle, 
  Settings2, Crosshair, ZoomIn, ZoomOut
} from 'lucide-react'

const TOOLS = [
  { id: 'follow', icon: Navigation, label: 'Mi ubicación', toggle: true },
  { id: 'search', icon: Search, label: 'Buscar lugar' },
  { id: 'layers', icon: Layers, label: 'Capas del mapa' },
  { id: 'divider1', divider: true },
  { id: 'distance', icon: Ruler, label: 'Medir distancia', toggle: true },
  { id: 'area', icon: PenTool, label: 'Medir área', toggle: true },
  { id: 'divider2', divider: true },
  { id: 'lastAlert', icon: AlertTriangle, label: 'Última alerta' },
  { id: 'settings', icon: Settings2, label: 'Configuración' },
]

export default function MapToolbar({ activeTool, onToolClick, followUser }) {
  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-1.5">
      {TOOLS.map(tool => {
        if (tool.divider) {
          return <div key={tool.id} className="h-px mx-1 my-0.5" style={{ background: 'var(--border)' }} />
        }

        const Icon = tool.icon
        const isActive = tool.id === 'follow' 
          ? followUser 
          : activeTool === tool.id

        return (
          <button
            key={tool.id}
            onClick={() => onToolClick(tool.id)}
            className="group relative p-2.5 rounded-xl shadow-lg transition-all duration-200 active:scale-90"
            style={{
              background: isActive 
                ? 'var(--accent)' 
                : 'var(--glass, rgba(15,23,42,0.9))',
              backdropFilter: 'blur(12px)',
              border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
              color: isActive ? 'white' : 'var(--text-secondary)',
              boxShadow: isActive ? 'var(--shadow), 0 0 20px var(--accent-glow)' : 'var(--shadow)',
            }}
            title={tool.label}
          >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
            
            {/* Tooltip */}
            <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
              style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
              {tool.label}
            </span>

            {/* Pulse for alert button */}
            {tool.id === 'lastAlert' && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--danger)' }} />
            )}
          </button>
        )
      })}
    </div>
  )
}
