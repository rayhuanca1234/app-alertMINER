import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { signInWithGoogle } from '../lib/auth_client'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const { registerWithEmail } = useAuthStore()
  const navigate = useNavigate()

  const handleRegister = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    try {
      await registerWithEmail({ name, email, password, phone })
      navigate('/')
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-[pulse_6s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[150px] animate-[pulse_8s_ease-in-out_infinite_reverse]" />

      <div className="relative z-10 w-full max-w-md p-8 m-4 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)]">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Crear Cuenta</h1>
          <p className="text-slate-400 mt-2 text-sm">Únete a la comunidad MinerAlert (Cloudflare D1)</p>
        </div>

        <button
          onClick={() => signInWithGoogle()}
          type="button"
          className="w-full mb-5 flex items-center justify-center gap-3 bg-white text-slate-900 py-3 px-4 rounded-xl font-bold hover:bg-slate-100 transition-transform active:scale-95 duration-200"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continuar con Google
        </button>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-300 ml-1">Nombre completo</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Juan Pérez" required
              className="w-full px-4 py-3 rounded-xl bg-slate-950/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-300 ml-1">Teléfono</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="+51 999 999 999"
              className="w-full px-4 py-3 rounded-xl bg-slate-950/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-300 ml-1">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com" required
              className="w-full px-4 py-3 rounded-xl bg-slate-950/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-300 ml-1">Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres" required
              className="w-full px-4 py-3 rounded-xl bg-slate-950/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full bg-gradient-to-r from-emerald-600 to-emerald-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200 mt-2">
            {loading ? 'Creando cuenta...' : 'Registrarse'}
          </button>
        </form>

        <p className="text-center mt-6 text-sm text-slate-400">
          ¿Ya tienes cuenta?{' '}
          <button onClick={() => navigate('/login')} className="text-blue-400 font-bold hover:text-blue-300 transition-colors">
            Inicia Sesión
          </button>
        </p>
      </div>
    </div>
  )
}
