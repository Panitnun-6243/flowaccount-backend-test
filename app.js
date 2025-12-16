const express = require('express')
const app = express()
const PORT = 3000

app.use(express.json())

// ========== DATA STORAGE ==========
let products = []
let nextId = 1

const VALID_CATEGORIES = ['อาหาร', 'เครื่องดื่ม', 'ของใช้', 'เสื้อผ้า']

// ========== VALIDATION ==========
function validateProduct(data, existingProducts = []) {
  const errors = []

  if (!data.name || data.name.trim() === '') {
    errors.push('ชื่อสินค้าต้องไม่ว่าง')
  }

  if (!data.sku || data.sku.trim() === '') {
    errors.push('รหัสสินค้าต้องไม่ว่าง')
  } else if (data.sku.length < 3) {
    errors.push('รหัสสินค้าต้องมีอย่างน้อย 3 ตัวอักษร')
  } else if (existingProducts.some((p) => p.sku === data.sku)) {
    errors.push('รหัสสินค้านี้มีอยู่แล้วในระบบ')
  }

  if (data.price === undefined || data.price === null) {
    errors.push('ราคาต้องไม่ว่าง')
  } else if (typeof data.price !== 'number' || data.price <= 0) {
    errors.push('ราคาต้องมากกว่า 0')
  }

  if (data.stock === undefined || data.stock === null) {
    errors.push('จำนวนคงเหลือต้องไม่ว่าง')
  } else if (typeof data.stock !== 'number' || data.stock < 0) {
    errors.push('จำนวนคงเหลือต้องไม่ติดลบ')
  }

  if (!data.category || !VALID_CATEGORIES.includes(data.category)) {
    errors.push(`หมวดหมู่ต้องเป็น 1 ใน: ${VALID_CATEGORIES.join(', ')}`)
  }

  return errors
}

// ========== ROUTES ==========

// Health Check
app.get('/', (req, res) => {
  res.json({
    message: 'Product Management API',
    endpoints: {
      createProduct: 'POST /api/products',
      getProducts: 'GET /api/products',
      getProductsByCategory: 'GET /api/products?category=อาหาร',
      sellProduct: 'POST /api/products/sell',
      searchProducts: 'GET /api/products/search?keyword=ข้าว',
      bulkUpdatePrice: 'PUT /api/products/bulk-price-update',
    },
  })
})

// Challenge 1: เพิ่มสินค้าใหม่
app.post('/api/products', (req, res) => {
  const errors = validateProduct(req.body, products)

  if (errors.length > 0) {
    return res.status(400).json({ errors })
  }

  const product = {
    id: nextId++,
    name: req.body.name,
    sku: req.body.sku,
    price: req.body.price,
    stock: req.body.stock,
    category: req.body.category,
    createdAt: new Date().toISOString(),
  }

  products.push(product)
  res.status(201).json(product)
})

// Challenge 2: ดึงรายการสินค้า
app.get('/api/products', (req, res) => {
  const { category } = req.query

  if (category) {
    const filtered = products.filter((p) => p.category === category)
    return res.json(filtered)
  }

  res.json(products)
})

// Challenge 3: ขายสินค้า (ตัดสต็อก)
app.post('/api/products/sell', (req, res) => {
  const { productId, quantity } = req.body
  const errors = []

  // Validate quantity
  if (!quantity || typeof quantity !== 'number' || quantity <= 0) {
    errors.push('quantity ต้องมากกว่า 0')
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors })
  }

  // ค้นหาสินค้า
  const product = products.find((p) => p.id === productId)
  if (!product) {
    return res.status(400).json({ errors: ['ไม่พบสินค้าในระบบ'] })
  }

  // ตรวจสอบสต็อก
  if (product.stock < quantity) {
    return res.status(400).json({
      errors: [`สต็อกไม่เพียงพอ (มีเพียง ${product.stock} ชิ้น)`],
    })
  }

  // ตัดสต็อก
  product.stock -= quantity

  res.json({
    product,
    soldQuantity: quantity,
    remainingStock: product.stock,
  })
})

// Challenge 4: ค้นหาสินค้า
app.get('/api/products/search', (req, res) => {
  const { keyword } = req.query

  if (!keyword || keyword.trim() === '') {
    return res.status(400).json({ errors: ['กรุณาระบุคำค้นหา'] })
  }

  const lowerKeyword = keyword.toLowerCase()
  const results = products.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerKeyword) ||
      p.sku.toLowerCase().includes(lowerKeyword)
  )

  res.json(results)
})

// Challenge 5: อัพเดทราคาเป็นชุด
app.put('/api/products/bulk-price-update', (req, res) => {
  const { updates } = req.body

  if (!updates || !Array.isArray(updates)) {
    return res.status(400).json({ errors: ['updates ต้องเป็น array'] })
  }

  let successCount = 0
  let failCount = 0
  const results = []

  updates.forEach((item) => {
    const product = products.find((p) => p.id === item.productId)

    if (product && item.newPrice > 0) {
      product.price = item.newPrice
      successCount++
      results.push({
        productId: item.productId,
        status: 'success',
        message: 'อัพเดทราคาสำเร็จ',
      })
    } else {
      failCount++
      results.push({
        productId: item.productId,
        status: 'failed',
        message: product ? 'ราคาไม่ถูกต้อง' : 'ไม่พบสินค้า',
      })
    }
  })

  res.json({
    summary: {
      total: updates.length,
      success: successCount,
      failed: failCount,
    },
    results,
  })
})

// Error Handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ errors: ['เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์'] })
})

// Start Server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║   Product Management API                      ║
║   Server running on http://localhost:${PORT}    ║
╚═══════════════════════════════════════════════╝

API Endpoints:
  POST   /api/products                    - เพิ่มสินค้า
  GET    /api/products                    - ดึงสินค้าทั้งหมด
  GET    /api/products?category=อาหาร    - ดึงตามหมวดหมู่
  POST   /api/products/sell               - ขายสินค้า
  GET    /api/products/search?keyword=x   - ค้นหาสินค้า
  PUT    /api/products/bulk-price-update  - อัพเดทราคาชุด
  `);
});
