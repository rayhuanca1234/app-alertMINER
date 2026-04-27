import React, { useState, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Download } from 'lucide-react'

export default function MediaViewer({ src, type, onClose }) {
  const [scale, setScale] = useState(1)

  // Block background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = 'auto' }
  }, [])

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = src
    a.download = `mineralert_media_${Date.now()}`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 backdrop-blur-sm animate-fadeIn">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
        <button onClick={onClose} className="p-2 text-white hover:bg-white/20 rounded-full transition">
          <X size={24} />
        </button>
        <div className="flex gap-2 text-white">
          {type === 'IMAGE' && (
            <>
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-2 hover:bg-white/20 rounded-full"><ZoomOut size={20} /></button>
              <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-2 hover:bg-white/20 rounded-full"><ZoomIn size={20} /></button>
            </>
          )}
          <button onClick={handleDownload} className="p-2 hover:bg-white/20 rounded-full"><Download size={20} /></button>
        </div>
      </div>

      {/* Content */}
      <div className="w-full h-full flex items-center justify-center p-4 overflow-hidden" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="transition-transform duration-200" style={{ transform: `scale(${scale})` }}>
          {type === 'IMAGE' ? (
            <img src={src} alt="Vista completa" className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl" draggable={false} />
          ) : (
            <video src={src} controls autoPlay className="max-w-full max-h-[90vh] rounded shadow-2xl" />
          )}
        </div>
      </div>
    </div>
  )
}
