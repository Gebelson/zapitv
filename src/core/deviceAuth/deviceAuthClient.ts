/**
 * ZAPITV — CLIENTE DE VINCULAÇÃO DE DISPOSITIVOS E SMART TV (P3.C)
 * 
 * Comunicação com as rotas /api/device-auth/* e /api/devices/*
 */

export interface DeviceChallengeData {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
  deviceName: string;
  deviceType: string;
}

export interface DevicePollResponse {
  status: 'pending' | 'slow_down' | 'approved' | 'rejected' | 'expired' | 'consumed';
  interval?: number;
  error?: string;
  expiresAt?: number;
  sessionId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ValidateCodeResponse {
  valid: boolean;
  error?: string;
  challenge?: {
    userCode: string;
    deviceName: string;
    deviceType: string;
    expiresAt: number;
    createdAt: number;
  };
}

export interface LinkedDevice {
  id: string;
  deviceName: string;
  deviceType: string;
  clientIp?: string | null;
  userAgent?: string | null;
  lastActiveAt: number;
  createdAt: number;
  isCurrentSession?: boolean;
}

export const deviceAuthClient = {
  /**
   * TV: Inicia o processo gerando um desafio de vinculação
   */
  async createChallenge(): Promise<DeviceChallengeData> {
    const res = await fetch('/api/device-auth/challenge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zapi-Client': 'tv',
      },
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Não foi possível gerar o código de vinculação.');
    }

    return await res.json();
  },

  /**
   * TV: Consulta o status do desafio em andamento
   */
  async pollChallenge(deviceCode: string, signal?: AbortSignal): Promise<DevicePollResponse> {
    const res = await fetch('/api/device-auth/poll', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zapi-Client': 'tv',
      },
      body: JSON.stringify({ deviceCode }),
      signal,
    });

    const data = await res.json().catch(() => ({}));

    // Retorna a resposta mesmo com códigos 400/403 para mapear statusRFC (slow_down, expired, rejected, consumed)
    return data;
  },

  /**
   * Celular: Valida o código curto digitado ou carregado via URL
   */
  async validateCode(code: string): Promise<ValidateCodeResponse> {
    const res = await fetch(`/api/device-auth/validate?code=${encodeURIComponent(code.trim())}`, {
      method: 'GET',
      headers: {
        'X-Zapi-Client': 'web',
      },
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { valid: false, error: data.error || 'Código inválido ou expirado.' };
    }

    return data;
  },

  /**
   * Celular: Aprova a solicitação com autorização explícita do usuário autenticado
   */
  async approveDeviceLink(userCode: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch('/api/device-auth/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zapi-Client': 'web',
      },
      body: JSON.stringify({ userCode }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error || 'Erro ao autorizar dispositivo.' };
    }

    return { success: true, message: data.message };
  },

  /**
   * Celular: Recusa a vinculação
   */
  async rejectDeviceLink(userCode: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch('/api/device-auth/reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Zapi-Client': 'web',
      },
      body: JSON.stringify({ userCode }),
    });

    const data = await res.json().catch(() => ({}));
    return { success: res.ok, message: data.message, error: data.error };
  },

  /**
   * Configurações: Lista todas as TVs conectadas à conta
   */
  async listLinkedDevices(): Promise<LinkedDevice[]> {
    const res = await fetch('/api/devices', {
      method: 'GET',
      headers: {
        'X-Zapi-Client': 'web',
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao carregar dispositivos conectados.');
    }

    const data = await res.json();
    return data.devices || [];
  },

  /**
   * Configurações: Desvincula e revoga o acesso de uma Smart TV
   */
  async revokeDevice(deviceId: string): Promise<boolean> {
    const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'X-Zapi-Client': 'web',
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erro ao desvincular dispositivo.');
    }

    return true;
  },
};
