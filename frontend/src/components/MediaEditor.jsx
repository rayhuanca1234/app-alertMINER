import React, { useState, useRef, useEffect, useCallback } from 'react'
import {
  X, Send, RotateCw, Crop, Pencil, Type, Palette,
  Undo2, Download, SunMedium, Contrast, ZoomIn, Camera, SwitchCamera
} from 'lucide-react'

/* ─── filter presets ─── */
const FILTERS = [
  { label: 'Original', value: 'none' },
  { label: 'B/N', value: 'grayscale(100%)' },
  { label: 'Sepia', value: 'sepia(80%)' },
  { label: 'Brillo', value: 'brightness(1.3)' },
  { label: 'Contraste', value: 'contrast(1.4)' },
  { label: 'Saturado', value: 'saturate(1.6)' },
  { label: 'Cálido', value: 'sepia(30%) saturate(1.4)' },
  { label: 'Frío', value: 'hue-rotate(180deg) saturate(0.8)' },
  { label: 'Vintage', value: 'sepia(50%) contrast(0.9) brightness(1.1)' },
]

const DRAW_COLORS = ['#ffffff','#ff3b30','#ff9500','#ffcc00','#34c759','#007aff','#5856d6','#ff2d55','#000000']

export default function MediaEditor({ files, onSend, onClose }) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [caption, setCaption] = useState('')
  const [mode, setMode] = useState(null) // null | 'draw' | 'text' | 'filter' | 'crop'
  const [filter, setFilter] = useState('none')
  const [rotation, setRotation] = useState(0)
  const [drawings, setDrawings] = useState([])
  const [textOverlays, setTextOverlays] = useState([])
  const [drawColor, setDrawColor] = useState('#ffffff')
  const [drawSize, setDrawSize] = useState(3)
  const [isDrawing, setIsDrawing] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [editedFiles, setEditedFiles] = useState([...files])
  
  const canvasRef = useRef(null)
  const containerRef = useRef(null)
  const drawCanvasRef = useRef(null)

  const [thumbnailUrls, setThumbnailUrls] = useState([])

  // Generate stable blob URLs for all files
  useEffect(() => {
    if (!files || files.length === 0) return
    const urls = files.map(f => URL.createObjectURL(f))
    setThumbnailUrls(urls)
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [files])

  const currentFile = editedFiles[activeIdx]
  const isImage = currentFile?.type?.startsWith('image')
  const isVideo = currentFile?.type?.startsWith('video')
  const previewUrl = thumbnailUrls[activeIdx]

  // Block body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Escape key
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  /* ─── Drawing Logic ─── */
  const startDraw = useCallback((e) => {
    if (mode !== 'draw') return
    setIsDrawing(true)
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.strokeStyle = drawColor
    ctx.lineWidth = drawSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [mode, drawColor, drawSize])

  const draw = useCallback((e) => {
    if (!isDrawing || mode !== 'draw') return
    const canvas = drawCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const rect = canvas.getBoundingClientRect()
    const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left
    const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    ctx.lineTo(x, y)
    ctx.stroke()
  }, [isDrawing, mode])

  const endDraw = useCallback(() => {
    if (isDrawing) {
      setIsDrawing(false)
      // Save drawing state for undo
      const canvas = drawCanvasRef.current
      if (canvas) {
        setDrawings(prev => [...prev, canvas.toDataURL()])
      }
    }
  }, [isDrawing])

  const clearDrawings = () => {
    const canvas = drawCanvasRef.current
    if (canvas) {
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    setDrawings([])
  }

  /* ─── Text overlay ─── */
  const addTextOverlay = () => {
    if (!textInput.trim()) return
    setTextOverlays(prev => [...prev, {
      text: textInput.trim(),
      x: 50, y: 50,
      color: drawColor,
      size: 24,
      id: Date.now()
    }])
    setTextInput('')
    setMode(null)
  }

  /* ─── Rotate ─── */
  const handleRotate = () => {
    setRotation(r => (r + 90) % 360)
  }

  /* ─── Export & Send ─── */
  const handleSend = async () => {
    // For now, send the original files with caption
    // In a production app, you'd composite the canvas with drawings/text/filter
    onSend(editedFiles, caption)
  }

  /* ─── Render ─── */
  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col" style={{ touchAction: 'none' }}>
      {/* ── Top toolbar ── */}
      <div className="flex items-center justify-between p-3 bg-black/80 z-10">
        <button onClick={onClose} className="p-2 text-white hover:bg-white/10 rounded-full transition">
          <X size={22} />
        </button>
        
        <div className="flex items-center gap-1">
          {isImage && (
            <>
              <button onClick={handleRotate}
                className={`p-2 text-white hover:bg-white/10 rounded-full transition`}>
                <RotateCw size={20} />
              </button>
              <button onClick={() => setMode(mode === 'draw' ? null : 'draw')}
                className={`p-2 rounded-full transition ${mode === 'draw' ? 'bg-blue-600 text-white' : 'text-white hover:bg-white/10'}`}>
                <Pencil size={20} />
              </button>
              <button onClick={() => setMode(mode === 'text' ? null : 'text')}
                className={`p-2 rounded-full transition ${mode === 'text' ? 'bg-blue-600 text-white' : 'text-white hover:bg-white/10'}`}>
                <Type size={20} />
              </button>
              <button onClick={() => setMode(mode === 'filter' ? null : 'filter')}
                className={`p-2 rounded-full transition ${mode === 'filter' ? 'bg-blue-600 text-white' : 'text-white hover:bg-white/10'}`}>
                <Palette size={20} />
              </button>
              {drawings.length > 0 && (
                <button onClick={clearDrawings} className="p-2 text-white hover:bg-white/10 rounded-full transition">
                  <Undo2 size={20} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Draw color picker ── */}
      {mode === 'draw' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-black/60 animate-fadeIn">
          {DRAW_COLORS.map(c => (
            <button key={c} onClick={() => setDrawColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition-transform ${drawColor === c ? 'scale-125 border-white' : 'border-transparent'}`}
              style={{ background: c }} />
          ))}
          <input type="range" min="1" max="12" value={drawSize} onChange={(e) => setDrawSize(parseInt(e.target.value))}
            className="ml-2 w-20 accent-blue-500" />
        </div>
      )}

      {/* ── Text input ── */}
      {mode === 'text' && (
        <div className="flex items-center gap-2 px-4 py-2 bg-black/60 animate-fadeIn">
          <div className="flex gap-1.5 mr-2">
            {DRAW_COLORS.slice(0, 6).map(c => (
              <button key={c} onClick={() => setDrawColor(c)}
                className={`w-5 h-5 rounded-full border-2 ${drawColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                style={{ background: c }} />
            ))}
          </div>
          <input type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)}
            placeholder="Escribe texto..." 
            className="flex-1 bg-white/10 text-white px-3 py-2 rounded-lg text-sm outline-none"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') addTextOverlay() }} />
          <button onClick={addTextOverlay} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">
            OK
          </button>
        </div>
      )}

      {/* ── Filter picker ── */}
      {mode === 'filter' && (
        <div className="flex gap-3 px-4 py-2 overflow-x-auto bg-black/60 animate-fadeIn">
          {FILTERS.map(f => (
            <button key={f.label} onClick={() => setFilter(f.value)}
              className={`flex flex-col items-center shrink-0 transition ${filter === f.value ? 'opacity-100' : 'opacity-60'}`}>
              <div className="w-14 h-14 rounded-lg overflow-hidden border-2 mb-1"
                style={{ borderColor: filter === f.value ? '#3b82f6' : 'transparent' }}>
                {previewUrl && <img src={previewUrl} alt="" className="w-full h-full object-cover" style={{ filter: f.value }} />}
              </div>
              <span className={`text-[10px] ${filter === f.value ? 'text-blue-400 font-bold' : 'text-white/60'}`}>{f.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Main preview area ── */}
      <div ref={containerRef} className="flex-1 flex items-center justify-center overflow-hidden relative"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}>
        
        {isImage && previewUrl && (
          <img src={previewUrl} alt="Preview"
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{ filter: filter, transform: `rotate(${rotation}deg)` }}
            draggable={false} />
        )}
        
        {isVideo && previewUrl && (
          <video src={previewUrl} controls className="max-w-full max-h-full object-contain" />
        )}

        {/* Drawing canvas overlay */}
        {mode === 'draw' && (
          <canvas ref={drawCanvasRef}
            width={containerRef.current?.clientWidth || 400}
            height={containerRef.current?.clientHeight || 600}
            className="absolute inset-0 z-10"
            style={{ cursor: 'crosshair' }} />
        )}

        {/* Text overlays */}
        {textOverlays.map(t => (
          <div key={t.id} className="absolute z-20 cursor-move select-none px-2 py-1 rounded"
            style={{ left: `${t.x}%`, top: `${t.y}%`, color: t.color, fontSize: `${t.size}px`, fontWeight: 'bold',
              textShadow: '0 2px 8px rgba(0,0,0,0.7)', transform: 'translate(-50%, -50%)' }}>
            {t.text}
          </div>
        ))}
      </div>

      {/* ── Multi-file thumbnails ── */}
      {editedFiles.length > 1 && (
        <div className="flex gap-2 px-4 py-2 bg-black/80 overflow-x-auto">
          {editedFiles.map((f, i) => {
            const url = thumbnailUrls[i]
            return (
              <button key={i} onClick={() => setActiveIdx(i)}
                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition ${activeIdx === i ? 'border-blue-500' : 'border-transparent opacity-60'}`}>
                {f.type.startsWith('image') ? (
                  <img src={url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-slate-700 flex items-center justify-center text-white text-xs">🎬</div>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* ── Bottom: Caption + Send ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-black/90 border-t border-white/10">
        <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)}
          placeholder="Añade un comentario..."
          className="flex-1 bg-white/10 text-white px-4 py-2.5 rounded-full text-sm outline-none placeholder:text-white/40 border border-white/10 focus:border-blue-500 transition"
          onKeyDown={(e) => { if (e.key === 'Enter') handleSend() }} />
        <button onClick={handleSend}
          className="w-11 h-11 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full flex items-center justify-center shrink-0 transition active:scale-90 shadow-lg shadow-emerald-500/30">
          <Send size={20} />
        </button>
      </div>
    </div>
  )
}
