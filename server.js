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

// Product Schema
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  imageUrl: { type: String, trim: true },
  images: { type: [String], default: [] },
  category: { type: String, default: 'Phone', enum: ['Phone', 'Accessory', 'Tablet'] },
  createdAt: { type: Date, default: Date.now }
});
const Product = mongoose.model('Product', productSchema);

// Settings Schema (singleton)
const settingsSchema = new mongoose.Schema({
  isOpen: { type: Boolean, default: true },
  phone: { type: String, default: '0962577855' },
  shopName: { type: String, default: 'Prime Mobile' }
});
const Settings = mongoose.model('Settings', settingsSchema);

// Initialize default settings if not exists
async function initSettings() {
  const count = await Settings.countDocuments();
  if (count === 0) {
    await Settings.create({ isOpen: true, phone: '0962577855', shopName: 'Prime Mobile' });
    console.log('✅ Default settings created');
  }
}
initSettings();

// Admin Auth Middleware
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

// Get categories (public)
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Product.distinct('category');
    res.json(['All', ...categories.sort()]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get settings (public)
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await Settings.findOne();
    res.json(settings || { isOpen: true, phone: '0962577855', shopName: 'Prime Mobile' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update settings (admin only)
app.put('/api/settings', adminAuth, async (req, res) => {
  try {
    const { isOpen, phone, shopName } = req.body;
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    if (isOpen !== undefined) settings.isOpen = isOpen;
    if (phone !== undefined) settings.phone = phone;
    if (shopName !== undefined) settings.shopName = shopName;
    await settings.save();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Product CRUD (admin only)
app.post('/api/products', adminAuth, async (req, res) => {
  try {
    const { name, description, price, images, category } = req.body;
    if (!name || !description || !price) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const product = new Product({
      name,
      description,
      price,
      images: images || [],
      category
    });
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', adminAuth, async (req, res) => {
  try {
    const { name, description, price, images, category } = req.body;
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { name, description, price, images, category },
      { new: true, runValidators: true }
    );
    if (!updatedProduct) return res.status(404).json({ error: 'Product not found' });
    res.json(updatedProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
