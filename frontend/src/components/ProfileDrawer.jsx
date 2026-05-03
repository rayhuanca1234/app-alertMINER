import React from 'react';
import { 
  X, LogOut, Settings, Shield, Bell, 
  Moon, Bookmark, QrCode, HelpCircle, Star, ChevronRight
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function ProfileDrawer({ isOpen, onClose }) {
  const { signOut } = useAuthStore();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className="relative w-80 max-w-[85vw] h-full bg-[#0a0f18] border-l border-slate-800 shadow-2xl flex flex-col animate-slideInRight"
      >
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
          .animate-slideInRight {
            animation: slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
        `}} />

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white">Configuración</h2>
          <button 
            onClick={onClose}
            className="p-2 bg-slate-800/50 rounded-full text-slate-300 hover:text-white hover:bg-slate-700 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-2">
          
          {/* Section 1 */}
          <div className="px-4 py-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Cuenta</p>
            <button className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-800/50 text-slate-200 transition">
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-slate-400" />
                <span className="text-sm font-medium">Ajustes y privacidad</span>
              </div>
              <ChevronRight size={16} className="text-slate-500" />
            </button>
            <button className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-800/50 text-slate-200 transition">
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-slate-400" />
                <span className="text-sm font-medium">Seguridad</span>
              </div>
              <ChevronRight size={16} className="text-slate-500" />
            </button>
            <button className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-800/50 text-slate-200 transition">
              <div className="flex items-center gap-3">
                <Bell size={20} className="text-slate-400" />
                <span className="text-sm font-medium">Notificaciones push</span>
              </div>
              <ChevronRight size={16} className="text-slate-500" />
            </button>
          </div>

          <div className="h-px bg-slate-800/50 mx-4 my-2" />

          {/* Section 2 */}
          <div className="px-4 py-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">Contenido y actividad</p>
            <button className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-800/50 text-slate-200 transition">
              <div className="flex items-center gap-3">
                <Bookmark size={20} className="text-slate-400" />
                <span className="text-sm font-medium">Guardados</span>
              </div>
            </button>
            <button className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-800/50 text-slate-200 transition">
              <div className="flex items-center gap-3">
                <QrCode size={20} className="text-slate-400" />
                <span className="text-sm font-medium">Mi código QR</span>
              </div>
            </button>
            <button className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-800/50 text-slate-200 transition">
              <div className="flex items-center gap-3">
                <Star size={20} className="text-amber-400" />
                <span className="text-sm font-medium text-amber-100">MinerAlert PRO</span>
              </div>
            </button>
          </div>

          <div className="h-px bg-slate-800/50 mx-4 my-2" />

          {/* Section 3 */}
          <div className="px-4 py-2">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-2">General</p>
            <button className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-800/50 text-slate-200 transition">
              <div className="flex items-center gap-3">
                <Moon size={20} className="text-slate-400" />
                <span className="text-sm font-medium">Modo Oscuro</span>
              </div>
              <div className="w-8 h-4 bg-blue-500 rounded-full relative">
                <div className="w-3 h-3 bg-white rounded-full absolute right-0.5 top-0.5" />
              </div>
            </button>
            <button className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-800/50 text-slate-200 transition">
              <div className="flex items-center gap-3">
                <HelpCircle size={20} className="text-slate-400" />
                <span className="text-sm font-medium">Centro de ayuda</span>
              </div>
            </button>
          </div>
        </div>

        {/* Footer with Logout */}
        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl font-bold transition active:scale-95"
          >
            <LogOut size={20} />
            Salir de la cuenta
          </button>
        </div>
      </div>
    </div>
  );
}
