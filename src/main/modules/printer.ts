import { ipcMain, app, shell } from 'electron'
import path from 'path'
import fs from 'fs'
import PDFDocument from 'pdfkit'
import { db } from '../database'

function getTicketsDir(): string {
  return path.join(app.getPath('documents'), 'hi-POS_Tickets')
}

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

      // Abrimos el PDF con el visor predeterminado del sistema — desde ahí
      // el usuario manda a imprimir con Ctrl+P como con cualquier PDF.
      await shell.openPath(filePath)

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