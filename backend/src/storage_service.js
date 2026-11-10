/**
 * storage_service.js
 * Módulo 5: Almacenamiento de Medios en Cloudflare R2 (API compatible S3 SigV4)
 * con fallback automático a LocalStorage en disco cuando faltan credenciales en desarrollo.
 *
 * Métodos requeridos:
 * - save_file(src_path_or_buffer, user_id, project_id, content_type="video/mp4", original_filename="media.mp4")
 * - delete_file(object_path)
 * - get_signed_url(object_path, expires_in=3600)
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getAppConfig } = require('./app_config');

const LOCAL_UPLOAD_DIR = path.resolve(__dirname, '../uploads');

function ensureLocalUploadDir() {
  if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
    fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
  }
}

function hmacSha256(key, data, encoding = undefined) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest(encoding);
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function getSignatureKey(key, dateStamp, regionName, serviceName) {
  const kDate = hmacSha256(`AWS4${key}`, dateStamp);
  const kRegion = hmacSha256(kDate, regionName);
  const kService = hmacSha256(kRegion, serviceName);
  const kSigning = hmacSha256(kService, 'aws4_request');
  return kSigning;
}

function encodeRfc3986(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

class R2Storage {
  constructor() {
    ensureLocalUploadDir();
  }

  isR2Configured() {
    const cfg = getAppConfig();
    return Boolean(
      cfg.CLOUDFLARE_ACCOUNT_ID &&
      cfg.R2_ACCESS_KEY_ID &&
      cfg.R2_SECRET_ACCESS_KEY &&
      cfg.R2_BUCKET_NAME &&
      !cfg.CLOUDFLARE_ACCOUNT_ID.startsWith('tu_') &&
      !cfg.R2_ACCESS_KEY_ID.startsWith('tu_') &&
      !cfg.R2_SECRET_ACCESS_KEY.startsWith('tu_')
    );
  }

  getEndpointHost() {
    const cfg = getAppConfig();
    return `${cfg.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
  }

  /**
   * Sube un archivo al bucket R2_BUCKET_NAME con la key estructurada:
   * videos/{user_id}/{YYYY}/{MM}/{project_id}_{filename}
   * Construye y retorna la URL pública usando R2_PUBLIC_DOMAIN:
   * `${R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${object_path}`
   */
  async save_file(src_path_or_buffer, user_id, project_id, content_type = 'video/mp4', original_filename = null) {
    const cfg = getAppConfig();
    const now = new Date();
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');

    let buffer;
    let filename = original_filename;
    if (Buffer.isBuffer(src_path_or_buffer)) {
      buffer = src_path_or_buffer;
      if (!filename) filename = 'file.mp4';
    } else if (typeof src_path_or_buffer === 'string') {
      buffer = fs.readFileSync(src_path_or_buffer);
      if (!filename) filename = path.basename(src_path_or_buffer);
    } else {
      throw new Error('src_path_or_buffer debe ser una ruta de archivo o un Buffer');
    }

    const safeFilename = String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeUser = String(user_id || 'anonymous').replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeProj = String(project_id || Date.now()).replace(/[^a-zA-Z0-9._-]/g, '_');

    const object_path = `videos/${safeUser}/${yyyy}/${mm}/${safeProj}_${safeFilename}`;

    if (this.isR2Configured()) {
      try {
        await this._putObjectS3V4(object_path, buffer, content_type);
        const publicDomain = (cfg.R2_PUBLIC_DOMAIN || `https://${this.getEndpointHost()}/${cfg.R2_BUCKET_NAME}`).replace(/\/$/, '');
        return {
          url: `${publicDomain}/${object_path}`,
          object_path,
          storage_backend: 'cloudflare',
          size: buffer.length
        };
      } catch (err) {
        console.warn('[R2Storage] Falló subida a R2, usando LocalStorage fallback:', err.message);
      }
    }

    // Fallback a LocalStorage en disco
    const localTarget = path.join(LOCAL_UPLOAD_DIR, object_path);
    const localDir = path.dirname(localTarget);
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.writeFileSync(localTarget, buffer);

    const publicUrl = `/uploads/${object_path}`;
    return {
      url: publicUrl,
      object_path,
      storage_backend: 'local',
      size: buffer.length
    };
  }

  /**
   * Elimina el objeto en R2 con DELETE S3v4 (y en LocalStorage si existe)
   */
  async delete_file(object_path) {
    if (!object_path) return false;
    const cleanKey = String(object_path).replace(/^\/?(uploads\/)?/, '');

    if (this.isR2Configured()) {
      try {
        await this._deleteObjectS3V4(cleanKey);
      } catch (err) {
        console.warn('[R2Storage] Error eliminando en R2:', err.message);
      }
    }

    const localTarget = path.join(LOCAL_UPLOAD_DIR, cleanKey);
    if (fs.existsSync(localTarget)) {
      try {
        fs.unlinkSync(localTarget);
      } catch {}
    }
    return true;
  }

  /**
   * Genera URL firmada temporal compatible con S3v4 (get_object)
   */
  get_signed_url(object_path, expires_in = 3600) {
    if (!object_path) return null;
    const cleanKey = String(object_path).replace(/^\/?(uploads\/)?/, '');

    if (!this.isR2Configured()) {
      const cfg = getAppConfig();
      return `${cfg.SERVER_URL}/uploads/${cleanKey}`;
    }

    const cfg = getAppConfig();
    const host = this.getEndpointHost();
    const region = 'auto';
    const service = 's3';

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const encodedKey = cleanKey.split('/').map(encodeRfc3986).join('/');
    const canonicalUri = `/${encodeRfc3986(cfg.R2_BUCKET_NAME)}/${encodedKey}`;

    const queryParams = {
      'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
      'X-Amz-Credential': `${cfg.R2_ACCESS_KEY_ID}/${credentialScope}`,
      'X-Amz-Date': amzDate,
      'X-Amz-Expires': String(expires_in),
      'X-Amz-SignedHeaders': 'host'
    };

    const canonicalQueryString = Object.keys(queryParams)
      .sort()
      .map(k => `${encodeRfc3986(k)}=${encodeRfc3986(queryParams[k])}`)
      .join('&');

    const canonicalHeaders = `host:${host}\n`;
    const signedHeaders = 'host';
    const payloadHash = 'UNSIGNED-PAYLOAD';

    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join('\n');

    const signingKey = getSignatureKey(cfg.R2_SECRET_ACCESS_KEY, dateStamp, region, service);
    const signature = hmacSha256(signingKey, stringToSign, 'hex');

    return `https://${host}${canonicalUri}?${canonicalQueryString}&X-Amz-Signature=${signature}`;
  }

  async _putObjectS3V4(object_path, buffer, content_type) {
    const cfg = getAppConfig();
    const host = this.getEndpointHost();
    const region = 'auto';
    const service = 's3';

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const encodedKey = object_path.split('/').map(encodeRfc3986).join('/');
    const canonicalUri = `/${encodeRfc3986(cfg.R2_BUCKET_NAME)}/${encodedKey}`;
    const payloadHash = sha256Hex(buffer);

    const canonicalHeaders =
      `content-type:${content_type}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      'PUT',
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join('\n');

    const signingKey = getSignatureKey(cfg.R2_SECRET_ACCESS_KEY, dateStamp, region, service);
    const signature = hmacSha256(signingKey, stringToSign, 'hex');
    const authHeader = `AWS4-HMAC-SHA256 Credential=${cfg.R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `https://${host}${canonicalUri}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': content_type,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'Authorization': authHeader
      },
      body: buffer
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`R2 PUT ${res.status}: ${errText}`);
    }
    return true;
  }

  async _deleteObjectS3V4(object_path) {
    const cfg = getAppConfig();
    const host = this.getEndpointHost();
    const region = 'auto';
    const service = 's3';

    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const encodedKey = object_path.split('/').map(encodeRfc3986).join('/');
    const canonicalUri = `/${encodeRfc3986(cfg.R2_BUCKET_NAME)}/${encodedKey}`;
    const payloadHash = sha256Hex('');

    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      'DELETE',
      canonicalUri,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash
    ].join('\n');

    const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join('\n');

    const signingKey = getSignatureKey(cfg.R2_SECRET_ACCESS_KEY, dateStamp, region, service);
    const signature = hmacSha256(signingKey, stringToSign, 'hex');
    const authHeader = `AWS4-HMAC-SHA256 Credential=${cfg.R2_ACCESS_KEY_ID}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `https://${host}${canonicalUri}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': amzDate,
        'Authorization': authHeader
      }
    });

    if (!res.ok && res.status !== 204) {
      const errText = await res.text();
      throw new Error(`R2 DELETE ${res.status}: ${errText}`);
    }
    return true;
  }
}

const storageService = new R2Storage();

module.exports = {
  R2Storage,
  storageService,
  LOCAL_UPLOAD_DIR
};
