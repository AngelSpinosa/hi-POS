// ==========================================
// ENTIDADES DE BASE DE DATOS (TABLAS SQL)
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
  active: boolean;
  categoria_id?: number | null;
  categoria_nombre?: string | null; // Lo obtenemos del LEFT JOIN
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
  promocion_nombre?: string | null; // Viene del JOIN con promocion, solo para mostrar al cajero
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
  active: boolean;
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
  tipo: 'ENTRADA' | 'SALIDA' | 'MERMA';
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
//  NUEVAS ENTIDADES: DELIVERY
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
  estado_envio: 'en_cocina' | 'en_camino' | 'entregado'; // <-- Nuevo: para el tablero de Pedidos
  notas_entrega?: string | null;
  monto_comision: number;
  ingreso_neto: number;
}

// Fila combinada que devuelve get-delivery-orders (JOIN de orden_domicilio + cliente + orden)
export interface PedidoDomicilio extends OrdenDomicilio {
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_direccion: string | null; // <-- Viene de cliente.direccion_defecto
  orden_estatus: Orden['estatus'];
  orden_total: number;
}

// ==========================================
// 📦 NUEVAS ENTIDADES: PROMOCIONES
// ==========================================

export interface Promocion {
  id: number;
  nombre: string;
  tipo: '2x1' | '% TOTAL' | '% de producto' | 'Precio Fijo';
  valor: number | null;
  valor_pago: number | null;   // <-- Nuevo: para '2x1' generalizado ("X productos por el precio de Y")
  dias_activa: string | null;  // <--- Añadido según tu BD
  hora_inicio: string | null;  // <--- Corregido
  hora_fin: string | null;     // <--- Corregido
  activa: boolean;
}

export interface PromocionCategoria {
  promocion_id: number;
  categoria_id: number;
}

export interface Categoria {
  id: number;
  nombre: string;
  activa: boolean;
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


export interface CrearPromocionPayload {
  nombre: string;
  tipo: '2x1' | '% TOTAL' | '% de producto' | 'Precio Fijo';
  valor: number | null;
  valor_pago?: number | null;  // <-- Nuevo: solo aplica para '2x1' ("X productos por el precio de Y")
  dias_activa: string;         // <--- Añadir esta línea
  hora_inicio: string | null;
  hora_fin: string | null;
  aplica_a: 'Categorias' | 'Productos';
  referencia_ids: number[]; 
}