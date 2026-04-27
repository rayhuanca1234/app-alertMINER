import React, { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleRegister = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, phone }
        }
      })
      if (error) throw error

      // Create profile
      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          name,
          phone
        })
      }

      alert('¡Registro exitoso! Revisa tu correo para confirmar tu cuenta.')
      navigate('/login')
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
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Crear Cuenta</h1>
          <p className="text-slate-400 mt-2 text-sm">Únete a la comunidad MinerAlert</p>
        </div>

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
