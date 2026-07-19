import { createContext, useContext, useState } from 'react'

const CompareContext = createContext(null)

export function CompareProvider({ children }) {
  // Menyimpan array of product object, max 2
  const [compareList, setCompareList] = useState([])

  // Tambah produk ke compare list (max 2)
  const addToCompare = (product) => {
    setCompareList(prev => {
      // Kalau sudah ada, jangan duplikat
      if (prev.find(p => p._id === product._id)) return prev
      // Kalau sudah 2, ganti yang pertama
      if (prev.length >= 2) return [prev[1], product]
      return [...prev, product]
    })
  }

  // Hapus produk dari compare list by id
  const removeFromCompare = (productId) => {
    setCompareList(prev => prev.filter(p => p._id !== productId))
  }

  // Reset compare list
  const clearCompare = () => setCompareList([])

  // Cek apakah produk sudah ada di list
  const isInCompare = (productId) => {
    return compareList.some(p => p._id === productId)
  }

  return (
    <CompareContext.Provider value={{
      compareList,
      addToCompare,
      removeFromCompare,
      clearCompare,
      isInCompare,
    }}>
      {children}
    </CompareContext.Provider>
  )
}

// Custom hook biar gampang dipakai di komponen manapun
export function useCompare() {
  const context = useContext(CompareContext)
  if (!context) {
    throw new Error('useCompare harus dipakai di dalam CompareProvider')
  }
  return context
}