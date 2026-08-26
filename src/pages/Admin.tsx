import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { UploadCloud, Loader2, CheckCircle2, AlertCircle, Users, UserPlus, Trash2 } from 'lucide-react'
import { processExcelFile } from '../lib/excelProcessor'
import { supabase } from '../lib/supabase'
import { supabaseAdminApi } from '../lib/supabaseAdmin'
import { LoadingLogo } from '../components/LoadingLogo'

type UserData = {
  id: string
  email: string
  role: string
  created_at: string
  last_sign_in_at?: string
}

type UploadRecord = {
  id: string
  filename: string
  row_count: number
  created_at: string
}

export default function Admin() {
  const { profile, loading: authLoading, signOut } = useAuth()
  
  // States - Upload
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)
  
  // States - Usuários
  const [users, setUsers] = useState<UserData[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPass, setNewUserPass] = useState('')
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user')
  const [creatingUser, setCreatingUser] = useState(false)
  const [userMsg, setUserMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // States - Uploads Histórico
  const [uploadsList, setUploadsList] = useState<UploadRecord[]>([])
  const [loadingUploads, setLoadingUploads] = useState(false)

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchUsers()
      fetchUploads()
    }
  }, [profile])

  const fetchUploads = async () => {
    setLoadingUploads(true)
    try {
      const { data, error } = await supabase
        .from('uploads')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      if (data) setUploadsList(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingUploads(false)
    }
  }

  const fetchUsers = async () => {
    setLoadingUsers(true)
    try {
      // Busca a lista de contas via API REST Admin
      const data = await supabaseAdminApi.listUsers()

      // Busca as roles usando Admin API para ignorar restrições de segurança de linha (RLS)
      const profiles = await supabaseAdminApi.listProfiles()

      const merged: UserData[] = data.users.map((u: any) => {
        const p = profiles.find((pr: any) => pr.id === u.id)
        return {
          id: u.id,
          email: u.email || '',
          role: p?.role || 'user',
          created_at: new Date(u.created_at).toLocaleDateString('pt-BR'),
          last_sign_in_at: u.last_sign_in_at
        }
      })
      setUsers(merged)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingUser(true)
    setUserMsg(null)

    try {
      // 1. Criar o usuário via API REST Admin
      const newUser = await supabaseAdminApi.createUser(newUserEmail, newUserPass)

      // Aguarda 1 segundo para o trigger automático do banco criar o perfil vazio
      await new Promise(r => setTimeout(r, 1000))

      // 2. Atualizar o nível de acesso (Role) forçadamente via API REST Admin
      if (newUser && newUser.id) {
        await supabaseAdminApi.updateUserRole(newUser.id, newUserRole)
      }

      setUserMsg({ type: 'success', text: 'Usuário criado com sucesso!' })
      setNewUserEmail('')
      setNewUserPass('')
      fetchUsers() // Recarregar a lista
    } catch (err: any) {
      setUserMsg({ type: 'error', text: 'Erro ao criar: ' + err.message })
    } finally {
      setCreatingUser(false)
    }
  }

  const handleDeleteUser = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário definitivamente?')) return
    
    try {
      await supabaseAdminApi.deleteUser(id)
      fetchUsers()
    } catch (err) {
      alert('Erro ao excluir usuário.')
    }
  }

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
      setMessage({ type: 'error', text: 'Por favor, envie apenas arquivos do Excel (.xlsx, .xls) ou .csv' })
      return
    }

    setUploading(true)
    setMessage({ type: 'info', text: 'Processando planilha localmente...' })

    try {
      const rows = await processExcelFile(file)
      
      setMessage({ type: 'info', text: 'Registrando arquivo no histórico...' })
      
      // 1. Criar registro do Upload
      const { data: uploadData, error: uploadError } = await supabase
        .from('uploads')
        .insert({
          filename: file.name,
          row_count: rows.length,
          uploaded_by: profile?.id
        })
        .select('id')
        .single()

      if (uploadError) throw uploadError
      const uploadId = uploadData.id

      setMessage({ type: 'info', text: `Enviando ${rows.length} linhas para o banco de dados...` })

      const batchSize = 1000
      let insertedCount = 0
      const itemCounter: Record<string, number> = {}

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize)
        
        const dbPayload = batch.map(row => {
          const key = `${row.order}_${row.sku}`
          itemCounter[key] = (itemCounter[key] || 0) + 1
          
          return {
            order_id: String(row.order),
            sku: String(row.sku),
            line_index: itemCounter[key],
            data: row,
            upload_id: uploadId // Vincula a linha a este upload
          }
        })

        const { error } = await supabase
          .from('sales')
          .upsert(dbPayload, { onConflict: 'order_id,sku,line_index' })

        if (error) throw error
        insertedCount += batch.length
      }

      setMessage({ type: 'success', text: `Sucesso! ${insertedCount} registros foram importados e salvos com segurança.` })
      fetchUploads() // Atualiza a lista na tela
    } catch (error: any) {
      console.error(error)
      setMessage({ type: 'error', text: `Erro ao processar: ${error.message}` })
    } finally {
      setUploading(false)
    }
  }

  const handleDeleteUpload = async (id: string, filename: string) => {
    if (!window.confirm(`ATENÇÃO: Deseja mesmo excluir o arquivo "${filename}"?\n\nISSO APAGARÁ TODAS AS VENDAS RELACIONADAS A ELE no Dashboard.`)) return
    
    try {
      const { error } = await supabase.from('uploads').delete().eq('id', id)
      if (error) throw error
      
      alert(`Arquivo ${filename} e suas vendas foram excluídos com sucesso.`)
      fetchUploads()
    } catch (err: any) {
      alert(`Erro ao excluir arquivo: ${err.message}`)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><LoadingLogo className="w-20 h-20" /></div>
  if (profile?.role !== 'admin') return <Navigate to="/dashboard" />

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-gray-50">
      <div className="flex justify-between items-center mb-8">
        <div>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Destak Logo" className="w-8 h-8 object-contain" />
            <span className="font-semibold text-gray-800">Painel do Administrador - Destak</span>
          </div>
          <p className="text-gray-500 mt-1">Gerencie os dados e os acessos da plataforma Destaksul</p>
        </div>
        <div className="space-x-4">
          <button onClick={() => window.location.href = '/dashboard'} className="text-sm font-medium text-destak-purple hover:underline bg-destak-purple/10 px-4 py-2.5 rounded-lg transition-colors">Ir para o Dashboard</button>
          <button onClick={signOut} className="text-sm font-medium text-red-600 hover:bg-red-50 px-4 py-2.5 rounded-lg transition-colors border border-red-100">Sair da Conta</button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Lado Esquerdo: Upload */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-semibold mb-2 text-gray-800 flex items-center gap-2"><UploadCloud className="text-destak-orange" /> Alimentar Base de Dados</h2>
          <p className="text-sm text-gray-500 mb-6">Arraste a planilha de vendas da Destaksul para alimentar a base. Registros já existentes serão atualizados automaticamente (Upsert).</p>
          
          <label 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              isDragging ? 'border-destak-orange bg-orange-50 scale-[1.02]' : 'border-gray-300 hover:bg-gray-50 hover:border-destak-purple'
            } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input type="file" className="hidden" accept=".xlsx, .xls, .csv" onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleFileUpload(file)
            }} />
            
            <div className={`w-16 h-16 shadow-sm rounded-full flex items-center justify-center mb-4 transition-colors ${isDragging ? 'bg-destak-orange text-white' : 'bg-white text-destak-purple'}`}>
              <UploadCloud size={32} />
            </div>
            
            <h3 className="text-gray-900 font-medium mb-1 text-lg">Clique para enviar ou arraste a planilha aqui</h3>
            <p className="text-gray-500 text-sm">Arquivos suportados: .xlsx</p>
          </label>

          {message && (
            <div className={`mt-6 p-4 rounded-xl flex items-start gap-3 ${
              message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
              message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
              'bg-blue-50 text-blue-700 border border-blue-200'
            }`}>
              {message.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />}
              {message.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />}
              {message.type === 'info' && <Loader2 className="w-5 h-5 animate-spin flex-shrink-0 mt-0.5" />}
              <p className="text-sm font-medium">{message.text}</p>
            </div>
          )}

          {/* Lista de Uploads */}
          <div className="mt-8 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Histórico de Envios</h3>
            {loadingUploads ? (
              <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto text-gray-400"/></div>
            ) : uploadsList.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4 bg-gray-50 rounded-lg">Nenhuma planilha registrada no histórico ainda.</p>
            ) : (
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {uploadsList.map(up => (
                  <div key={up.id} className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-gray-800 truncate" title={up.filename}>{up.filename}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {up.row_count} linhas • {new Date(up.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteUpload(up.id, up.filename)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors ml-3 flex-shrink-0"
                      title="Excluir arquivo e todas as suas vendas"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Lado Direito: Usuários */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 h-fit">
          <h2 className="text-xl font-semibold mb-2 text-gray-800 flex items-center gap-2"><Users className="text-destak-purple" /> Gerenciamento de Usuários</h2>
          <p className="text-sm text-gray-500 mb-8">Crie novas contas para seus funcionários e defina quem pode alterar dados ou apenas visualizar.</p>
          
          <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2"><UserPlus size={18}/> Novo Usuário</h3>
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
                  <input type="email" required value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:border-destak-purple focus:ring-destak-purple px-3 py-2 border" placeholder="joao@destaksul.com"/>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Senha Provisória</label>
                  <input type="password" required value={newUserPass} onChange={e => setNewUserPass(e.target.value)} className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:border-destak-purple focus:ring-destak-purple px-3 py-2 border" placeholder="Mínimo 6 caracteres"/>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nível de Acesso</label>
                  <select value={newUserRole} onChange={e => setNewUserRole(e.target.value as any)} className="w-full text-sm border-gray-300 rounded-lg shadow-sm focus:border-destak-purple focus:ring-destak-purple px-3 py-2 border bg-white">
                    <option value="user">Usuário Base (Apenas Visualiza)</option>
                    <option value="admin">Administrador (Altera Dados)</option>
                  </select>
                </div>
                <button type="submit" disabled={creatingUser} className="mt-5 bg-destak-purple text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-opacity-90 disabled:opacity-50 flex items-center gap-2">
                  {creatingUser ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Criar Conta'}
                </button>
              </div>
            </form>
            {userMsg && (
              <p className={`mt-3 text-xs font-medium ${userMsg.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{userMsg.text}</p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Usuários Ativos</h3>
            {loadingUsers ? (
              <div className="text-center py-4"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400"/></div>
            ) : (
              <div className="overflow-hidden border border-gray-100 rounded-xl">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">E-mail</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nível</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Último Acesso</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((user) => {
                      let statusText = 'Offline';
                      let statusColor = 'bg-gray-400';
                      let formattedDate = 'Nunca acessou';
                      
                      if (user.last_sign_in_at) {
                        const lastAccess = new Date(user.last_sign_in_at);
                        formattedDate = lastAccess.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
                        const diffMins = (new Date().getTime() - lastAccess.getTime()) / (1000 * 60);
                        
                        if (diffMins < 60) {
                          statusText = 'Online';
                          statusColor = 'bg-green-500';
                        } else if (diffMins < 60 * 24) {
                          statusText = 'Ausente';
                          statusColor = 'bg-orange-500';
                        }
                      }

                      return (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-[150px]">{user.email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}>
                            {user.role === 'admin' ? 'Master' : 'Base'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formattedDate}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${statusColor}`}></span>
                            <span className="text-xs font-medium text-gray-600">{statusText}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium">
                          <button onClick={() => handleDeleteUser(user.id)} className="text-red-500 hover:text-red-700 p-1 bg-red-50 rounded" title="Excluir usuário">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
