import React, { useState, useRef, useEffect } from 'react'
import { X, Camera, Video, SwitchCamera, Circle, Square, Clock } from 'lucide-react'

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  
  const [facingMode, setFacingMode] = useState('environment')
  const [mode, setMode] = useState('photo') // 'photo' | 'video'
  const [recording, setRecording] = useState(false)
  const [recordTime, setRecordTime] = useState(0)
  const [ready, setReady] = useState(false)

  // Start camera
  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [facingMode])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  const startCamera = async () => {
    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: mode === 'video'
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setReady(true)
      }
    } catch (err) {
      console.error('Camera error:', err)
      alert('No se pudo acceder a la cámara. Asegúrate de dar permisos.')
      onClose()
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    setReady(false)
  }

  const switchCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
  }

  // Take photo
  const takePhoto = () => {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' })
        stopCamera()
        onCapture([file])
      }
    }, 'image/jpeg', 0.92)
  }

  // Start video recording
  const startRecording = async () => {
    const stream = streamRef.current
    if (!stream) return
    
    // Need audio for video
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const combinedStream = new MediaStream([
        ...stream.getVideoTracks(),
        ...audioStream.getAudioTracks()
      ])
      
      const mr = new MediaRecorder(combinedStream, {
        mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : 'video/webm'
      })
      mediaRecorderRef.current = mr
      chunksRef.current = []
      
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' })
        audioStream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)
        setRecordTime(0)
        setRecording(false)
        stopCamera()
        onCapture([file])
      }
      
      mr.start()
      setRecording(true)
      timerRef.current = setInterval(() => setRecordTime(t => t + 1), 1000)
    } catch (err) {
      alert('No se pudo acceder al micrófono para grabar video.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between p-3 bg-gradient-to-b from-black/80 to-transparent z-10 absolute top-0 left-0 right-0">
        <button onClick={() => { stopCamera(); onClose() }}
          className="p-2 text-white hover:bg-white/20 rounded-full transition">
          <X size={24} />
        </button>
        {recording && (
          <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full" />
            <span className="text-white text-sm font-bold">{fmt(recordTime)}</span>
          </div>
        )}
        <button onClick={switchCamera}
          className="p-2 text-white hover:bg-white/20 rounded-full transition">
          <SwitchCamera size={22} />
        </button>
      </div>

      {/* Camera preview */}
      <div className="flex-1 flex items-center justify-center overflow-hidden">
        <video ref={videoRef} autoPlay playsInline muted
          className="w-full h-full object-cover"
          style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
      </div>

      {/* Bottom controls */}
      <div className="bg-gradient-to-t from-black/90 to-transparent p-6 flex flex-col items-center gap-4 absolute bottom-0 left-0 right-0">
        {/* Mode switcher */}
        <div className="flex gap-6 text-sm font-medium">
          <button onClick={() => setMode('video')}
            className={`px-4 py-1.5 rounded-full transition ${mode === 'video' ? 'bg-white text-black' : 'text-white/60'}`}>
            Video
          </button>
          <button onClick={() => setMode('photo')}
            className={`px-4 py-1.5 rounded-full transition ${mode === 'photo' ? 'bg-white text-black' : 'text-white/60'}`}>
            Foto
          </button>
        </div>

        {/* Shutter button */}
        <div className="flex items-center justify-center">
          {mode === 'photo' ? (
            <button onClick={takePhoto} disabled={!ready}
              className="w-18 h-18 rounded-full border-4 border-white flex items-center justify-center transition active:scale-90 disabled:opacity-40"
              style={{ width: 72, height: 72 }}>
              <div className="w-14 h-14 bg-white rounded-full" style={{ width: 56, height: 56 }} />
            </button>
          ) : recording ? (
            <button onClick={stopRecording}
              className="w-18 h-18 rounded-full border-4 border-red-500 flex items-center justify-center transition active:scale-90"
              style={{ width: 72, height: 72 }}>
              <div className="w-7 h-7 bg-red-500 rounded-md" />
            </button>
          ) : (
            <button onClick={startRecording} disabled={!ready}
              className="w-18 h-18 rounded-full border-4 border-red-500 flex items-center justify-center transition active:scale-90 disabled:opacity-40"
              style={{ width: 72, height: 72 }}>
              <div className="w-14 h-14 bg-red-500 rounded-full" style={{ width: 56, height: 56 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
