// Mapeo exacto del esquema de la base de datos SQLite utilizada en la aplicación POS

export interface User {
  id: number;
  nombre: string;
  rol: 'admin' | 'cajero';
  active: number; // SQLite guarda booleanos como 0 o 1
}

export interface Producto {
  id: number;
  nombre: string;
  precio: number; // INTEGER en tu DB
  active: number; // 1 = activo, 0 = inactivo
}

export interface Orden {
  id: number;
  user_id: number;
  id_reporte_diario?: number | null; // Puede ser null
  estatus: 'pendiente' | 'pagada' | 'cancelada';
  total: number; // FLOAT en tu DB
  creado_en: string; // SQLite devuelve fechas como string
  ticket_impreso: number; // 0 o 1
}

export interface OrdenItem {
  id: number;
  orden_id: number;
  producto_id: number;
  nombre: string;
  precio: number; // FLOAT en tu DB (precio histórico)
  cantidad: number;
}

export interface Pago {
  id: number;
  orden_id: number;
  metodo: 'efectivo' | 'tarjeta';
  monto_recibido: number;
  creado_en: string;
  cambio: number;
}

// Interfaces auxiliares para el Frontend (No existen en BD tal cual)
export interface CartItem extends Producto {
  quantity: number;
}