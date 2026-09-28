import { ipcMain, app, BrowserWindow } from 'electron'
import path from 'path'
import fs from 'fs'
import PDFDocument from 'pdfkit'
import { db } from '../database'

function getTicketsDir(): string {
  return path.join(app.getPath('documents'), 'hi-POS_Tickets')
}

// DIAGNÓSTICO TEMPORAL: cambia a true, reinicia y prueba una venta. Si con
// el diálogo visible SÍ se ve el contenido del ticket (no en blanco), el
// problema es específico del modo silencioso (tamaño de página / driver).
// Si el diálogo también muestra el ticket en blanco, el problema está en la
// generación del HTML o en cómo se está cargando en la ventana oculta.
// Vuelve a poner esto en false para producción.
const DEBUG_SHOW_PRINT_DIALOG = false

// Ancho de papel térmico en puntos PDF (1mm ≈ 2.83465pt).
// La impresora del usuario es de 58mm, no 80mm — si algún día cambian de
// impresora a una de 80mm, basta con ajustar este valor a 227.
const PAPER_WIDTH_PT = 164 // ≈ 58mm
const PAGE_MARGIN_PT = 16 // margen extra: el área imprimible real suele ser más angosta que el ancho nominal del rollo

// Genera el PDF de un ticket y lo guarda en disco. Se usa tanto al cobrar
// (TicketReceipt -> onPrint) como al reimprimir desde el historial en Settings.
//
// IMPORTANTE sobre el layout: cada línea se posiciona explícitamente en x=left.
// PDFKit "arrastra" el cursor (doc.x) de la última llamada a .text() con x
// manual — si una columna angosta (ej. el precio a la derecha) no resetea el
// x, las líneas siguientes heredan ese ancho angosto y todo se ve empujado
// a la derecha. Por eso cada helper aquí abajo siempre especifica left
// explícitamente en vez de confiar en el cursor.
//
// IMPORTANTE sobre el ancho de página: el navegador/driver de la impresora
// térmica NO escala el PDF al papel real, lo recorta. Por eso el ancho de
// página del PDF debe coincidir exactamente con el ancho físico del rollo
// (ver PAPER_WIDTH_PT arriba).
function buildTicketPdf(filePath: string, data: any): Promise<void> {
  const { orderId, items, total, subtotal, descuento, promos, pagos, businessName, cajero, date } = data

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [PAPER_WIDTH_PT, 700], margin: PAGE_MARGIN_PT })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    const left = doc.page.margins.left
    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right

    // Escribe una línea a todo el ancho, siempre anclada al margen izquierdo.
    const line = (text: string, opts: any = {}) => {
      doc.text(text, left, doc.y, { width: contentWidth, ...opts })
    }

    // Escribe una fila de dos columnas (ej. "3x KEKE" ... "$300.00") en el mismo
    // renglón, calculando manualmente el siguiente Y para que no queden desalineadas.
    const row = (leftText: string, rightText: string, opts: { leftWidth?: number; fontSize?: number; bold?: boolean } = {}) => {
      const fontSize = opts.fontSize ?? 8
      const leftWidth = opts.leftWidth ?? contentWidth * 0.58
      const rightWidth = contentWidth - leftWidth
      const startY = doc.y

      doc.font(opts.bold ? 'Courier-Bold' : 'Courier').fontSize(fontSize)
      doc.text(leftText, left, startY, { width: leftWidth })
      const leftEndY = doc.y

      doc.text(rightText, left + leftWidth, startY, { width: rightWidth, align: 'right' })
      const rightEndY = doc.y

      doc.y = Math.max(leftEndY, rightEndY)
    }

    const drawDashedLine = () => {
      doc.moveTo(left, doc.y)
        .lineTo(doc.page.width - doc.page.margins.right, doc.y)
        .dash(2, { space: 2 })
        .stroke()
      doc.undash()
      doc.moveDown(0.4)
    }

    doc.font('Courier-Bold').fontSize(11)
    line(businessName || 'MI NEGOCIO POS', { align: 'center' })
    doc.moveDown(0.3)

    doc.font('Courier').fontSize(7)
    line(`Ticket #${orderId}`, { align: 'center' })
    line(`Cajero: ${cajero || 'Admin'}`, { align: 'center' })
    line(date ? new Date(date).toLocaleString('es-MX') : new Date().toLocaleString('es-MX'), { align: 'center' })
    doc.moveDown(0.5)

    drawDashedLine()

    ;(items || []).forEach((item: any) => {
      const lineTotal = (item.precio * item.cantidad).toFixed(2)
      row(`${item.cantidad}x ${item.nombre}`, `$${lineTotal}`, { bold: true, fontSize: 8 })

      if (item.descuento_aplicado > 0) {
        doc.font('Courier').fontSize(6).fillColor('#555555')
        line(`  ${item.promocion_nombre || 'Promoción'} -$${Number(item.descuento_aplicado).toFixed(2)}`)
        doc.fillColor('#000000')
      }
    })

    doc.moveDown(0.3)
    drawDashedLine()

    if (descuento && descuento > 0) {
      doc.font('Courier').fontSize(8)
      line(`SUBTOTAL: $${Number(subtotal || 0).toFixed(2)}`, { align: 'right' })
      doc.fontSize(7)
      line(`DESC (${(promos || []).join(', ')}): -$${Number(descuento).toFixed(2)}`, { align: 'right' })
      doc.moveDown(0.3)
    }

    doc.font('Courier-Bold').fontSize(10)
    line(`TOTAL: $${Number(total || 0).toFixed(2)}`, { align: 'right' })
    doc.moveDown(0.5)

    if (pagos && pagos.length > 0) {
      drawDashedLine()
      pagos.forEach((pago: any) => {
        const monto = Number(pago.monto ?? pago.monto_recibido ?? 0)
        doc.font('Courier').fontSize(8)
        line(`PAGO (${String(pago.metodo || '').toUpperCase()}): $${monto.toFixed(2)}`, { align: 'right' })
        if (pago.cambio > 0) {
          doc.fontSize(7).fillColor('#444444')
          line(`Cambio: $${Number(pago.cambio).toFixed(2)}`, { align: 'right' })
          doc.fillColor('#000000')
        }
      })
    }

    doc.end()
    stream.on('finish', () => resolve())
    stream.on('error', reject)
  })
}

