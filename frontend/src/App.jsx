//test
import { useEffect, useState } from 'react'

function App() {
  const [data, setData] = useState(null)

  useEffect(() => {
    fetch('http://127.0.0.1:8000/api/test')
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error("Koneksi gagal:", err))
  }, [])

  return (
    <div className="min-h-screen bg-pink-50 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold text-pink-600 mb-4">Lip Product ABSA</h1>
      <div className="bg-white p-6 rounded-xl shadow-md border border-pink-200">
        <p className="text-gray-700">Status Koneksi Backend:</p>
        {data ? (
          <span className="text-green-500 font-mono font-bold">{data.message}</span>
        ) : (
          <span className="text-red-500 font-mono">Menghubungkan ke API...</span>
        )}
      </div>
    </div>
  )
}

export default App