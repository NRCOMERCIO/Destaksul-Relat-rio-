import * as XLSX from 'xlsx'

export type RawRow = {
  'Código Pedido': string | number
  'Código Produto': string | number
  'Nome Produto': string
  'Quantidade': number
  'Linhas Por Pedido': number
  'Faturamento': number
  'Data Hora': string | number
  'Origem': string
  'Condição/Forma Pagamento': string
  'Cliente': string
  'Genero': string
  'UF': string
  'Situação': string
}

export const processExcelFile = async (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array', cellDates: true })
        
        // Assumindo que os dados estão na primeira aba
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        
        // Converter para JSON
        const rawData = XLSX.utils.sheet_to_json<any>(worksheet)
        
        const parseNumber = (val: any): number => {
          if (typeof val === 'number') return val;
          if (!val) return 0;
          let str = String(val).trim();
          
          // Remove símbolos como R$ e espaços
          str = str.replace(/[^0-9.,\-]/g, ''); 
          
          const lastDot = str.lastIndexOf('.');
          const lastComma = str.lastIndexOf(',');
          
          if (lastComma > lastDot) {
            // Ex: 1.500,50 ou 1500,50 -> remove os pontos e troca vírgula por ponto
            str = str.replace(/\./g, '').replace(',', '.');
          } else if (lastDot > lastComma) {
            // Ex: 1,500.50 (US) ou 1.500 (BR)
            if (lastComma !== -1) {
              // Tem vírgula e ponto (US format), remove a vírgula
              str = str.replace(/,/g, '');
            } else {
              // Só tem ponto. Pode ser decimal (15.5) ou milhar (1.500)
              const parts = str.split('.');
              if (parts.length > 2) {
                // Mais de um ponto (ex: 1.000.000), definitivamente é separador de milhar
                str = str.replace(/\./g, '');
              } else if (parts.length === 2 && parts[1].length === 3) {
                // Exatamente 3 casas depois do ponto (ex: 1.500). Altamente provável ser milhar no BR.
                str = str.replace(/\./g, '');
              }
              // Se tiver 1, 2, ou 4+ casas depois do ponto (ex: 1.5, 1.50), assumimos que o ponto é decimal
            }
          } else if (lastComma !== -1) {
            // Só tem vírgula, é o separador decimal do BR
            str = str.replace(',', '.');
          }
          const parsed = Number(str);
          return isNaN(parsed) ? 0 : parsed;
        }

        const processedData = rawData.map((rawRow, index) => {
          // Normalizar as chaves removendo espaços extras
          const row: any = {}
          for (const key in rawRow) {
            row[key.trim()] = rawRow[key]
          }

          // Normalizar datas (o Excel pode retornar Date object ou serial)
          let dateObj = new Date()
          if (row['Data Hora'] instanceof Date) {
            dateObj = row['Data Hora']
          } else if (typeof row['Data Hora'] === 'number') {
            // Excel serial date to JS Date
            dateObj = new Date(Math.round((row['Data Hora'] - 25569) * 86400 * 1000))
          } else if (typeof row['Data Hora'] === 'string') {
            const strDate = row['Data Hora'].trim()
            // Tentar parse de DD/MM/AAAA
            const parts = strDate.split(/[\/\- ]/)
            if (parts.length >= 3 && parts[0].length === 2 && parts[1].length === 2 && parts[2].length === 4) {
              // DD/MM/YYYY
              dateObj = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]))
            } else {
              dateObj = new Date(strDate)
            }
          }
          
          if (isNaN(dateObj.getTime())) {
            // Fallback se for inválida, assume hoje para não quebrar o layout (NaN-NaN-NaN)
            dateObj = new Date()
          }

          const pad = (n: number) => n.toString().padStart(2, '0')
          const dateStr = `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`
          const timeStr = `${pad(dateObj.getHours())}:${pad(dateObj.getMinutes())}:${pad(dateObj.getSeconds())}`
          const hour = dateObj.getHours()

          // Derivar regras de negócio
          const status = String(row['Situação'] || '').trim()
          let statusGroup = 'Ativo'
          if (status.toLowerCase().includes('cancelado')) statusGroup = 'Cancelado'
          if (status.toLowerCase().includes('pendente')) statusGroup = 'Pendente'

          const origin = String(row['Origem'] || '').trim()
          let channel = 'Outros'
          if (origin.toLowerCase().includes('marketplace') || origin.toLowerCase().includes('shopee') || origin.toLowerCase().includes('mercado livre')) channel = 'Marketplace'
          else if (origin.toLowerCase().includes('site') || origin.toLowerCase().includes('e-commerce')) channel = 'Site'
          else if (origin.toLowerCase().includes('manual') || origin.toLowerCase().includes('whatsapp')) channel = 'Manual'

          const payment = String(row['Condição/Forma Pagamento'] || '').trim()
          let paymentType = 'Outros'
          if (payment.toLowerCase().includes('pix')) paymentType = 'Pix'
          else if (payment.toLowerCase().includes('cartão') || payment.toLowerCase().includes('credito')) paymentType = 'Cartão de Crédito'
          else if (payment.toLowerCase().includes('boleto')) paymentType = 'Boleto'
          else if (payment.toLowerCase().includes('sem informação')) paymentType = 'Sem informação'

          const prodLower = String(row['Nome Produto'] || '').toLowerCase()
          let category = 'Diversos'
          if (prodLower.includes('máscara') || prodLower.includes('mascara')) category = 'Máscaras'
          else if (prodLower.includes('luva')) category = 'Luvas'
          else if (prodLower.includes('touca')) category = 'Toucas'
          else if (prodLower.includes('seringa') || prodLower.includes('agulha')) category = 'Seringas e Agulhas'
          else if (prodLower.includes('avental')) category = 'Aventais'

          const weekdays = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
          const weekdayStr = weekdays[dateObj.getDay()]

          let timeBand = '00h–05h59'
          if (hour >= 6 && hour < 9) timeBand = '06h–08h59'
          else if (hour >= 9 && hour < 12) timeBand = '09h–11h59'
          else if (hour >= 12 && hour < 15) timeBand = '12h–14h59'
          else if (hour >= 15 && hour < 18) timeBand = '15h–17h59'
          else if (hour >= 18 && hour < 21) timeBand = '18h–20h59'
          else if (hour >= 21) timeBand = '21h–23h59'

          return {
            row: index + 1,
            order: String(row['Código Pedido']),
            sku: String(row['Código Produto']),
            product: String(row['Nome Produto']),
            category: category,
            qty: parseNumber(row['Quantidade']),
            orderLines: parseNumber(row['Linhas Por Pedido']) || 1,
            revenue: parseNumber(row['Faturamento']),
            date: dateStr,
            datetime: `${dateStr}T${timeStr}`,
            time: timeStr,
            weekday: weekdayStr,
            hour: hour,
            timeBand: timeBand,
            origin: origin,
            channel: channel,
            payment: payment,
            paymentType: paymentType,
            client: String(row['Cliente']),
            gender: String(row['Genero']),
            uf: String(row['UF']),
            status: status,
            statusGroup: statusGroup,
            eligible: statusGroup === 'Ativo'
          }
        })

        // Filter exact duplicates (glitch in ERP export where the same row is exported multiple times)
        const uniqueData = []
        const seen = new Set()
        for (const row of processedData) {
          const key = `${row.order}_${row.sku}`
          if (!seen.has(key)) {
            seen.add(key)
            uniqueData.push(row)
          }
        }

        resolve(uniqueData)
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = (error) => reject(error)
    reader.readAsArrayBuffer(file)
  })
}
