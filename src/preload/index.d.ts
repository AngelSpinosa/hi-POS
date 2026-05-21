//src/preload/index.d.ts
import { ElectronAPI } from '@electron-toolkit/preload'
import { Producto, Insumo } from '../renderer/src/types/db'

// Extendemos Producto para incluir la propiedad dinámica 'disponible'
// Esto nos sirve para el frontend al evaluar si hay stock suficiente
export interface ProductoPOS extends Producto {
  disponible?: boolean;
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: unknown
  }
}