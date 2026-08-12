const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

if (!supabaseServiceKey) {
  throw new Error('A Service Role Key não está definida.')
}

const headers = {
  'apikey': supabaseServiceKey,
  'Authorization': `Bearer ${supabaseServiceKey}`,
  'Content-Type': 'application/json'
}

// Usamos o proxy local do Vite para enganar o Supabase e fazer ele achar
// que a requisição está vindo de um servidor, e não do navegador.
const proxyUrl = '/admin-api'

export const supabaseAdminApi = {
  async listUsers() {
    const res = await fetch(`${proxyUrl}/auth/v1/admin/users`, { headers })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async listProfiles() {
    const res = await fetch(`${proxyUrl}/rest/v1/profiles?select=*`, { headers })
    if (!res.ok) throw new Error(await res.text())
    return res.json()
  },

  async createUser(email: string, password?: string) {
    const res = await fetch(`${proxyUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email, password, email_confirm: true })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.message || 'Erro ao criar usuário')
    }
    return res.json()
  },

  async deleteUser(id: string) {
    const res = await fetch(`${proxyUrl}/auth/v1/admin/users/${id}`, {
      method: 'DELETE',
      headers
    })
    if (!res.ok) throw new Error(await res.text())
    return true
  },

  async updateUserRole(id: string, role: string) {
    const res = await fetch(`${proxyUrl}/rest/v1/profiles?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify({ role })
    })
    if (!res.ok) throw new Error(await res.text())
    return true
  }
}
