import { ElectronAPI } from '@electron-toolkit/preload'
import { Producto, Insumo } from '../renderer/src/types/db'

export interface ProductoPOS extends Producto {
  disponible?: boolean;
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getInsumos: () => Promise<any>
      getProductosPOS: () => Promise<any>
      checkoutOrder: (orderId: number) => Promise<any>
      payOrder: (payload: { orderId: number, payment: { method: string, received: number, amountToPay: number } }) => Promise<any>
    }
  }
}