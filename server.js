const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASS = process.env.ADMIN_PASS || 'mysecret123';

const MONGODB_URI = process.env.MONGODB_URI || 
  'mongodb+srv://prime:mikejava@cluster0.pzdvmr9.mongodb.net/shopdb?retryWrites=true&w=majority';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Product Schema with images array
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  imageUrl: { type: String, trim: true }, // kept for backward compatibility
  images: { type: [String], default: [] }, // new array for multiple images
  category: { type: String, default: 'Phone', enum: ['Phone', 'Accessory', 'Tablet'] },
  createdAt: { type: Date, default: Date.now }
});

const Product = mongoose.model('Product', productSchema);

const adminAuth = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'];
  if (!adminKey || adminKey !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// ========== API Routes ==========

// Get all products (public)
app.get('/api/products', async (req, res) => {
  try {
    const { category } = req.query;
    const filter = category && category !== 'All' ? { category } : {};
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get distinct categories
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(['All', ...categories.sort()]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get shop settings
app.get('/api/settings', (req, res) => {
  res.json({ 
    phone: process.env.SHOP_PHONE || '919876543210',
    shopName: 'Mobile Hub'
  });
});

// Create product (admin)
app.post('/api/products', adminAuth, async (req, res) => {
  try {
    const { name, description, price, imageUrl, images, category } = req.body;
    if (!name || !description || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // If images array is provided, use it; otherwise fall back to single imageUrl
    const product = new Product({ 
      name, 
      description, 
      price, 
      imageUrl: imageUrl || (images && images[0]) || '',
      images: images || (imageUrl ? [imageUrl] : []),
      category 
    });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product (admin)
app.put('/api/products/:id', adminAuth, async (req, res) => {
  try {
    const { name, description, price, imageUrl, images, category } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    const updateData = { name, description, price, category };
    if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
    if (images !== undefined) updateData.images = images;
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    if (!updatedProduct) return res.status(404).json({ error: 'Product not found' });
    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete product (admin)
app.delete('/api/products/:id', adminAuth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    const deletedProduct = await Product.findByIdAndDelete(req.params.id);
    if (!deletedProduct) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'main.html'));
});
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-panel.html'));
});
app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
