import React, { useState, useRef } from 'react'
import { Image, Video, Mic, X, Loader2 } from 'lucide-react'

export default function MediaUpload({ onUpload, disabled }) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [preview, setPreview] = useState(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const fileInputRef = useRef(null)
  const videoInputRef = useRef(null)

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview({ type: 'IMAGE', file, url: URL.createObjectURL(file) })
  }

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      alert('El video no puede superar 50MB')
      return
    }
    setPreview({ type: 'VIDEO', file, url: URL.createObjectURL(file) })
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      mediaRecorderRef.current = mediaRecorder
      chunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' })
        stream.getTracks().forEach(track => track.stop())
        clearInterval(timerRef.current)
        setRecordingTime(0)
        setIsRecording(false)
        // Upload directly
        onUpload(file, 'AUDIO')
      }

      mediaRecorder.start()
      setIsRecording(true)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (err) {
      alert('No se pudo acceder al micrófono. Verifica permisos.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const confirmUpload = () => {
    if (preview) {
      onUpload(preview.file, preview.type)
      clearPreview()
    }
  }

  const clearPreview = () => {
    if (preview?.url) URL.revokeObjectURL(preview.url)
    setPreview(null)
  }

  const formatTime = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // Preview modal
  if (preview) {
    return (
      <div className="absolute bottom-full left-0 right-0 bg-slate-800 border-t border-slate-700 p-4 animate-slideUp">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-bold text-slate-300">Vista previa</span>
          <button onClick={clearPreview} className="text-slate-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {preview.type === 'IMAGE' && (
            <img src={preview.url} alt="" className="w-20 h-20 rounded-lg object-cover" />
          )}
          {preview.type === 'VIDEO' && (
            <video src={preview.url} className="w-32 h-20 rounded-lg object-cover" controls />
          )}
          <button onClick={confirmUpload} disabled={disabled}
            className="ml-auto bg-blue-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-blue-500 transition-colors disabled:opacity-50">
            Enviar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      {/* Image */}
      <input type="file" ref={fileInputRef} accept="image/*" capture="environment"
        className="hidden" onChange={handleImageSelect} />
      <button onClick={() => fileInputRef.current?.click()} disabled={disabled || isRecording}
        className="p-2 text-slate-400 hover:text-emerald-400 hover:bg-slate-700 rounded-xl transition-all disabled:opacity-30"
        title="Enviar imagen">
        <Image size={20} />
      </button>

      {/* Video */}
      <input type="file" ref={videoInputRef} accept="video/*" capture="environment"
        className="hidden" onChange={handleVideoSelect} />
      <button onClick={() => videoInputRef.current?.click()} disabled={disabled || isRecording}
        className="p-2 text-slate-400 hover:text-purple-400 hover:bg-slate-700 rounded-xl transition-all disabled:opacity-30"
        title="Enviar video">
        <Video size={20} />
      </button>

      {/* Audio Recording */}
      {isRecording ? (
        <button onClick={stopRecording}
          className="flex items-center gap-2 px-3 py-2 bg-red-600 rounded-xl animate-pulse text-white text-sm font-bold">
          <div className="w-2 h-2 bg-white rounded-full" />
          {formatTime(recordingTime)}
        </button>
      ) : (
        <button onClick={startRecording} disabled={disabled}
          className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-xl transition-all disabled:opacity-30"
          title="Grabar audio (mantener presionado)">
          <Mic size={20} />
        </button>
      )}
    </div>
  )
}
