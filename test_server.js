#!/usr/bin/env node

// Direct API Testing without Vercel
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = 3001;

// Test CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-merchant-id']
}));

// Test rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Test validation functions
function validatePhoneNumber(phone) {
  if (!phone) return false;
  const phoneRegex = /^\+1[2-9]\d{2}[2-9]\d{6}$/;
  return phoneRegex.test(phone);
}

function validateEmail(email) {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validateCardholderName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 50 && /^[a-zA-Z\s\-'\.]+$/.test(trimmed);
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return input.trim().replace(/[<>]/g, '');
}

// Test endpoints
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    security: 'ENHANCED'
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    appId: 'test_app_id',
    locationId: 'test_location_id',
    isSquareProduction: false,
    security: 'ENHANCED'
  });
});

app.post('/api/customers', (req, res) => {
  const { givenName, familyName, emailAddress, phoneNumber } = req.body || {};
  
  // Test validation
  const sanitizedGivenName = sanitizeInput(givenName);
  const sanitizedFamilyName = sanitizeInput(familyName);
  const sanitizedEmail = emailAddress ? sanitizeInput(emailAddress) : null;
  const sanitizedPhone = phoneNumber ? sanitizeInput(phoneNumber) : null;
  
  // Validation checks
  if (!sanitizedGivenName || !sanitizedFamilyName) {
    return res.status(400).json({ error: "givenName and familyName are required" });
  }
  
  if (!validateCardholderName(sanitizedGivenName)) {
    return res.status(400).json({ error: "Invalid givenName format" });
  }
  
  if (!validateCardholderName(sanitizedFamilyName)) {
    return res.status(400).json({ error: "Invalid familyName format" });
  }
  
  if (sanitizedEmail && !validateEmail(sanitizedEmail)) {
    return res.status(400).json({ error: "Invalid email format" });
  }
  
  if (sanitizedPhone && !validatePhoneNumber(sanitizedPhone)) {
    return res.status(400).json({ error: "Invalid phone number format. Please use +1XXXXXXXXXX format" });
  }
  
  res.json({
    success: true,
    message: "Customer validation passed",
    data: {
      givenName: sanitizedGivenName,
      familyName: sanitizedFamilyName,
      emailAddress: sanitizedEmail,
      phoneNumber: sanitizedPhone
    }
  });
});

app.post('/api/cards', (req, res) => {
  const { sourceId, customerId, cardholderName } = req.body || {};
  
  if (!sourceId || !customerId) {
    return res.status(400).json({ 
      error: "sourceId and customerId are required"
    });
  }
  
  const sanitizedCardholderName = sanitizeInput(cardholderName);
  
  if (!sanitizedCardholderName || sanitizedCardholderName.length === 0) {
    return res.status(400).json({ 
      error: "cardholderName is required and cannot be empty"
    });
  }
  
  if (!validateCardholderName(sanitizedCardholderName)) {
    return res.status(400).json({ 
      error: "Invalid cardholder name format. Only letters, spaces, hyphens, apostrophes, and periods are allowed"
    });
  }
  
  res.json({
    success: true,
    message: "Card validation passed",
    data: {
      sourceIdLength: sourceId.length,
      customerIdLength: customerId.length,
      cardholderName: sanitizedCardholderName
    }
  });
});

// Error handling test
app.get('/test-error', (req, res) => {
  try {
    throw new Error('Test error for security testing');
  } catch (error) {
    console.error("Test error:", error.message);
    
    const errorResponse = {
      error: "Test failed. Please try again.",
      code: "TEST_ERROR"
    };
    
    console.error("Detailed error:", {
      message: error.message,
      type: error.constructor.name,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json(errorResponse);
  }
});

app.listen(PORT, () => {
  console.log(`🧪 Test server running on http://localhost:${PORT}`);
  console.log('📋 Available endpoints:');
  console.log('   GET  /health');
  console.log('   GET  /api/config');
  console.log('   POST /api/customers');
  console.log('   POST /api/cards');
  console.log('   GET  /test-error');
  console.log('\n🔒 Security features active:');
  console.log('   ✅ CORS protection');
  console.log('   ✅ Rate limiting');
  console.log('   ✅ Input validation');
  console.log('   ✅ Input sanitization');
  console.log('   ✅ Secure error handling');
});
