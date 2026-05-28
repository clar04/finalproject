import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 300000, // 5 menit (300 detik) — scraping & AI processing butuh waktu lama untuk ratusan review
})

// ─────────────────────────────────────────────
// PAGE 2 · Recommendation
// ─────────────────────────────────────────────

/**
 * Ambil semua produk yang sudah di-cache di MongoDB
 * Dipakai di Home.jsx (Page 2) — display only
 */
export const getAllProducts = async () => {
    const res = await api.get('/api/products')
    const raw = res.data
    // Backend returns { products: [...] } — always coerce to array
    if (Array.isArray(raw)) return raw
    if (Array.isArray(raw?.products)) return raw.products
    console.warn('[api] getAllProducts: unexpected shape', raw)
    return []
}

// ─────────────────────────────────────────────
// PAGE 3 · Product Detail
// ─────────────────────────────────────────────

/**
 * Ambil detail satu produk by MongoDB document ID
 * Backend akan cek cache dulu, kalau miss → scrape → infer → simpan
 * @param {string} id - MongoDB _id
 */
export const getProductById = async (id) => {
    const res = await api.get(`/api/products/${id}`)
    return res.data
}

/**
 * Trigger scraping + inference untuk produk baru via URL
 * Dipakai di Navbar search (Page 3 entry point baru)
 * @param {string} url - URL femaledaily produk
 */
export const scrapeProduct = async (url) => {
    const res = await api.post('/api/scrape', { url })
    return res.data // returns { _id, ...productData }
}

// ─────────────────────────────────────────────
// PAGE 1 · Product Comparison
// ─────────────────────────────────────────────

/**
 * Komparasi 2 produk — backend cek cache masing-masing,
 * scrape+infer kalau belum ada, lalu return hasil keduanya
 * @param {string} id1 - MongoDB _id produk pertama
 * @param {string} id2 - MongoDB _id produk kedua
 */
export const compareProducts = async (id1, id2) => {
    const res = await api.post('/api/compare', { id1, id2 })
    return res.data // returns { product1: {...}, product2: {...} }
}

/**
 * Search produk dari database by nama atau brand
 * Dipakai di ProductSelector (Page 1)
 * @param {string} query - nama produk / brand
 */
export const searchProducts = async (query) => {
    const res = await api.get('/api/products/search', { params: { q: query } })
    return res.data
}