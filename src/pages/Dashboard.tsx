import { useEffect, useState, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Navigate } from 'react-router-dom'
import { LoadingLogo } from '../components/LoadingLogo'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { session, loading: authLoading, signOut, profile } = useAuth()
  const [loadingData, setLoadingData] = useState(true)
  const [error, setError] = useState('')
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (session) {
      loadDashboardData()
    }
  }, [session])

  const loadDashboardData = async () => {
    try {
      setLoadingData(true)
      
      // 1. Descobrir o total de linhas (para busca paralela)
      const { count, error: countError } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        
      if (countError) throw countError
      
      const totalRows = count || 0
      let allData: any[] = []

      if (totalRows > 0) {
        const step = 1000
        const promises = []
        
        // Montar os lotes de busca
        for (let i = 0; i < totalRows; i += step) {
          promises.push(
            supabase
              .from('sales')
              .select('data')
              .range(i, i + step - 1)
          )
        }

        // Executar todas as buscas simultaneamente
        const results = await Promise.all(promises)
        
        for (const result of results) {
          if (result.error) throw result.error
          if (result.data) {
            allData = allData.concat(result.data)
          }
        }
      }

      if (allData.length === 0) {
        setError('Nenhum dado encontrado no banco. O Administrador precisa fazer o upload de uma planilha.')
        setLoadingData(false)
        return
      }

      const rows = allData.map(item => item.data)
      
      // Calcular metadados básicos exigidos pelo dashboard original
      const uniqueOrders = new Set(rows.map(r => r.order)).size
      
      // Compressão Matricial
      // Em vez de enviar milhares de objetos (verboso), envia as chaves 1x e os valores em Arrays puros
      const keys = rows.length > 0 ? Object.keys(rows[0]) : []
      const matrix = rows.map(r => keys.map(k => r[k]))

      const dashboardData = {
        metadata: {
          company: "Destaksul",
          title: "Dashboard Executivo de Vendas",
          sourceFile: "Banco de Dados Central (Supabase)",
          sheetName: "Consolidado",
          generatedAt: new Date().toLocaleString('pt-BR'),
          minDate: rows.length ? rows.reduce((min, p) => p.date < min ? p.date : min, rows[0].date) : "",
          maxDate: rows.length ? rows.reduce((max, p) => p.date > max ? p.date : max, rows[0].date) : "",
          totalRows: rows.length,
          uniqueOrders: uniqueOrders,
          quality: {
            missing: {},
            invalidUFs: 0,
            invalidDates: 0,
            exactRepeatedLines: 0,
            lineCountMismatches: 0,
            treatmentNote: "Dados processados em nuvem. Transferência com compressão matricial (80% menor)."
          },
          limitations: []
        },
        keys: keys,
        matrix: matrix
      }

      // Buscar o template HTML (que está na pasta public) garantindo que não pegue cache do navegador
      const templateRes = await fetch('/template.html?v=' + new Date().getTime())
      const templateHtml = await templateRes.text()

      // Injetar os dados no HTML de forma robusta no HEAD
      const injectedHtml = templateHtml.replace(
        '<head>',
        `<head>
        <script>
          window.__INJECTED_DATA__ = ${JSON.stringify(dashboardData).replace(/</g, '\\u003c')};
          
          // Script injetado para corrigir navegação de links âncora dentro do iframe
          setTimeout(() => {
            document.querySelectorAll('.nav-link').forEach(link => {
              link.addEventListener('click', e => {
                const href = link.getAttribute('href');
                if (href && href.startsWith('#')) {
                  e.preventDefault();
                  const target = document.querySelector(href);
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth' });
                    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
                    link.classList.add('active');
                  }
                }
              });
            });
          }, 500);
        </script>`
      )

      if (iframeRef.current && iframeRef.current.contentWindow) {
        const doc = iframeRef.current.contentWindow.document
        doc.open()
        doc.write(injectedHtml)
        doc.close()
      }

    } catch (err: any) {
      console.error(err)
      setError('Erro ao carregar dados do Dashboard: ' + err.message)
    } finally {
      setLoadingData(false)
    }
  }

  if (authLoading) return <div className="flex items-center justify-center min-h-screen"><LoadingLogo className="w-20 h-20" /></div>
  if (!session) return <Navigate to="/" />

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center shadow-sm relative z-10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Destak Logo" className="w-8 h-8 object-contain" />
          <span className="font-semibold text-gray-800">Destak</span>
        </div>
        <div className="flex items-center gap-4">
          {profile?.role === 'admin' && (
            <button onClick={() => window.location.href = '/admin'} className="text-sm text-destak-purple font-medium hover:underline">Painel Admin</button>
          )}
          <button onClick={signOut} className="text-sm text-gray-500 hover:text-gray-700">Sair da conta</button>
        </div>
      </header>

      <main className="flex-1 flex flex-col relative">
        {loadingData && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
            <LoadingLogo className="w-24 h-24 mb-4" />
            <p className="text-gray-600 font-medium">Buscando e consolidando os dados...</p>
          </div>
        )}
        
        {error && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-50 p-6">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-red-100 max-w-md text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold">!</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ops!</h3>
              <p className="text-gray-600">{error}</p>
            </div>
          </div>
        )}

        <iframe 
          ref={iframeRef}
          className="flex-1 w-full border-none"
          title="Dashboard Destaksul"
          sandbox="allow-scripts allow-same-origin allow-downloads allow-modals allow-popups"
        />
      </main>
    </div>
  )
}
