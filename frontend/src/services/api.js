import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 900000, // 15 menit — produk dengan review sangat banyak butuh waktu lama
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
 * @param {string} id - MongoDB _id
 */
export const getProductById = async (id) => {
    const res = await api.get(`/api/products/${id}`)
    return res.data
}

/**
 * Trigger scraping + inference untuk produk baru via URL
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
 * Komparasi 2 produk — backend cek cache masing-masing
 * @param {string} id1 - MongoDB _id produk pertama
 * @param {string} id2 - MongoDB _id produk kedua
 */
export const compareProducts = async (id1, id2) => {
    const res = await api.post('/api/compare', { id1, id2 })
    return res.data // returns { product1: {...}, product2: {...} }
}

/**
 * Search produk dari database by nama atau brand
 * @param {string} query - nama produk / brand
 */
export const searchProducts = async (query) => {
    const res = await api.get('/api/products/search', { params: { q: query } })
    return res.data
}

// ─────────────────────────────────────────────
// POLLING · Scrape Status
// ─────────────────────────────────────────────

/**
 * Cek status scraping untuk URL tertentu (satu kali)
 * @param {string} url - URL produk yang sedang di-scrape
 * @returns {{ status: 'running'|'done'|'error'|'idle', product_id?: string, error?: string }}
 */
export const checkScrapeStatus = async (url) => {
    const res = await api.get('/api/scrape/status', { params: { url } })
    return res.data
}

/**
 * Polling status scraping setiap intervalMs milidetik hingga done/error/dibatalkan.
 *
 * @param {string}   url         - URL produk
 * @param {Function} onUpdate    - Callback dipanggil setiap tick: ({ status, product_id, error, elapsed })
 * @param {AbortSignal} signal   - AbortSignal untuk membatalkan polling dari luar
 * @param {number}   intervalMs  - Interval antar poll (default 5 detik)
 * @returns {Promise<{ product_id: string }|null>} - product_id saat done, atau null saat dibatalkan
 */
export const pollScrapeStatus = async (url, onUpdate, signal, intervalMs = 5000) => {
    const startTime = Date.now()

    const wait = (ms) => new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, ms)
        if (signal) {
            signal.addEventListener('abort', () => {
                clearTimeout(timeout)
                reject(new DOMException('Polling dibatalkan', 'AbortError'))
            }, { once: true })
        }
    })

    while (true) {
        if (signal?.aborted) return null

        try {
            const statusData = await checkScrapeStatus(url)
            const elapsed = Math.floor((Date.now() - startTime) / 1000)

            onUpdate({ ...statusData, elapsed })

            if (statusData.status === 'done') {
                return { product_id: statusData.product_id }
            }

            if (statusData.status === 'error') {
                throw new Error(statusData.error || 'Terjadi kesalahan saat scraping.')
            }

            // status === 'running' atau 'idle' → tunggu lalu poll lagi
            await wait(intervalMs)
        } catch (err) {
            if (err.name === 'AbortError') return null
            throw err
        }
    }
}