export function registerPrinterHandlers() {

// Genera una versión HTML del mismo ticket, pensada solo para imprimir
// (no se guarda en disco). Usamos HTML en vez del PDF generado por pdfkit
// porque Electron no renderiza PDFs de forma confiable dentro de una
// BrowserWindow oculta (el visor embebido de Chromium requiere el plugin
// del PDF y aun así puede no estar listo cuando se dispara la impresión).
// HTML normal, en cambio, imprime sin ningún tipo de intermediario.
function buildTicketHtml(data: any): string {
  const { orderId, items, total, subtotal, descuento, promos, pagos, businessName, cajero, date } = data

  const esc = (s: any) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

  const itemsHtml = (items || []).map((item: any) => {
    const lineTotal = (item.precio * item.cantidad).toFixed(2)
    const descuentoHtml = item.descuento_aplicado > 0
      ? `<div class="sub">${esc(item.promocion_nombre || 'Promoción')} -$${Number(item.descuento_aplicado).toFixed(2)}</div>`
      : ''
    return `
      <div class="row bold">
        <span>${esc(item.cantidad)}x ${esc(item.nombre)}</span>
        <span>$${lineTotal}</span>
      </div>
      ${descuentoHtml}
    `
  }).join('')

  const descuentoHtml = (descuento && descuento > 0) ? `
    <div class="row"><span>SUBTOTAL:</span><span>$${Number(subtotal || 0).toFixed(2)}</span></div>
    <div class="row sub"><span>DESC (${esc((promos || []).join(', '))}):</span><span>-$${Number(descuento).toFixed(2)}</span></div>
  ` : ''

  const pagosHtml = (pagos && pagos.length > 0) ? `
    <div class="dashed"></div>
    ${pagos.map((pago: any) => {
      const monto = Number(pago.monto ?? pago.monto_recibido ?? 0)
      const cambioHtml = pago.cambio > 0 ? `<div class="row muted"><span>Cambio</span><span>$${Number(pago.cambio).toFixed(2)}</span></div>` : ''
      return `<div class="row"><span>PAGO (${esc(String(pago.metodo || '').toUpperCase())})</span><span>$${monto.toFixed(2)}</span></div>${cambioHtml}`
    }).join('')}
  ` : ''

  const fecha = date ? new Date(date).toLocaleString('es-MX') : new Date().toLocaleString('es-MX')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: 58mm 210mm; margin: 6mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Courier New', Courier, monospace;
    font-weight: bold;
    font-size: 10px;
    color: #000;
    margin: 0;
    padding: 0;
  }
  .center { text-align: center; }
  .title { font-size: 13px; margin-bottom: 4px; }
  .meta { font-size: 9px; margin-bottom: 2px; }
  .dashed { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; margin: 2px 0; }
  .row.bold { font-weight: bold; }
  .sub { font-size: 9px; color: #444; margin: 0 0 3px 0; }
  .muted { color: #444; }
  .total { font-size: 13px; font-weight: bold; text-align: right; margin: 6px 0; }
</style>
</head>
<body>
  <div class="center title">${esc(businessName || 'MI NEGOCIO POS')}</div>
  <div class="center meta">Ticket #${esc(orderId)}</div>
  <div class="center meta">Cajero: ${esc(cajero || 'Admin')}</div>
  <div class="center meta">${esc(fecha)}</div>
  <div class="dashed"></div>
  ${itemsHtml}
  <div class="dashed"></div>
  ${descuentoHtml}
  <div class="total">TOTAL: $${Number(total || 0).toFixed(2)}</div>
  ${pagosHtml}
</body>
</html>`
}

// Imprime el ticket directo a la impresora predeterminada del sistema, sin
// abrir ningún visor externo ni mostrar diálogo alguno. Escribe un HTML
// temporal, lo carga en una ventana de Electron invisible, y llama a
// webContents.print() en modo silencioso.
function printTicketSilently(data: any): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    const tmpDir = app.getPath('temp')
    const tmpFile = path.join(tmpDir, `hipos_print_${Date.now()}.html`)
    fs.writeFileSync(tmpFile, buildTicketHtml(data), 'utf-8')

    const cleanup = () => { try { fs.unlinkSync(tmpFile) } catch { /* noop */ } }

    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: false }
    })

    printWindow.webContents.on('did-finish-load', () => {
      printWindow.webContents.print(
        {
          silent: DEBUG_SHOW_PRINT_DIALOG ? false : true,
          printBackground: true,
          margins: { marginType: 'none' },
          // Tamaño de página en micrones (1mm = 1000 micrones). Sin diálogo de
          // por medio, Electron puede ignorar el @page del CSS y usar Carta/A4
          // por defecto — hay que forzarlo aquí explícitamente al tamaño real
          // del rollo térmico (58mm de ancho).
          pageSize: { width: 58000, height: 210000 },
          // Replica el control de "Escala" que el usuario tuvo que bajar manualmente
          // en el diálogo de Chrome para que el PDF cupiera sin recortes: el área
          // imprimible real de esta térmica es más angosta que los 58mm nominales.
          scaleFactor: 90
        },
        (success, failureReason) => {
          printWindow.close()
          cleanup()
          if (success) resolve({ success: true })
          else resolve({ success: false, error: failureReason })
        }
      )
    })

    printWindow.webContents.on('did-fail-load', (_e, _code, desc) => {
      printWindow.close()
      cleanup()
      resolve({ success: false, error: desc })
    })

    printWindow.loadFile(tmpFile)
  })
}

  // Ruta donde se guardan los PDFs de tickets (ya la usaba Settings.tsx)
  ipcMain.handle('get-tickets-path', () => getTicketsDir())

  // ==========================================
  // GENERAR / REGENERAR PDF DE UN TICKET
  // Se llama desde TicketReceipt (venta recién cobrada) y desde
  // Settings > Historial de tickets (reimpresión).
  // ==========================================
  ipcMain.handle('generate-ticket-pdf', async (_, payload) => {
    try {
      if (!payload || !payload.orderId) {
        return { success: false, error: 'Faltan datos del ticket' }
      }

      const dir = getTicketsDir()
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const filePath = path.join(dir, `ticket_${payload.orderId}_${Date.now()}.pdf`)
      await buildTicketPdf(filePath, payload)

      // Imprimimos directo a la impresora predeterminada, sin abrir ningún
      // visor externo ni mostrar diálogo de impresión.
      const printResult = await printTicketSilently(payload)
      if (!printResult.success) {
        console.error('Error al imprimir el ticket:', printResult.error)
        return { success: false, error: printResult.error || 'No se pudo imprimir el ticket', path: filePath }
      }

      return { success: true, path: filePath }
    } catch (error: any) {
      console.error('Error generando ticket PDF:', error)
      return { success: false, error: error.message }
    }
  })

  // ==========================================
  // HISTORIAL DE TICKETS POR FECHA (Settings.tsx)
  // ==========================================
  ipcMain.handle('get-tickets-by-date', (_, { date }) => {
    if (!db) return { success: false, error: 'Sin conexión a BD' }
    try {
      const orders = db.prepare(`
        SELECT o.id, o.total, o.estatus, o.creado_en, u.nombre as cajero
        FROM orden o
        LEFT JOIN user u ON o.user_id = u.id
        WHERE date(o.creado_en) = ? AND o.estatus IN ('pagada', 'cancelada')
        ORDER BY o.id DESC
      `).all(date) as any[]

      const tickets = orders.map((o) => {
        const items = db.prepare(`
          SELECT nombre, cantidad, precio, descuento_aplicado, promocion_id
          FROM orden_item WHERE orden_id = ?
        `).all(o.id) as any[]

        const pagos = db.prepare(`
          SELECT metodo, monto_recibido, cambio FROM pago WHERE orden_id = ?
        `).all(o.id) as any[]

        const metodo = pagos.length > 1 ? 'Mixto' : (pagos[0]?.metodo || 'N/A')

        return {
          ...o,
          items,
          pagos,
          metodo,
          monto_recibido: pagos[0]?.monto_recibido,
          cambio: pagos[0]?.cambio
        }
      })

      return { success: true, tickets }
    } catch (error: any) {
      console.error('Error en get-tickets-by-date:', error)
      return { success: false, error: error.message }
    }
  })
}