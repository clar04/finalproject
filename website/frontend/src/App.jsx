import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CompareProvider } from './context/CompareContext'

import Home from './pages/Home'
import ProductDetail from './pages/ProductDetail'
import Compare from './pages/Compare'

function App() {
  return (
    <CompareProvider>
      <BrowserRouter>
        <Routes>
          {/* Page 2 · Recommendation */}
          <Route path="/" element={<Home />} />

          {/* Page 3 · Product Detail */}
          <Route path="/product/:id" element={<ProductDetail />} />

          {/* Page 1 · Product Comparison */}
          <Route path="/compare" element={<Compare />} />
        </Routes>
      </BrowserRouter>
    </CompareProvider>
  )
}

export default App