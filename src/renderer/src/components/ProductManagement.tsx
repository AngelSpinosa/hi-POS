import { useEffect, useState } from 'react'
import { Producto } from '../types/db'

export const ProductManagement = ({ onBack }: { onBack: () => void }): JSX.Element => {
  const [products, setProducts] = useState<Producto[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Producto | null>(null)
  
  // Estado para formulario
  const [formData, setFormData] = useState({ nombre: '', precio: '' })
  const [error, setError] = useState('')

  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      // @ts-ignore (usamos window.electron directo)
      const data = await window.electron.ipcRenderer.invoke('get-products')
      setProducts(data)
    } catch (err) {
      console.error(err)
    }
  }

  const handleOpenCreate = () => {
    setEditingProduct(null)
    setFormData({ nombre: '', precio: '' })
    setIsModalOpen(true)
    setError('')
  }

  const handleOpenEdit = (prod: Producto) => {
    setEditingProduct(prod)
    setFormData({ nombre: prod.nombre, precio: prod.precio.toString() })
    setIsModalOpen(true)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.nombre.trim() || !formData.precio) {
      setError('Todos los campos son obligatorios')
      return
    }

    const precio = parseFloat(formData.precio)
    if (isNaN(precio) || precio < 0) {
      setError('El precio debe ser válido')
      return
    }

    try {
      let result
      if (editingProduct) {
        // Editar
        // @ts-ignore
        result = await window.electron.ipcRenderer.invoke('update-product', {
          id: editingProduct.id,
          nombre: formData.nombre,
          precio
        })
      } else {
        // Crear (CU-11)
        // @ts-ignore
        result = await window.electron.ipcRenderer.invoke('create-product', {
          nombre: formData.nombre,
          precio
        })
      }

      if (result.success) {
        setIsModalOpen(false)
        loadProducts()
      } else {
        setError(result.error || 'Error al guardar')
      }
    } catch (err) {
      setError('Error de comunicación')
    }
  }

  const toggleStatus = async (id: number, currentStatus: number) => {
    try {
      // @ts-ignore
      await window.electron.ipcRenderer.invoke('toggle-product-status', {
        id,
        active: currentStatus === 1 ? 0 : 1
      })
      loadProducts()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="h-full flex flex-col bg-gray-100 p-6 overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Catálogo de Productos</h2>
          <p className="text-gray-500">Administra el menú y precios</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={onBack}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 font-medium transition-colors"
          >
            Volver
          </button>
          <button 
            onClick={handleOpenCreate}
            className="px-6 py-2 bg-orange-600 text-white rounded-xl hover:bg-orange-700 font-medium shadow-lg shadow-orange-200 transition-colors flex items-center gap-2"
          >
            <span>+</span> Nuevo Producto
          </button>
        </div>
      </div>

      {/* Grid de Productos */}
      <div className="flex-1 overflow-y-auto pr-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {products.map((prod) => (
            <div 
              key={prod.id} 
              className={`bg-white p-4 rounded-xl shadow-sm border-2 transition-all ${
                prod.active ? 'border-transparent hover:border-orange-200' : 'border-gray-100 opacity-60 bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="font-bold text-gray-400 text-xs">#{prod.id}</div>
                <div className={`w-3 h-3 rounded-full ${prod.active ? 'bg-green-500' : 'bg-red-400'}`} />
              </div>
              
              <h3 className="font-bold text-lg text-gray-800 mb-1 truncate" title={prod.nombre}>
                {prod.nombre}
              </h3>
              <div className="text-2xl font-bold text-orange-600 mb-4">
                ${prod.precio.toFixed(2)}
              </div>

              <div className="flex gap-2 mt-auto">
                <button 
                  onClick={() => handleOpenEdit(prod)}
                  className="flex-1 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 text-sm font-semibold"
                >
                  Editar
                </button>
                <button 
                  onClick={() => toggleStatus(prod.id, prod.active)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${
                    prod.active 
                      ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                      : 'bg-green-50 text-green-600 hover:bg-green-100'
                  }`}
                >
                  {prod.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Crear/Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-800">
                {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Nombre</label>
                <input 
                  autoFocus
                  type="text" 
                  value={formData.nombre}
                  onChange={e => setFormData({...formData, nombre: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                  placeholder="Ej. Pizza Peperoni"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Precio</label>
                <input 
                  type="number" 
                  step="0.50"
                  min="0"
                  value={formData.precio}
                  onChange={e => setFormData({...formData, precio: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                  placeholder="0.00"
                />
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-500 text-sm rounded-lg text-center font-medium">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3 bg-orange-600 text-white font-bold rounded-xl hover:bg-orange-700 shadow-lg shadow-orange-200 transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}