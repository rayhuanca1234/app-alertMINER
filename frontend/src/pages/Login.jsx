import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Registro exitoso. Revisa tu correo.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      }
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    })
    if (error) alert(error.message)
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 relative overflow-hidden font-sans">
      
      {/* Background animated gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-600/30 rounded-full blur-[120px] animate-[pulse_6s_ease-in-out_infinite]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-emerald-600/20 rounded-full blur-[150px] animate-[pulse_8s_ease-in-out_infinite_reverse]" />
      
      <div className="relative z-10 w-full max-w-md p-8 m-4 rounded-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 shadow-[0_8px_32px_0_rgba(0,0,0,0.36)] transition-all duration-500 hover:shadow-[0_8px_40px_0_rgba(59,130,246,0.15)]">
        
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-emerald-400 mb-6 shadow-lg shadow-blue-500/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-tight">MinerAlert</h1>
          <p className="text-slate-400 mt-2 font-medium">Seguridad y Alerta Comunitaria</p>
        </div>

        <button 
          onClick={handleGoogleLogin}
          type="button"
          className="w-full mb-6 flex items-center justify-center gap-3 bg-white text-slate-900 py-3.5 px-4 rounded-xl font-bold hover:bg-slate-100 transition-transform active:scale-95 duration-200"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continuar con Google
        </button>

        <div className="flex items-center my-6">
          <div className="flex-1 border-t border-slate-700"></div>
          <span className="px-4 text-sm text-slate-500 font-medium">o usa tu email</span>
          <div className="flex-1 border-t border-slate-700"></div>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-5">
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-300 ml-1">Email</label>
            <input 
              type="email" 
              className="w-full px-4 py-3.5 rounded-xl bg-slate-950/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-semibold text-slate-300 ml-1">Contraseña</label>
            <input 
              type="password" 
              className="w-full px-4 py-3.5 rounded-xl bg-slate-950/50 border border-slate-700/50 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Procesando...
              </span>
            ) : isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </button>
        </form>

        <p className="text-center mt-8 text-sm text-slate-400">
          {isRegistering ? '¿Ya tienes una cuenta? ' : '¿No tienes cuenta? '}
          <button 
            type="button" 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-blue-400 font-bold hover:text-blue-300 transition-colors"
          >
            {isRegistering ? 'Inicia Sesión' : 'Regístrate aquí'}
          </button>
        </p>

      </div>
    </div>
  )
}
