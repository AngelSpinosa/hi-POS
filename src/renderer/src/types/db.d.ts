export interface User {
  id: number;
  nombre: string;
  rol: 'admin' | 'cajero';
  pin: string; // <--- NUEVO: Clave de acceso
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

export interface CartItem extends OrdenItem { }

export interface ReporteDiario {
  id: number;
  fecha: string;
  total_ventas: number;
  total_pedidos: number;
  total_efectivo: number;
  total_tarjeta: number;
}

export interface OrdenHistorial {
  id: number;
  total: number;
  creado_en: string;
  metodo: string;
  mesa: number;
}