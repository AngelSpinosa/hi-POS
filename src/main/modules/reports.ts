import { ipcMain, dialog } from 'electron'
import { db } from '../database'
import * as xlsx from 'xlsx' // Librería de Excel

export function registerReportHandlers() {
  
  // ==========================================
  // OBTENER REPORTE DIARIO (Corregido)
  // ==========================================
    ipcMain.handle('get-daily-report', (_, { date }) => {
    if (!db) return { success: false }
    try {
      const report = db.prepare('SELECT * FROM reporte_diario WHERE date(fecha) = ?').get(date)

      // SIN LEFT JOIN EN PAGO: Así evitamos filas duplicadas en el historial.
      const orders = db.prepare(`
        SELECT o.id, o.total, o.estatus, o.creado_en, u.nombre as cajero, o.mesa_id as mesa
        FROM orden o
        LEFT JOIN user u ON o.user_id = u.id
        WHERE date(o.creado_en) = ? AND o.estatus IN ('pagada', 'cancelada')
        ORDER BY o.id DESC
      `).all(date) as any[]

      const ordersWithDetails = orders.map(order => {
        const items = db.prepare('SELECT nombre, cantidad, precio FROM orden_item WHERE orden_id = ?').all(order.id)
        const pagos = db.prepare('SELECT metodo, monto_recibido, cambio FROM pago WHERE orden_id = ?').all(order.id) as any[]
        const metodoPrincipal = pagos.length > 1 ? 'Mixto' : (pagos[0]?.metodo || 'N/A')
        return { ...order, items, pagos, metodo: metodoPrincipal }
      })

      return { success: true, report, orders: ordersWithDetails }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  // ==========================================
  // OBTENER DETALLE DE UNA ORDEN PARA EL MODAL
  // ==========================================
  ipcMain.handle('get-order-details', (_, { orderId }) => {
    if (!db) return { success: false }
    try {
      const items = db.prepare('SELECT nombre, cantidad, precio FROM orden_item WHERE orden_id = ?').all(orderId)
      // ESTA ES LA LÍNEA QUE FALTABA: Mandamos el arreglo de pagos al frontend para que el modal los dibuje
      const pagos = db.prepare('SELECT metodo, monto_recibido, cambio FROM pago WHERE orden_id = ?').all(orderId)
      return { success: true, items, pagos }
    } catch (error: any) { return { success: false, error: error.message } }
  })

  // ==========================================
  // GUARDAR CORTE DE CAJA MVP
  // ==========================================
  ipcMain.handle('save-daily-cut', (_, { date, realCash, difference }) => {
    if (!db) return { success: false, error: 'DB no conectada' };
    try {
      const reporte = db.prepare('SELECT id FROM reporte_diario WHERE date(fecha) = ?').get(date) as any;
      if (reporte) {
        db.prepare('UPDATE reporte_diario SET dinero_real = ?, diferencia = ? WHERE id = ?').run(realCash, difference, reporte.id);
      } else {
        db.prepare('INSERT INTO reporte_diario (fecha, dinero_real, diferencia) VALUES (?, ?, ?)').run(date, realCash, difference);
      }
      return { success: true };
    } catch (error: any) {
      console.error('❌ Error save-daily-cut:', error);
      return { success: false, error: error.message };
    }
  });

  // ==========================================
  // CU-49: EXPORTAR A EXCEL (.xlsx)
  // ==========================================
  ipcMain.handle('export-excel', async (_, { range, referenceDate }) => {
    if (!db) return { success: false, error: 'Base de datos no conectada' };

    try {
      let startDateStr = referenceDate;
      let endDateStr = referenceDate;

      // Usamos T12:00:00 para evitar que la zona horaria cambie el día mágicamente
      const refDateObj = new Date(referenceDate + 'T12:00:00'); 

      if (range === 'yesterday') {
        refDateObj.setDate(refDateObj.getDate() - 1);
        startDateStr = refDateObj.toISOString().split('T')[0];
        endDateStr = startDateStr;
      } else if (range === 'week') {
        endDateStr = referenceDate;
        refDateObj.setDate(refDateObj.getDate() - 6); // Los 6 días anteriores + el actual = 7 días
        startDateStr = refDateObj.toISOString().split('T')[0];
      }

      // 1. Extraer Órdenes del rango seleccionado
      const orders = db.prepare(`
        SELECT o.id, o.creado_en, o.estatus, o.total, p.metodo, u.nombre as cajero
        FROM orden o
        LEFT JOIN pago p ON o.id = p.orden_id
        LEFT JOIN user u ON o.user_id = u.id
        WHERE date(o.creado_en) BETWEEN ? AND ? AND o.estatus != 'cancelada'
        ORDER BY o.creado_en ASC
      `).all(startDateStr, endDateStr) as any[];

      // 2. Extraer Artículos Vendidos en ese mismo rango
      const items = db.prepare(`
        SELECT oi.orden_id, oi.nombre, oi.cantidad, oi.precio, (oi.cantidad * oi.precio) as subtotal
        FROM orden_item oi
        JOIN orden o ON oi.orden_id = o.id
        WHERE date(o.creado_en) BETWEEN ? AND ? AND o.estatus != 'cancelada'
      `).all(startDateStr, endDateStr) as any[];

      // 3. Formatear la Data para Excel (Headers en Español)
      const orderData = orders.map(o => ({
        'Orden #': o.id,
        'Fecha y Hora': o.creado_en,
        'Cajero / Mesero': o.cajero || 'N/A',
        'Método Pago': o.metodo ? o.metodo.toUpperCase() : 'PENDIENTE',
        'Estatus': o.estatus.toUpperCase(),
        'Total ($)': o.total
      }));

      const itemData = items.map(i => ({
        'Orden #': i.orden_id,
        'Producto': i.nombre,
        'Cantidad': i.cantidad,
        'Precio Unitario ($)': i.precio,
        'Subtotal ($)': i.subtotal
      }));

      // 4. Crear el Libro de Excel (.xlsx)
      const wb = xlsx.utils.book_new();
      
      // Creamos dos hojas (Pestañas en la parte de abajo de Excel)
      const wsOrders = xlsx.utils.json_to_sheet(orderData);
      const wsItems = xlsx.utils.json_to_sheet(itemData);

      xlsx.utils.book_append_sheet(wb, wsOrders, 'Ventas Generales');
      xlsx.utils.book_append_sheet(wb, wsItems, 'Artículos Vendidos');

      // 5. Pedirle al usuario que elija dónde guardar el archivo
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Exportar Reporte a Excel',
        defaultPath: `Reporte_Ventas_${startDateStr}_al_${endDateStr}.xlsx`,
        filters: [{ name: 'Hojas de Cálculo Excel', extensions: ['xlsx'] }]
      });

      if (canceled || !filePath) return { success: false, canceled: true };

      // 6. Escribir el archivo físico
      xlsx.writeFile(wb, filePath);

      return { success: true };
    } catch (error: any) {
      console.error('Error al exportar Excel:', error);
      return { success: false, error: error.message };
    }
  });

}