import { ipcMain } from 'electron'
import { db } from '../database'
import { CrearPromocionPayload } from '../../renderer/src/types/db' // Ajusta la ruta si es necesario

// Desactiva automáticamente las promociones cuya vigencia (hora_fin) ya pasó.
// Se compara solo por fecha (date()), así que una promo con hora_fin = '2026-07-14'
// sigue activa durante todo ese día y se apaga a partir del 15.
function expirarPromocionesVencidas() {
  if (!db) return
  try {
    db.prepare(`
      UPDATE promocion 
      SET activa = 0 
      WHERE activa = 1 
        AND hora_fin IS NOT NULL 
        AND date('now', 'localtime') > date(hora_fin)
    `).run()
  } catch (error) {
    console.error('Error expirando promociones vencidas:', error)
  }
}

export function registerProductHandlers() {
  
  // 0. Obtener TODAS las categorías (Nuevo handler)
  ipcMain.handle('get-categories', () => {
    if (!db) return []
    try {
      return db.prepare('SELECT * FROM categoria ORDER BY activa DESC, nombre ASC').all()
    } catch (error) {
      console.error('Error obteniendo categorías:', error)
      return []
    }
  })

  // 1. Obtener TODOS los productos (Ahora trae el nombre de la categoría)
  ipcMain.handle('get-products', () => {
    if (!db) return []
    try {
      // Usamos LEFT JOIN por si hay productos antiguos sin categoría asignada
      const query = `
        SELECT p.*, c.nombre AS categoria_nombre 
        FROM producto p 
        LEFT JOIN categoria c ON p.categoria_id = c.id 
        ORDER BY p.active DESC, p.nombre ASC
      `
      return db.prepare(query).all()
    } catch (error) {
      console.error('Error obteniendo productos:', error)
      return []
    }
  })

  // 2. Crear Producto (Ahora acepta categoria_id)
  ipcMain.handle('create-product', (_, { nombre, precio, categoria_id }) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      if (!nombre || nombre.trim() === '') throw new Error('El nombre es obligatorio')
      
      const precioNum = Number(precio)
      if (isNaN(precioNum) || precioNum < 0) throw new Error('El precio no puede ser negativo ni estar vacío')

      const nombreMayus = nombre.trim().toUpperCase()

      // Validar duplicidad
      const existe = db.prepare('SELECT id FROM producto WHERE nombre = ?').get(nombreMayus)
      if (existe) throw new Error(`Ya existe un producto llamado "${nombreMayus}"`)

      // Insertar con categoría (puede ser null)
      const stmt = db.prepare('INSERT INTO producto (nombre, precio, categoria_id, active) VALUES (?, ?, ?, 1)')
      const info = stmt.run(nombreMayus, precioNum, categoria_id || null)
      return { success: true, id: info.lastInsertRowid }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 3. Editar Producto (Ahora actualiza categoria_id)
  ipcMain.handle('update-product', (_, { id, nombre, precio, categoria_id }) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      if (!nombre || nombre.trim() === '') throw new Error('El nombre es obligatorio')
      
      const precioNum = Number(precio)
      if (isNaN(precioNum) || precioNum < 0) throw new Error('El precio no puede ser negativo ni estar vacío')

      const nombreMayus = nombre.trim().toUpperCase()

      // Validar duplicidad (excluyendo el que estamos editando)
      const existe = db.prepare('SELECT id FROM producto WHERE nombre = ? AND id != ?').get(nombreMayus, id)
      if (existe) throw new Error(`Ya existe otro producto llamado "${nombreMayus}"`)

      const stmt = db.prepare('UPDATE producto SET nombre = ?, precio = ?, categoria_id = ? WHERE id = ?')
      stmt.run(nombreMayus, precioNum, categoria_id || null, id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 4. Activar / Desactivar Producto
  ipcMain.handle('toggle-product-status', (_, { id, active }) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      const stmt = db.prepare('UPDATE producto SET active = ? WHERE id = ?')
      stmt.run(active ? 1 : 0, id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 5. Crear Promoción (NUEVO)
  ipcMain.handle('create-promocion', (_, payload: CrearPromocionPayload) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      const { nombre, tipo, valor, valor_pago, dias_activa, hora_inicio, hora_fin, aplica_a, referencia_ids } = payload

      if (!nombre || nombre.trim() === '') throw new Error('El nombre de la promoción es obligatorio')

      // Para '2x1' generalizado: X productos por el precio de Y. Y debe ser menor que X.
      if (tipo === '2x1') {
        if (!valor || valor <= 0) throw new Error('Indica cuántos productos incluye la promoción')
        if (!valor_pago || valor_pago <= 0) throw new Error('Indica por el precio de cuántos se paga')
        if (valor_pago >= valor) throw new Error('El "precio de" debe ser menor a la cantidad de productos')
      }

      const crearPromocionTx = db.transaction(() => {
        // 2. Agregamos dias_activa y valor_pago al INSERT
        const insertPromo = db.prepare(`
          INSERT INTO promocion (nombre, tipo, valor, valor_pago, dias_activa, hora_inicio, hora_fin, activa)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `)
        
        // 3. Pasamos las variables a la ejecución
        const info = insertPromo.run(
          nombre.trim(), 
          tipo, 
          valor, 
          tipo === '2x1' ? valor_pago : null,
          dias_activa, 
          hora_inicio || null, 
          hora_fin || null
        )
        const nuevaPromocionId = info.lastInsertRowid

        // B. Insertar en tabla puente según corresponda
        if (aplica_a === 'Categorias' && referencia_ids && referencia_ids.length > 0) {
          const insertPromoCat = db.prepare('INSERT INTO promocion_categoria (promocion_id, categoria_id) VALUES (?, ?)')
          for (const catId of referencia_ids) {
            insertPromoCat.run(nuevaPromocionId, catId)
          }
        } else if (aplica_a === 'Productos' && referencia_ids && referencia_ids.length > 0) {
          const insertPromoProd = db.prepare('INSERT INTO promocion_producto (promocion_id, producto_id) VALUES (?, ?)')
          for (const prodId of referencia_ids) {
            insertPromoProd.run(nuevaPromocionId, prodId)
          }
        }

        return nuevaPromocionId
      })

      // Ejecutamos la transacción
      const newId = crearPromocionTx()
      return { success: true, id: newId }

    } catch (error: any) {
      console.error('Error creando promoción:', error)
      return { success: false, error: error.message }
    }
  })

  // 6. Crear Categoría
  ipcMain.handle('create-category', (_, { nombre }) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      if (!nombre || nombre.trim() === '') throw new Error('El nombre de la categoría es obligatorio')
      const nombreLimpio = nombre.trim()

      // Validar duplicidad (ignorando mayúsculas/minúsculas)
      const existe = db.prepare('SELECT id FROM categoria WHERE LOWER(nombre) = LOWER(?)').get(nombreLimpio)
      if (existe) throw new Error(`Ya existe una categoría llamada "${nombreLimpio}"`)

      const stmt = db.prepare('INSERT INTO categoria (nombre, activa) VALUES (?, 1)')
      const info = stmt.run(nombreLimpio)
      return { success: true, id: info.lastInsertRowid }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 7. Editar Categoría
  ipcMain.handle('update-category', (_, { id, nombre }) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      if (!nombre || nombre.trim() === '') throw new Error('El nombre de la categoría es obligatorio')
      const nombreLimpio = nombre.trim()

      // Validar duplicidad excluyendo la categoría actual
      const existe = db.prepare('SELECT id FROM categoria WHERE LOWER(nombre) = LOWER(?) AND id != ?').get(nombreLimpio, id)
      if (existe) throw new Error(`Ya existe otra categoría llamada "${nombreLimpio}"`)

      const stmt = db.prepare('UPDATE categoria SET nombre = ? WHERE id = ?')
      stmt.run(nombreLimpio, id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 8. Activar / Desactivar Categoría
  ipcMain.handle('toggle-category-status', (_, { id, activa }) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      const stmt = db.prepare('UPDATE categoria SET activa = ? WHERE id = ?')
      stmt.run(activa ? 1 : 0, id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 9. Obtener Todas las Promociones
  ipcMain.handle('get-promociones', () => {
    if (!db) return []
    try {
      expirarPromocionesVencidas()
      return db.prepare('SELECT * FROM promocion ORDER BY activa DESC, id DESC').all()
    } catch (error) {
      console.error('Error obteniendo promociones:', error)
      return []
    }
  })

  // 10. Activar / Desactivar Promoción
  ipcMain.handle('toggle-promocion-status', (_, { id, activa }) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      const stmt = db.prepare('UPDATE promocion SET activa = ? WHERE id = ?')
      stmt.run(activa ? 1 : 0, id)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 11. Obtener Promociones Activas CON sus reglas (categorías/productos)
  // Este es el handler que consume useActiveOrder.ts para el motor de descuentos del carrito.
  // Antes NO existía, por eso ninguna promoción se aplicaba en la orden (CU-37).
  ipcMain.handle('get-active-promos-con-reglas', () => {
    if (!db) return []
    try {
      // Apaga primero cualquier promo cuya vigencia ya venció, para no traerla al carrito
      expirarPromocionesVencidas()

      const promos = db.prepare('SELECT * FROM promocion WHERE activa = 1').all() as any[]

      const getCategorias = db.prepare('SELECT categoria_id FROM promocion_categoria WHERE promocion_id = ?')
      const getProductos = db.prepare('SELECT producto_id FROM promocion_producto WHERE promocion_id = ?')

      return promos.map((promo) => ({
        id: promo.id,
        nombre: promo.nombre,
        tipo: promo.tipo,
        valor: promo.valor,
        valorPago: promo.valor_pago, // <-- Nuevo: para '2x1' generalizado ("X por el precio de Y")
        categorias: (getCategorias.all(promo.id) as any[]).map((r) => r.categoria_id),
        productos: (getProductos.all(promo.id) as any[]).map((r) => r.producto_id)
      }))
    } catch (error) {
      console.error('Error obteniendo promociones activas con reglas:', error)
      return []
    }
  })

  // 12. Actualizar Promoción Básica
  ipcMain.handle('update-promocion', (_, payload) => {
    if (!db) return { success: false, error: 'Base de datos no disponible' }
    try {
      const { id, nombre, valor, valor_pago, dias_activa, hora_inicio, hora_fin } = payload

      if (!nombre || nombre.trim() === '') throw new Error('El nombre de la promoción es obligatorio')

      // El tipo no se edita desde el formulario, pero necesitamos saberlo para
      // validar valor_pago si es una promo '2x1'.
      const promoActual = db.prepare('SELECT tipo FROM promocion WHERE id = ?').get(id) as any
      if (promoActual?.tipo === '2x1') {
        if (!valor || valor <= 0) throw new Error('Indica cuántos productos incluye la promoción')
        if (!valor_pago || valor_pago <= 0) throw new Error('Indica por el precio de cuántos se paga')
        if (valor_pago >= valor) throw new Error('El "precio de" debe ser menor a la cantidad de productos')
      }

      const stmt = db.prepare(`
        UPDATE promocion 
        SET nombre = ?, valor = ?, valor_pago = ?, dias_activa = ?, hora_inicio = ?, hora_fin = ? 
        WHERE id = ?
      `)
      
      stmt.run(nombre.trim(), valor, promoActual?.tipo === '2x1' ? valor_pago : null, dias_activa || 'Todos', hora_inicio || null, hora_fin || null, id)
      
      return { success: true }
    } catch (error: any) {
      console.error('Error actualizando promoción:', error)
      return { success: false, error: error.message }
    }
  })
}