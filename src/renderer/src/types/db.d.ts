// ==========================================
// 📦 ENTIDADES DE BASE DE DATOS (TABLAS SQL)
// ==========================================

export interface User {
  id: number;
  nombre: string;
  rol: 'admin' | 'cajero';
  pin: string;
  active: number;
}

export interface Producto {
  id: number;
  nombre: string;
  precio: number;
  active: number;
}

export interface Mesa {
  id: number;
  numero: number;
  activa: number;
  // Campos calculados en la query (no columnas físicas, pero vienen de la BD)
  estado_orden?: 'libre' | 'abierta' | 'enviada_cocina' | 'cuenta_solicitada'; 
  total_actual?: number;
}

export interface Orden {
  id: number;
  user_id: number;
  id_reporte_diario?: number | null;
  mesa_id?: number | null;
  estatus: 'abierta' | 'enviada_cocina' | 'cuenta_solicitada' | 'pagada' | 'cancelada';
  total: number;
  creado_en: string;
  ticket_impreso: number;
}

export interface OrdenItem {
  id: number;
  orden_id: number;
  producto_id: number;
  nombre: string;
  precio: number;
  cantidad: number;
  comanda_impresa: number;
}

export interface ReporteDiario {
  id: number;
  fecha: string;
  total_ventas: number;
  total_pedidos: number;
  total_efectivo: number;
  total_tarjeta: number;
}

export interface Licencia {
  id: number;
  tipo: string;
  expira_en: string;
}

export interface Insumo {
  id: number;
  codigo: string;
  nombre: string;
  unidad_medida: string;
  stock_actual: number;
  stock_minimo: number;
}

export interface RecetaProducto {
  id: number;
  producto_id: number;
  insumo_id: number;
  cantidad_requerida: number;
}

export interface MovimientoInventario {
  id: number;
  insumo_id: number;
  tipo: 'ENTRADA' | 'SALIDA' | 'MERMA' | string;
  cantidad: number;
  motivo: string;
  fecha: string;
}

// ==========================================
// 💻 TIPOS AUXILIARES DE LA UI (NO SON TABLAS)
// ==========================================

// Extensión de OrdenItem para uso en el Frontend
export interface CartItem extends OrdenItem { }

// DTO (Data Transfer Object) para el recibo.
// Esto NO se guarda en BD, se construye en memoria al pagar para mostrar el modal.
export interface TicketData {
  orderId: number;
  items: CartItem[];
  total: number;
  date: string;
  payment: {
    method: string;
    amount: number;
    change: number;
  };
}

// Tipo para el historial visual (proyección de datos)
export interface OrdenHistorial {
  id: number;
  total: number;
  creado_en: string;
  metodo: string;
  mesa: number;
}