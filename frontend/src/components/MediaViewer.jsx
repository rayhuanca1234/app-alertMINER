import React, { useState, useEffect } from 'react'
import { X, ZoomIn, ZoomOut, Download, ChevronLeft, ChevronRight } from 'lucide-react'

export default function MediaViewer({ mediaList = [], initialIndex = 0, onClose }) {
  const [scale, setScale] = useState(1)
  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  const currentMedia = mediaList[currentIndex] || { url: '', type: 'IMAGE' }

  // Block background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = 'auto' }
  }, [])

  // Handle escape key and arrows
  useEffect(() => {
    const handleKeyDown = (e) => { 
      if (e.key === 'Escape') onClose() 
      if (e.key === 'ArrowRight') handleNext()
      if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, mediaList])

  const handleNext = (e) => {
    if (e) e.stopPropagation()
    if (currentIndex < mediaList.length - 1) {
      setCurrentIndex(c => c + 1)
      setScale(1)
    }
  }

  const handlePrev = (e) => {
    if (e) e.stopPropagation()
    if (currentIndex > 0) {
      setCurrentIndex(c => c - 1)
      setScale(1)
    }
  }

  // Touch Swipe handlers
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)

  const minSwipeDistance = 50

  const onTouchStart = (e) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX)

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      handleNext()
    } else if (isRightSwipe) {
      handlePrev()
    }
  }

  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = currentMedia.url
    a.download = `mineralert_media_${Date.now()}`
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (!mediaList || mediaList.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm animate-fadeIn">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
        <button onClick={onClose} className="p-2 text-white hover:bg-white/20 rounded-full transition">
          <X size={24} />
        </button>
        <div className="text-white font-medium text-sm">
          {mediaList.length > 1 ? `${currentIndex + 1} de ${mediaList.length}` : ''}
        </div>
        <div className="flex gap-2 text-white">
          {currentMedia.type === 'IMAGE' && (
            <>
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-2 hover:bg-white/20 rounded-full"><ZoomOut size={20} /></button>
              <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-2 hover:bg-white/20 rounded-full"><ZoomIn size={20} /></button>
            </>
          )}
          <button onClick={handleDownload} className="p-2 hover:bg-white/20 rounded-full"><Download size={20} /></button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {mediaList.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button onClick={handlePrev} className="absolute left-4 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition z-20 hidden md:block">
              <ChevronLeft size={32} />
            </button>
          )}
          {currentIndex < mediaList.length - 1 && (
            <button onClick={handleNext} className="absolute right-4 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition z-20 hidden md:block">
              <ChevronRight size={32} />
            </button>
          )}
        </>
      )}

      {/* Content */}
      <div 
        className="w-full flex-1 flex items-center justify-center p-4 overflow-hidden" 
        onClick={onClose}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div onClick={e => e.stopPropagation()} className="transition-transform duration-200 flex items-center justify-center" style={{ transform: `scale(${scale})` }}>
          {currentMedia.type === 'IMAGE' ? (
            <img src={currentMedia.url} alt="Vista completa" className="max-w-full max-h-[80vh] object-contain rounded shadow-2xl" draggable={false} />
          ) : (
            <video src={currentMedia.url} controls autoPlay className="max-w-full max-h-[80vh] rounded shadow-2xl" />
          )}
        </div>
      </div>

      {/* Bottom Filmstrip */}
      {mediaList.length > 1 && (
        <div className="w-full h-24 bg-black/50 flex items-center gap-2 px-4 overflow-x-auto pb-4 pt-2 shrink-0">
          {mediaList.map((media, idx) => (
            <button 
              key={idx}
              onClick={() => { setCurrentIndex(idx); setScale(1); }}
              className={`relative h-full shrink-0 aspect-square rounded-md overflow-hidden transition-all duration-300 ${currentIndex === idx ? 'ring-2 ring-blue-500 scale-105 opacity-100' : 'opacity-50 hover:opacity-100'}`}
            >
              {media.type === 'IMAGE' ? (
                <img src={media.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center relative">
                  <video src={media.url} className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20"><div className="w-4 h-4 bg-white rounded-sm opacity-80" /></div>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
