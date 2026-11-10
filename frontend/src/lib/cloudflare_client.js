/**
 * cloudflare_client.js
 * Cliente unificado de Datos, Storage R2 y Realtime Socket.IO para el Frontend.
 * Reemplaza al 100% cualquier uso anterior de @supabase/supabase-js.
 */
import { fetchWithAuth, getBackendUrl } from './auth_client';
import { socket } from './socket';

/**
 * Convierte un File o Blob a base64
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Sube un archivo directamente a Cloudflare R2 (o LocalStorage fallback) vía /api/storage/upload
 */
export async function uploadFileToR2(file, customFilename = null) {
  const data_base64 = await fileToBase64(file);
  const filename = customFilename || file.name || `media_${Date.now()}.bin`;
  const content_type = file.type || 'application/octet-stream';

  const res = await fetchWithAuth('/api/storage/upload', {
    method: 'POST',
    body: JSON.stringify({
      filename,
      content_type,
      data_base64
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error subiendo archivo a Cloudflare R2');
  }

  // Si devuelve ruta relativa (/uploads/...), prefijar con el backend URL si es distinto del origin
  let publicUrl = data.publicUrl || data.url;
  if (publicUrl && publicUrl.startsWith('/')) {
    publicUrl = `${getBackendUrl()}${publicUrl}`;
  }

  return {
    publicUrl,
    object_path: data.object_path,
    storage_backend: data.storage_backend,
    size: data.size
  };
}

/**
 * Elimina un archivo de Cloudflare R2
 */
export async function deleteFileFromR2(objectPath) {
  const res = await fetchWithAuth('/api/storage/object', {
    method: 'DELETE',
    body: JSON.stringify({ object_path: objectPath })
  });
  return res.ok;
}

/**
 * Canal de Tiempo Real sobre Socket.IO compatible con la interfaz de Broadcast de la app
 */
class RealtimeChannel {
  constructor(name) {
    this.name = name;
    this.handlers = new Map();
    this._socketListener = null;
  }

  on(type, filter, callback) {
    const eventName = filter?.event || '*';
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName).push(callback);
    return this;
  }

  subscribe(statusCallback) {
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('join_channel', this.name);

    this._socketListener = (msg) => {
      if (msg && msg.channel === this.name) {
        const list = this.handlers.get(msg.event) || [];
        list.forEach(cb => {
          try {
            cb({ event: msg.event, payload: msg.payload });
          } catch (e) {
            console.error('[RealtimeChannel] callback error:', e);
          }
        });
      }
    };

    socket.on('realtime_event', this._socketListener);

    if (typeof statusCallback === 'function') {
      setTimeout(() => statusCallback('SUBSCRIBED'), 10);
    }
    return this;
  }

  send({ event, payload }) {
    if (!socket.connected) {
      socket.connect();
    }
    socket.emit('realtime_broadcast', {
      channel: this.name,
      event,
      payload
    });
    return Promise.resolve('ok');
  }

  unsubscribe() {
    if (this._socketListener) {
      socket.off('realtime_event', this._socketListener);
      this._socketListener = null;
    }
    socket.emit('leave_channel', this.name);
  }
}

export function createRealtimeChannel(name) {
  return new RealtimeChannel(name);
}

export function removeRealtimeChannel(channel) {
  if (channel && typeof channel.unsubscribe === 'function') {
    channel.unsubscribe();
  }
}
