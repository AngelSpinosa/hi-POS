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
  estado_orden?: 'libre' | 'abierta' | 'enviada_cocina' | 'cuenta_solicitada'; 
  total_actual?: number;
}

export interface Orden {
  id: number;
  user_id: number;
  id_reporte_diario?: number | null;
  mesa_id?: number | null;
  orden_padre_id?: number | null;
  tipo_orden: 'local' | 'domicilio' | 'llevar';
  estatus: 'abierta' | 'enviada_cocina' | 'cuenta_solicitada' | 'pagada' | 'cancelada';
  total: number;
  descuento_total: number;
  motivo_descuento?: string | null;
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
  descuento_aplicado: number;
  promocion_id?: number | null;
}

export interface Pago {
  id: number;
  orden_id: number; // Relación 1 a N ahora
  metodo: 'efectivo' | 'tarjeta' | 'app_delivery' | 'transferencia' | string;
  monto_recibido: number;
  creado_en: string;
  cambio: number;
}

export interface ReporteDiario {
  id: number;
  fecha: string;
  total_ventas: number;
  total_pedidos: number;
  total_efectivo: number;
  total_tarjeta: number;
  total_ingreso_apps: number;
  total_comisiones_pagadas: number;
  dinero_real?: number | null;
  diferencia?: number | null;
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
  active: number;
}

export interface receta_producto {
  id: number;
  producto_id: number;
  insumo_id: number;
  cantidad_requerida: number;
}

export interface movimiento_inventario {
  id: number;
  insumo_id: number;
  tipo: 'ENTRADA' | 'SALIDA' | 'MERMA' | string;
  cantidad: number;
  motivo: string;
  fecha: string;
}

export interface AppConfig {
  id: number;
  business_name: string | null;
  logo_path: string | null;
  color_primary: string;
  color_secondary: string;
  setup_completed: number;
}

// ==========================================
// 📦 NUEVAS ENTIDADES: DELIVERY
// ==========================================

export interface CanalDelivery {
  id: number;
  nombre: string;
  activo: number;
  comision_porcentaje_default: number;
  impuesto_retenido_default: number;
}

export interface Cliente {
  id: number;
  nombre: string;
  telefono: string;
  direccion_defecto?: string | null;
  notas?: string | null;
}

export interface OrdenDomicilio {
  id: number;
  orden_id: number;
  cliente_id: number;
  canal_delivery_id: number;
  codigo_plataforma?: string | null;
  costo_envio: number;
  notas_entrega?: string | null;
  monto_comision: number;
  ingreso_neto: number;
}

// ==========================================
// 📦 NUEVAS ENTIDADES: PROMOCIONES
// ==========================================

export interface Promocion {
  id: number;
  nombre: string;
  tipo: 'porcentaje' | 'monto_fijo' | '2x1' | string;
  valor: number;
  dias_activa: string;
  hora_inicio?: string | null;
  hora_fin?: string | null;
  activa: number;
}

export interface PromocionProducto {
  promocion_id: number;
  producto_id: number;
}

// ==========================================
//  TIPOS AUXILIARES DE LA UI (NO SON TABLAS)
// ==========================================

export interface CartItem extends OrdenItem { }

export interface TicketData {
  orderId: number;
  tipo_orden: Orden['tipo_orden'];
  items: CartItem[];
  subtotal?: number;
  descuento_total: number;
  total: number;
  date: string;
  pagos: {
    metodo: string;
    monto: number;
    cambio: number;
  }[]; // Cambiado para soportar pagos mixtos
  cajero?: string;
  cliente?: Cliente; // Opcional para delivery
}

export interface OrdenHistorial {
  id: number;
  total: number;
  creado_en: string;
  metodos_pago: string[]; // Cambiado a array para pagos mixtos
  tipo_orden: Orden['tipo_orden'];
  mesa?: number | null;
  cajero?: string;
}