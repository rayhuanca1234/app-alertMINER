import React, { useState } from 'react'
import {
  Shield, AlertTriangle, Map, MessageCircle, Zap,
  MapPin, Bell, Mic, Image, Video, Navigation,
  ChevronDown, ChevronUp, Radio, Layers, Smartphone,
  Clock, Users, Star, ArrowRight
} from 'lucide-react'

/* ───────────────────────────────────────── */
/*  DATA                                     */
/* ───────────────────────────────────────── */
const FEATURES = [
  {
    id: 'home',
    icon: Bell,
    emoji: '🏠',
    color: '#22c55e',
    glow: 'rgba(34,197,94,0.2)',
    title: 'Panel de Alertas',
    subtitle: 'Tiempo real · Siempre activo',
    desc: 'Visualiza todas las alertas activas de la comunidad en tiempo real. Indicador de zona segura cuando no hay amenazas. Actualización automática sin recargar.',
    bullets: [
      'Alertas de otros mineros en tiempo real',
      'Zona segura 🛡️ cuando no hay peligros',
      'Expiración configurable (30 min — 24 h)',
    ],
  },
  {
    id: 'sos',
    icon: AlertTriangle,
    emoji: '🆘',
    color: '#ef4444',
    glow: 'rgba(239,68,68,0.2)',
    title: 'Botón S.O.S.',
    subtitle: '1 toque · Comunidad entera alertada',
    desc: 'El corazón de la app. Presiona el gran botón rojo y en segundos todos los mineros conectados reciben tu alerta con tu ubicación GPS exacta.',
    bullets: [
      '👮🚨 Atraco de policías',
      '🔫 Robo armado',
      '🚗 Vehículo sospechoso',
      '💥 Accidente / Emergencia',
      '🚧 Bloqueo de vía',
      '⚠️ Otra amenaza',
    ],
  },
  {
    id: 'map',
    icon: Map,
    emoji: '🗺️',
    color: '#6366f1',
    glow: 'rgba(99,102,241,0.2)',
    title: 'Mapa en Vivo',
    subtitle: 'Leaflet + GPS · Rutas animadas',
    desc: 'Mapa interactivo que muestra tu posición, las alertas activas, zonas de peligro agrupadas y rutas animadas hacia cualquier incidente.',
    bullets: [
      'Avatar tuyo con aura verde pulsante',
      'Marcadores de alerta con emoji del tipo',
      'Polígonos de densidad de riesgo',
      'Ruta animada con distancia y ETA',
      'Capas: normal, satélite, relieve, oscuro',
    ],
  },
  {
    id: 'chat',
    icon: MessageCircle,
    emoji: '💬',
    color: '#3b82f6',
    glow: 'rgba(59,130,246,0.2)',
    title: 'Chat Comunitario',
    subtitle: '3 canales · Multimedia completo',
    desc: 'Chat premium tipo WhatsApp con canales General, Alertas y Coordinación. Envía texto, fotos, videos, audio, emojis y tu ubicación GPS en tiempo real.',
    bullets: [
      '📸 Fotos con editor (crop, filtros)',
      '🎥 Videos hasta 50 MB',
      '🎙️ Mensajes de voz',
      '📍 Compartir ubicación GPS',
      '👍 Reacciones rápidas',
      '🔔 Notificaciones push del navegador',
    ],
  },
]

const TECH_STACK = [
  { label: 'Frontend', value: 'Vite + React + PWA', icon: '⚡' },
  { label: 'Mapa', value: 'Leaflet + Turf.js', icon: '🗺️' },
  { label: 'Base de datos', value: 'Supabase (Postgres)', icon: '🗄️' },
  { label: 'Tiempo real', value: 'Supabase Broadcast', icon: '📡' },
  { label: 'Backend', value: 'Fastify + Socket.IO', icon: '🔧' },
  { label: 'Deploy', value: 'Google Cloud Run', icon: '☁️' },
]

const AD_MESSAGES = [
  { emoji: '⚡', text: 'Un toque, toda la comunidad alertada' },
  { emoji: '🗺️', text: 'Ve el peligro antes de llegar' },
  { emoji: '💬', text: 'Comunícate como nunca antes' },
  { emoji: '📱', text: 'Sin instalar nada — es PWA' },
  { emoji: '⛏️', text: 'Hecha para la minería de Puerto Maldonado' },
]

