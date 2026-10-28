/**
 * ZAPITV — CLIENTE DE PERFIS (P3.B)
 * 
 * Comunicação com a API (/api/profiles) via fetch com credentials: 'include'.
 */

export interface ProfileItem {
  id: string;
  userId: string;
  name: string;
  avatarId: string;
  isDefault: number;
  displayOrder: number;
  createdAt: number;
  updatedAt: number;
}

class ProfileClient {
  async list(): Promise<ProfileItem[]> {
    try {
      const res = await fetch('/api/profiles', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Zapi-Client': 'web',
        },
        credentials: 'include',
      });

      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data.profiles) ? data.profiles : [];
    } catch {
      return [];
    }
  }

  async getActive(): Promise<ProfileItem | null> {
    try {
      const res = await fetch('/api/profiles/active', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'X-Zapi-Client': 'web',
        },
        credentials: 'include',
      });

      if (!res.ok) return null;
      const data = await res.json();
      return data.profile || null;
    } catch {
      return null;
    }
  }

  async create(name: string, avatarId: string): Promise<ProfileItem> {
    const res = await fetch('/api/profiles', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Zapi-Client': 'web',
      },
      credentials: 'include',
      body: JSON.stringify({ name, avatarId }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Não foi possível criar o perfil.');
    }

    return data.profile;
  }

  async update(id: string, updates: { name?: string; avatarId?: string }): Promise<ProfileItem> {
    const res = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Zapi-Client': 'web',
      },
      credentials: 'include',
      body: JSON.stringify(updates),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Não foi possível atualizar o perfil.');
    }

    return data.profile;
  }

  async delete(id: string): Promise<{ success: boolean; nextActiveProfileId: string }> {
    const res = await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'X-Zapi-Client': 'web',
      },
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Não foi possível excluir o perfil.');
    }

    return data;
  }

  async select(id: string): Promise<ProfileItem> {
    const res = await fetch(`/api/profiles/${encodeURIComponent(id)}/select`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'X-Zapi-Client': 'web',
      },
      credentials: 'include',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Não foi possível selecionar o perfil.');
    }

    return data.profile;
  }
}

export const profileClient = new ProfileClient();
