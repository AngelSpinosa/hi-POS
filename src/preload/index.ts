import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Exponemos las llamadas al Backend a través de ipcRenderer
const api = {
  getInsumos: () => ipcRenderer.invoke('get-insumos'),
  getProductosPOS: () => ipcRenderer.invoke('get-productos-pos'),
  checkoutOrder: (orderId: number) => ipcRenderer.invoke('checkout-order', orderId),
  // NUEVO: Handler dedicado para pagos (soporta pagos parciales)
  payOrder: (payload: any) => ipcRenderer.invoke('pay-order', payload)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}