/* ───────────────────────────────────────── */
/*  COMPONENT                                */
/* ───────────────────────────────────────── */
function FeatureCard({ feature }) {
  const [open, setOpen] = useState(false)
  const Icon = feature.icon

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: 'var(--bg-card)',
        border: `1px solid var(--border)`,
        boxShadow: open ? `0 0 24px ${feature.glow}` : 'none',
      }}
    >
      {/* Header row */}
      <button
        className="w-full flex items-center gap-4 p-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 text-2xl shadow-lg"
          style={{ background: feature.glow, border: `1px solid ${feature.color}40` }}
        >
          {feature.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-extrabold text-sm" style={{ color: 'var(--text-primary)' }}>
            {feature.title}
          </h3>
          <p className="text-[11px] mt-0.5" style={{ color: feature.color }}>
            {feature.subtitle}
          </p>
        </div>
        <div style={{ color: 'var(--text-muted)' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="px-4 pb-4 animate-fadeIn">
          <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {feature.desc}
          </p>
          <ul className="space-y-1.5">
            {feature.bullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: feature.color }} className="mt-0.5 shrink-0">•</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function About() {
  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24">

      {/* ── Hero ── */}
      <div
        className="relative flex flex-col items-center justify-center text-center px-6 py-10 overflow-hidden"
        style={{ background: 'linear-gradient(160deg, var(--bg-secondary) 0%, var(--bg-primary) 100%)' }}
      >
        {/* Background glow blobs */}
        <div className="absolute top-0 left-1/4 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #ef4444, transparent)' }} />
        <div className="absolute bottom-0 right-1/4 w-40 h-40 rounded-full opacity-15 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />

        {/* Logo */}
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-2xl"
            style={{ background: 'linear-gradient(135deg, var(--gradient-start), var(--gradient-end))' }}>
            <Shield size={40} className="text-white" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-[var(--bg-primary)] shadow">
            <Zap size={12} className="text-white" />
          </div>
        </div>

        <h1 className="text-3xl font-black mb-1"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
          MinerAlert
        </h1>
        <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: 'var(--accent)' }}>
          v2.0 · Puerto Maldonado, Perú
        </p>
        <p className="text-sm max-w-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          App de <strong style={{ color: 'var(--text-primary)' }}>seguridad comunitaria en tiempo real</strong> diseñada
          para proteger a la comunidad minera.
        </p>

        {/* Tagline pill */}
        <div className="mt-4 px-4 py-2 rounded-full text-xs font-bold"
          style={{
            background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#ef4444',
          }}>
          🚨 Alerta · GPS · Chat · Mapa en Vivo
        </div>
      </div>

      {/* ── Ad Messages ── */}
      <div className="px-4 py-5">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
          ¿Por qué MinerAlert?
        </p>
        <div className="space-y-2">
          {AD_MESSAGES.map((m, i) => (
            <div key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <span className="text-xl shrink-0">{m.emoji}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.text}</span>
              <ArrowRight size={14} className="ml-auto shrink-0" style={{ color: 'var(--text-muted)' }} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Features (expandible) ── */}
      <div className="px-4 pb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
          Funcionalidades
        </p>
        <div className="space-y-2">
          {FEATURES.map(f => <FeatureCard key={f.id} feature={f} />)}
        </div>
      </div>

      {/* ── Flujo de uso ── */}
      <div className="px-4 pb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
          ¿Cómo funciona?
        </p>
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          {[
            { step: '1', icon: '👷', text: 'El minero detecta una amenaza' },
            { step: '2', icon: '🆘', text: 'Abre MinerAlert → toca S.O.S' },
            { step: '3', icon: '📡', text: 'GPS + alerta se envía a TODA la comunidad' },
            { step: '4', icon: '🔔', text: 'Todos reciben notificación push' },
            { step: '5', icon: '🗺️', text: 'Visualizan en el Mapa en Vivo' },
            { step: '6', icon: '💬', text: 'Coordinan respuesta en el Chat' },
          ].map((s, i, arr) => (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center shrink-0">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ background: 'var(--accent-glow)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>
                  {s.step}
                </div>
                {i < arr.length - 1 && (
                  <div className="w-px h-4 mt-1" style={{ background: 'var(--border)' }} />
                )}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <span className="text-base">{s.icon}</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{s.text}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tech Stack ── */}
      <div className="px-4 pb-5">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
          Tecnología
        </p>
        <div className="grid grid-cols-2 gap-2">
          {TECH_STACK.map((t, i) => (
            <div key={i} className="flex flex-col p-3 rounded-xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <span className="text-lg mb-1">{t.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                {t.label}
              </span>
              <span className="text-xs font-semibold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                {t.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="px-4 pb-4 text-center">
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, var(--gradient-start)22, var(--gradient-end)22)', border: '1px solid var(--border)' }}>
          <Shield size={28} className="mx-auto mb-2" style={{ color: 'var(--accent)' }} />
          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>MinerAlert v2.0</p>
          <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
            Hecho con ❤️ para la comunidad minera de Puerto Maldonado, Perú
          </p>
          <p className="text-[9px] mt-2 italic" style={{ color: 'var(--text-muted)' }}>
            "En la minería, los segundos cuentan. MinerAlert conecta a toda tu<br />comunidad en tiempo real para que nadie enfrente el peligro solo."
          </p>
        </div>
      </div>

    </div>
  )
}
