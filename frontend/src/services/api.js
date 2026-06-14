import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

const api = axios.create({
    baseURL: BASE_URL,
    timeout: 900000, // 15 menit — produk dengan review sangat banyak butuh waktu lama
})

// ─────────────────────────────────────────────
// LOCAL STORAGE CACHE HELPER
// ─────────────────────────────────────────────

const CACHE_KEY     = 'lipsense_products_v1'
const CACHE_TTL_MS  = 5 * 60 * 1000   // 5 menit

/**
 * Simpan data ke localStorage dengan timestamp kedaluwarsa.
 */
function cacheSet(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, expiresAt: Date.now() + CACHE_TTL_MS }))
    } catch {
        // localStorage penuh atau diblokir browser — abaikan
    }
}

/**
 * Ambil data dari localStorage. Kembalikan null jika belum ada atau sudah expired.
 */
function cacheGet(key) {
    try {
        const raw = localStorage.getItem(key)
        if (!raw) return null
        const { data, expiresAt } = JSON.parse(raw)
        if (Date.now() > expiresAt) {
            localStorage.removeItem(key)
            return null
        }
        return data
    } catch {
        return null
    }
}

/**
 * Hapus cache produk — dipanggil setelah scrape berhasil agar
 * katalog langsung menampilkan produk baru saat user kembali ke Home.
 */
export function invalidateProductsCache() {
    try { localStorage.removeItem(CACHE_KEY) } catch { /* ignore */ }
}

// ─────────────────────────────────────────────
// PAGE 2 · Recommendation
// ─────────────────────────────────────────────

/**
 * Ambil semua produk dari MongoDB.
 * - Cek localStorage dulu (TTL 5 menit)
 * - Jika cache miss atau expired, fetch dari API lalu simpan ke cache
 */
export const getAllProducts = async () => {
    // 1. Coba ambil dari cache
    const cached = cacheGet(CACHE_KEY)
    if (cached) {
        return cached
    }

    // 2. Cache miss → fetch dari API
    const res = await api.get('/api/products')
    const raw = res.data
    let products = []
    if (Array.isArray(raw)) {
        products = raw
    } else if (Array.isArray(raw?.products)) {
        products = raw.products
    } else {
        console.warn('[api] getAllProducts: unexpected shape', raw)
    }

    // 3. Simpan ke cache
    cacheSet(CACHE_KEY, products)
    return products
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
 * Trigger scraping + inference untuk produk baru via URL.
 * Setelah berhasil, cache katalog dihapus agar Home langsung
 * menampilkan produk baru saat user kembali ke halaman utama.
 * @param {string} url - URL femaledaily produk
 */
export const scrapeProduct = async (url) => {
    const res = await api.post('/api/scrape', { url })
    invalidateProductsCache()   // ← cache bust supaya Home fetch ulang
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
    // Berapa kali berturut-turut gagal koneksi ke /scrape/status
    let networkErrorStreak = 0
    const MAX_NETWORK_ERRORS = 5

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
            networkErrorStreak = 0  // reset streak setelah berhasil
            const elapsed = Math.floor((Date.now() - startTime) / 1000)

            onUpdate({ ...statusData, elapsed })

            if (statusData.status === 'done') {
                invalidateProductsCache()   // ← produk baru masuk DB, bust cache katalog
                return { product_id: statusData.product_id }
            }

            if (statusData.status === 'error') {
                // Error nyata dari backend scraping — tandai agar UI bisa bedakan
                const scrapeErr = new Error(statusData.error || 'Terjadi kesalahan saat scraping di server.')
                scrapeErr.isScrapeError = true
                throw scrapeErr
            }

            // status === 'running' atau 'idle' → tunggu lalu poll lagi
            await wait(intervalMs)
        } catch (err) {
            if (err.name === 'AbortError') return null
            if (err.isScrapeError) throw err  // propagate error scraping langsung

            // Network error saat polling → coba lagi sampai MAX_NETWORK_ERRORS
            networkErrorStreak++
            console.warn(`[pollScrapeStatus] Network error (${networkErrorStreak}/${MAX_NETWORK_ERRORS}):`, err.message)
            if (networkErrorStreak >= MAX_NETWORK_ERRORS) throw err
            await wait(intervalMs)
        }
    }
}