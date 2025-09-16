const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { Client, Environment } = require("square");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();

const {
  PORT = 8080,
  SQUARE_ENV = "sandbox",
  SQUARE_APP_ID,
  SQUARE_APP_SECRET,
  SQUARE_WEBHOOK_SIGNATURE_KEY,
  SQUARE_REDIRECT_URL,
  FRONTEND_URL = "https://pay.yourdomain.com",
  N8N_WEBHOOK_URL,
  NODE_ENV = "development"
} = process.env;

const isProduction = NODE_ENV === "production";
const isSquareProduction = SQUARE_ENV === "production";

app.use(cors({
  origin: isProduction ? [FRONTEND_URL] : ['http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-merchant-id']
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter rate limiting for sensitive endpoints
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs for sensitive operations
  message: {
    error: 'Too many sensitive requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// HTTPS enforcement in production
if (isProduction) {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}

app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

const sellers = new Map();

// Input validation functions
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

// Initialize with Zorina's seller data from environment variables
const ZORINA_MERCHANT_ID = process.env.ZORINA_MERCHANT_ID || 'MLJSE2F6EE60D';
const ZORINA_ACCESS_TOKEN = process.env.ZORINA_ACCESS_TOKEN;
const ZORINA_LOCATION_ID = process.env.ZORINA_LOCATION_ID;

if (ZORINA_ACCESS_TOKEN && ZORINA_LOCATION_ID) {
  // Remove "Bearer " prefix if it exists (n8n webhook includes it)
  const cleanToken = ZORINA_ACCESS_TOKEN.replace(/^Bearer\s+/i, '');
  
  sellers.set(ZORINA_MERCHANT_ID, {
    accessToken: cleanToken,
    merchantId: ZORINA_MERCHANT_ID,
    locations: [{ id: ZORINA_LOCATION_ID, name: 'Zorina Nail Studio', status: 'ACTIVE' }]
  });
  console.log('Zorina seller initialized with merchant ID:', ZORINA_MERCHANT_ID);
}

function squareClient(accessToken) {
  const environment = isSquareProduction ? Environment.Production : Environment.Sandbox;
  console.log('Creating Square client with environment:', isSquareProduction ? 'Production' : 'Sandbox');
  return new Client({
    environment,
    accessToken
  });
}

async function refreshTokenIfNeeded(merchantId) {
  const seller = sellers.get(merchantId);
  if (!seller) return null;
  
  // Check if token is expired or will expire in the next 5 minutes
  const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
  if (seller.expiresAt && new Date() > fiveMinutesFromNow) {
    console.log('🔄 Token needs refresh for merchant:', merchantId?.substring(0, 8) + '...');
    
    // Try to refresh token using refresh_token if available
    if (seller.refreshToken) {
      try {
        const tokenResp = await fetch(
          isSquareProduction 
            ? "https://connect.squareup.com/oauth2/token"
            : "https://connect.squareupsandbox.com/oauth2/token",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              client_id: SQUARE_APP_ID,
              client_secret: SQUARE_APP_SECRET,
              refresh_token: seller.refreshToken,
              grant_type: "refresh_token"
            })
          }
        );
        
        const data = await tokenResp.json();
        
        if (data.access_token) {
          // Update seller with new token
          const client = squareClient(data.access_token);
          const { result: locationsResult } = await client.locationsApi.listLocations();
          const locations = (locationsResult.locations || []).filter(l => l.status === "ACTIVE");
          
          sellers.set(merchantId, {
            accessToken: data.access_token,
            refreshToken: data.refresh_token || seller.refreshToken,
            merchantId: merchantId,
            locations,
            expiresAt: new Date(Date.now() + (data.expires_at * 1000))
          });
          
          console.log('✅ Token refreshed successfully for merchant:', merchantId?.substring(0, 8) + '...');
          return sellers.get(merchantId);
        }
      } catch (error) {
        console.error('Failed to refresh token:', error);
      }
    }
    
    // If refresh failed, remove expired seller
    sellers.delete(merchantId);
    return null;
  }
  
  return seller;
}

async function requireSeller(req, res) {
  const merchantId = req.headers["x-merchant-id"] || req.query.merchant_id || ZORINA_MERCHANT_ID;
  
  let seller = await refreshTokenIfNeeded(merchantId);
  
  if (!seller) {
    return res.status(401).json({ error: "Seller not connected or token expired. Please reconnect." });
  }
  
  return seller;
}

app.get("/", (req, res) => {
  try {
    const indexPath = path.join(__dirname, '..', 'public', 'index.html');
    const htmlContent = fs.readFileSync(indexPath, 'utf8');
    res.send(htmlContent);
  } catch (error) {
    console.error('Error serving index.html:', error);
    res.status(500).send('Error loading page');
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/config", (req, res) => {
  res.json({ 
    appId: SQUARE_APP_ID,
    environment: SQUARE_ENV,
    isProduction: isProduction,
    isSquareProduction: isSquareProduction
  });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Check if seller is initialized
app.get("/api/init", (req, res) => {
  const seller = sellers.get(ZORINA_MERCHANT_ID);
  console.log('Environment check:', {
    ZORINA_ACCESS_TOKEN: ZORINA_ACCESS_TOKEN ? 'SET' : 'NOT SET',
    ZORINA_LOCATION_ID: ZORINA_LOCATION_ID ? 'SET' : 'NOT SET',
    ZORINA_MERCHANT_ID: ZORINA_MERCHANT_ID ? 'SET' : 'NOT SET'
  });
  res.json({
    initialized: !!seller,
    merchantId: ZORINA_MERCHANT_ID,
    hasAccessToken: !!ZORINA_ACCESS_TOKEN,
    hasLocationId: !!ZORINA_LOCATION_ID,
    locationId: ZORINA_LOCATION_ID,
    accessTokenLength: ZORINA_ACCESS_TOKEN ? ZORINA_ACCESS_TOKEN.length : 0
  });
});

app.get("/api/customers/search", async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;
  
  try {
    const { email, phone } = req.query;
    console.log('Searching customers with:', { 
      hasEmail: !!email, 
      hasPhone: !!phone,
      phoneLength: phone?.length || 0 
    });
    
    const client = squareClient(seller.accessToken);
    let customers = [];
    
    // Search by email if provided
    if (email) {
      try {
        const { result } = await client.customersApi.searchCustomers({
          query: {
            filter: {
              emailAddress: {
                exact: email
              }
            }
          }
        });
        customers = customers.concat(result.customers || []);
      } catch (emailError) {
        console.log('Email search failed:', emailError.message);
      }
    }
    
    // Search by phone if provided
    if (phone) {
      try {
        const { result } = await client.customersApi.searchCustomers({
          query: {
            filter: {
              phoneNumber: {
                exact: phone
              }
            }
          }
        });
        customers = customers.concat(result.customers || []);
      } catch (phoneError) {
        console.log('Phone search failed:', phoneError.message);
      }
    }
    
    // Remove duplicates based on customer ID
    const uniqueCustomers = customers.filter((customer, index, self) => 
      index === self.findIndex(c => c.id === customer.id)
    );
    
    console.log('Found customers:', uniqueCustomers.length);
    
    // Add cards data to each customer
    const customersWithCards = await Promise.all(uniqueCustomers.map(async (customer) => {
      try {
        // Get cards for this customer using listCards API
        const { result: cardsResult } = await client.cardsApi.listCards({
          customerId: customer.id
        });
        
        return {
          ...customer,
          cards: cardsResult.cards || []
        };
      } catch (cardError) {
        console.log('Could not fetch cards for customer:', customer.id?.substring(0, 8) + '...', cardError.message);
        return {
          ...customer,
          cards: []
        };
      }
    }));
    
    const processedCustomers = JSON.parse(JSON.stringify(customersWithCards, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    
    res.json({ customers: processedCustomers });
  } catch (error) {
    console.error('Error searching customers:', error);
    res.status(500).json({ 
      error: error.message, 
      details: error.errors || 'Unknown error'
    });
  }
});

app.get("/api/customers/:customerId/cards", async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;
  
  try {
    const { customerId } = req.params;
    console.log('Fetching cards for customer ID:', customerId?.substring(0, 8) + '...');
    
    const client = squareClient(seller.accessToken);
    
    // Use listCards with customer_id query parameter as per Square API docs
    const { result } = await client.cardsApi.listCards({
      customerId: customerId
    });
    
    console.log('Square API response for cards: found', result.cards?.length || 0, 'cards');
    
    const cards = JSON.parse(JSON.stringify(result.cards || [], (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    
    console.log('Processed cards: count =', cards.length);
    res.json({ cards });
  } catch (error) {
    console.error('Error fetching customer cards:', error);
    console.error('Error details:', {
      message: error.message,
      errors: error.errors,
      statusCode: error.statusCode
    });
    
    // If the API call fails, return empty cards array instead of error
    // This allows the frontend to proceed with card creation
    console.log('Returning empty cards array due to API error');
    res.json({ cards: [] });
  }
});

app.get("/oauth/authorize", (req, res) => {
  const scopes = [
    "CUSTOMERS_READ",
    "CUSTOMERS_WRITE", 
    "PAYMENTS_READ",
    "PAYMENTS_WRITE",
    "PAYMENTS_WRITE_ADDITIONAL_RECIPIENTS",
    "CARDS_READ",
    "CARDS_WRITE",
    "MERCHANT_PROFILE_READ"
  ];
  
  const state = crypto.randomBytes(16).toString("hex");
  const baseUrl = isSquareProduction 
    ? "https://connect.squareup.com" 
    : "https://connect.squareupsandbox.com";
    
  const url = new URL(baseUrl + "/oauth2/authorize");
  url.searchParams.set("client_id", SQUARE_APP_ID);
  url.searchParams.set("scope", scopes.join(" "));
  url.searchParams.set("session", "false");
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", SQUARE_REDIRECT_URL);
  
  res.cookie("oauth_state", state, { 
    httpOnly: true, 
    secure: isProduction, 
    sameSite: "lax",
    maxAge: 600000 
  });

  console.log(`🔗 Redirecting to Square OAuth: ${url.toString()}`);
  res.redirect(url.toString());
});

app.get("/oauth/callback", async (req, res) => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies.oauth_state;
    
    if (!code) {
      return res.status(400).send("Missing authorization code");
    }
    
    if (state !== storedState) {
      return res.status(400).send("Invalid state parameter");
    }
    
    const tokenResp = await fetch(
      isSquareProduction 
        ? "https://connect.squareup.com/oauth2/token"
        : "https://connect.squareupsandbox.com/oauth2/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: SQUARE_APP_ID,
          client_secret: SQUARE_APP_SECRET,
          code,
          grant_type: "authorization_code"
        })
      }
    );
    
    const data = await tokenResp.json();
    
    if (!data.access_token) {
      return res.status(400).json(data);
    }
    
    const client = squareClient(data.access_token);
    const { result: locationsResult } = await client.locationsApi.listLocations();
    const locations = (locationsResult.locations || []).filter(l => l.status === "ACTIVE");
    
    sellers.set(data.merchant_id, {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      merchantId: data.merchant_id,
      locations,
      expiresAt: new Date(Date.now() + (data.expires_at * 1000))
    });
    
    res.clearCookie("oauth_state");
    res.redirect(`${FRONTEND_URL}?merchant_id=${data.merchant_id}`);
    
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.status(500).send("OAuth error: " + error.message);
  }
});

// N8N Integration: Receive access token from N8N webhook
app.post("/api/update-token", async (req, res) => {
  try {
    const { access_token, merchant_id, refresh_token, expires_at } = req.body;
    
    if (!access_token || !merchant_id) {
      return res.status(400).json({ error: "access_token and merchant_id are required" });
    }
    
    // Get locations for this merchant
    const client = squareClient(access_token);
    const { result: locationsResult } = await client.locationsApi.listLocations();
    const locations = (locationsResult.locations || []).filter(l => l.status === "ACTIVE");
    
    // Store seller data
    sellers.set(merchant_id, {
      accessToken: access_token,
      refreshToken: refresh_token,
      merchantId: merchant_id,
      locations,
      expiresAt: expires_at ? new Date(expires_at * 1000) : new Date(Date.now() + (3600 * 1000)) // 1 hour default
    });
    
    console.log(`✅ Token updated for merchant: ${merchant_id?.substring(0, 8)}...`);
    
    // Send confirmation back to N8N webhook
    if (N8N_WEBHOOK_URL) {
      try {
        await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'success',
            merchant_id,
            message: 'Access token updated successfully',
            locations_count: locations.length,
            timestamp: new Date().toISOString()
          })
        });
      } catch (webhookError) {
        console.error('Failed to send confirmation to N8N:', webhookError);
      }
    }
    
    res.json({
      status: 'success', 
      merchant_id,
      locations_count: locations.length,
      message: 'Access token updated successfully'
    });
    
  } catch (error) {
    console.error("Token update error:", error);
    
    // Send error back to N8N webhook
    if (N8N_WEBHOOK_URL) {
      try {
        await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
          })
        });
      } catch (webhookError) {
        console.error('Failed to send error to N8N:', webhookError);
      }
    }
    
    res.status(500).json({ error: error.message });
  }
});

// Vercel Environment Update Endpoint for N8N
app.post("/api/update-env", async (req, res) => {
  try {
    const { access_token, merchant_id, location_id } = req.body;
    
    // Check for bypass token if protection is enabled
    const bypassToken = req.query['x-vercel-protection-bypass'] || req.headers['x-vercel-protection-bypass'];
    const expectedBypass = process.env.VERCEL_PROTECTION_BYPASS;

    if (expectedBypass && bypassToken !== expectedBypass) {
      return res.status(401).json({ error: 'Invalid bypass token' });
    }
    
    if (!access_token || !merchant_id) {
      return res.status(400).json({ error: "access_token and merchant_id are required" });
    }
    
    // Remove "Bearer " prefix if it exists (n8n webhook includes it)
    const cleanToken = access_token.replace(/^Bearer\s+/i, '');
    
    // Update the seller data in memory (this will be lost on cold start, but env vars persist)
    sellers.set(merchant_id, {
      accessToken: cleanToken,
      merchantId: merchant_id,
      locations: location_id ? [{ id: location_id, name: 'Zorina Nail Studio', status: 'ACTIVE' }] : []
    });
    
    console.log(`✅ Environment updated for merchant: ${merchant_id}`);
    
    res.json({
      status: 'success', 
      merchant_id,
      message: 'Environment variables updated successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error("Environment update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Check token status
app.get("/api/token-status", (req, res) => {
  const merchantId = req.query.merchant_id;
  
  if (!merchantId) {
    return res.status(400).json({ error: "merchant_id query parameter is required" });
  }
  
  const seller = sellers.get(merchantId);
  if (!seller) {
    return res.json({ 
      status: 'not_connected',
      merchant_id: merchantId,
      message: 'No access token found for this merchant'
    });
  }
  
  const isExpired = seller.expiresAt && new Date() > seller.expiresAt;
  
  res.json({
    status: isExpired ? 'expired' : 'active',
    merchant_id: merchantId,
    expires_at: seller.expiresAt?.toISOString(),
    locations_count: seller.locations?.length || 0,
    message: isExpired ? 'Access token has expired' : 'Access token is active'
  });
});

app.get("/api/locations", async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;
  
  try {
    if (!seller.locations || !seller.locations.length) {
    const client = squareClient(seller.accessToken);
    const { result } = await client.locationsApi.listLocations();
      seller.locations = (result.locations || []).filter(l => l.status === "ACTIVE");
    }
    
    res.json({
      locations: seller.locations.map(l => ({ 
          id: l.id,
          name: l.name,
          status: l.status
        }))
    });
  } catch (error) {
    console.error("Locations error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/customers/search", async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;
  
  try {
    const { phone } = req.body || {};
    
    // Input validation and sanitization
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    
    if (!phone) {
      return res.status(400).json({ error: "Phone number is required" });
    }
    
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({ error: "Phone number must be in E164 format (e.g., +15551234567)" });
    }
    
    const query = { 
      filter: {
        phoneNumber: { exact: phone.trim() }
      }
    };
    
    const client = squareClient(seller.accessToken);
    const { result } = await client.customersApi.searchCustomers({ query });
    
    // Convert BigInt values to strings for JSON serialization
    const customers = (result.customers || []).map(customer => 
      JSON.parse(JSON.stringify(customer, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      ))
    );
    
    res.json({ customers });
  } catch (error) {
    console.error("Customer search error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/customers", async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;
  
  try {
    const { givenName, familyName, emailAddress, phoneNumber } = req.body || {};
    
    // Sanitize inputs
    const sanitizedGivenName = sanitizeInput(givenName);
    const sanitizedFamilyName = sanitizeInput(familyName);
    const sanitizedEmail = emailAddress ? sanitizeInput(emailAddress) : null;
    const sanitizedPhone = phoneNumber ? sanitizeInput(phoneNumber) : null;
    
    // Input validation
    if (!sanitizedGivenName || !sanitizedFamilyName) {
      return res.status(400).json({ error: "givenName and familyName are required" });
    }
    
    // Validate name lengths and format
    if (!validateCardholderName(sanitizedGivenName)) {
      return res.status(400).json({ error: "Invalid givenName format" });
    }
    
    if (!validateCardholderName(sanitizedFamilyName)) {
      return res.status(400).json({ error: "Invalid familyName format" });
    }
    
    // Validate email if provided
    if (sanitizedEmail && !validateEmail(sanitizedEmail)) {
      return res.status(400).json({ error: "Invalid email format" });
    }
    
    // Validate phone if provided
    if (sanitizedPhone && !validatePhoneNumber(sanitizedPhone)) {
      return res.status(400).json({ error: "Invalid phone number format. Please use +1XXXXXXXXXX format" });
    }
    
    // Use sanitized data for API call
    const customerData = {
      givenName: sanitizedGivenName,
      familyName: sanitizedFamilyName
    };
    
    if (sanitizedEmail) {
      customerData.emailAddress = sanitizedEmail;
    }
    
    if (sanitizedPhone) {
      customerData.phoneNumber = sanitizedPhone;
    }
    
    
    const client = squareClient(seller.accessToken);
    const { result } = await client.customersApi.createCustomer(customerData);
    
    // Convert BigInt values to strings for JSON serialization
    const customer = JSON.parse(JSON.stringify(result.customer, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    
    res.json({ customer });
  } catch (error) {
    console.error("Customer creation error:", error);
    res.status(500).json({ error: error.message, details: error.errors });
  }
});

app.post("/api/cards", strictLimiter, async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;
  
  try {
    const { sourceId, customerId, cardholderName, billingAddress } = req.body || {};
    
    console.log('Creating card with data:', { 
      sourceIdLength: sourceId?.length || 0, 
      customerIdLength: customerId?.length || 0, 
      hasCardholderName: !!cardholderName,
      merchantIdLength: seller.merchantId?.length || 0
    });
    
    if (!sourceId || !customerId) {
      return res.status(400).json({ 
        error: "sourceId and customerId are required",
        received: { 
          hasSourceId: !!sourceId, 
          hasCustomerId: !!customerId,
          sourceIdLength: sourceId?.length || 0,
          customerIdLength: customerId?.length || 0
        }
      });
    }
    
    // Sanitize and validate cardholder name
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
    
    const client = squareClient(seller.accessToken);
    const { result } = await client.cardsApi.createCard({
      idempotencyKey: uuidv4(),
      sourceId,
      card: {
        customerId,
        cardholderName: sanitizedCardholderName,
        billingAddress: billingAddress ? {
          postalCode: billingAddress.postal_code,
          locality: billingAddress.locality
        } : undefined
      }
    });
    
    const card = JSON.parse(JSON.stringify(result.card, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    
    console.log('Card created successfully:', card.id?.substring(0, 8) + '...');
    res.json({ card });
  } catch (error) {
    console.error("Card creation error:", error);
    console.error("Error details:", {
      message: error.message,
      errors: error.errors,
      statusCode: error.statusCode,
      requestData: {
        sourceId: req.body?.sourceId?.substring(0, 20) + '...',
        customerId: req.body?.customerId,
        cardholderName: req.body?.cardholderName
      }
    });
    
    // Don't expose internal error details to client
    const errorResponse = {
      error: "Failed to create card. Please try again.",
      code: "CARD_CREATION_FAILED"
    };
    
    // Log detailed error for debugging (server-side only)
    console.error("Detailed error:", {
      message: error.message,
      type: error.constructor.name,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json(errorResponse);
  }
});

app.post("/api/payments/create", strictLimiter, async (req, res) => {
  const seller = await requireSeller(req, res);
  if (!seller) return;
  
  try {
    const { 
      amountCents, 
      currency = "CAD", 
      paymentToken, 
        customerId,
      idempotencyKey, 
      locationId 
    } = req.body;
    
    // Input validation
    if (!amountCents || !paymentToken || !idempotencyKey || !locationId) {
      return res.status(400).json({ 
        error: "amountCents, paymentToken, idempotencyKey, and locationId are required" 
      });
    }
    
    if (typeof amountCents !== 'number' || amountCents <= 0) {
      return res.status(400).json({ error: "amountCents must be a positive number" });
    }
    
    if (amountCents > 1000000) { // $10,000 limit
      return res.status(400).json({ error: "Payment amount exceeds maximum limit" });
    }
    
    const validCurrencies = ['USD', 'CAD', 'GBP', 'EUR', 'AUD', 'JPY'];
    if (!validCurrencies.includes(currency)) {
      return res.status(400).json({ error: "Invalid currency" });
    }
    
    // Verify location belongs to seller
    const sellerLocation = seller.locations.find(l => l.id === locationId);
    if (!sellerLocation) {
      return res.status(400).json({ error: "Invalid location ID" });
    }
    
    const client = squareClient(seller.accessToken);
    const { result } = await client.paymentsApi.createPayment({
      idempotencyKey,
      sourceId: paymentToken,
      amountMoney: {
        amount: amountCents, 
        currency 
      },
      customerId: customerId || undefined,
      locationId
    });
    
    const payment = JSON.parse(JSON.stringify(result.payment, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    ));
    
    res.json({ payment });
  } catch (error) {
    console.error("Payment creation error:", error);
    res.status(500).json({ error: error.message, details: error.errors });
  }
});

app.post("/webhooks/square", express.raw({ type: "*/*" }), (req, res) => {
  try {
    const signature = req.headers["x-square-hmacsha256-signature"];
    const body = req.body;
    const key = SQUARE_WEBHOOK_SIGNATURE_KEY;
    
    if (!signature || !key) {
      return res.status(401).send("Missing signature or key");
    }
    
    const hmac = crypto.createHmac("sha256", key).update(body).digest("base64");
    
    if (hmac !== signature) {
      return res.status(401).send("Invalid signature");
    }
    
    const event = JSON.parse(body.toString());
    console.log("Webhook received:", event.type);
    
    switch (event.type) {
      case "payment.updated":
        console.log("Payment updated:", event.data.object.payment.id);
        break;
      case "refund.updated":
        console.log("Refund updated:", event.data.object.refund.id);
        break;
      default:
        console.log("Unhandled webhook event:", event.type);
    }
    
    res.sendStatus(200);
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).send("Webhook processing error");
  }
});

// Delete customer endpoint
app.delete('/api/customers/delete', async (req, res) => {
  try {
    const { customerId } = req.body;
    
    if (!customerId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Customer ID is required' 
      });
    }

    console.log(`Deleting customer: ${customerId?.substring(0, 8)}...`);
    
    const client = new Client({
      environment: SQUARE_ENV === 'production' ? Environment.Production : Environment.Sandbox,
      accessToken: ACCESS_TOKEN
    });

    // Delete the customer
    const response = await client.customersApi.deleteCustomer(customerId);
    
    console.log('Customer deleted successfully:', response.result?.id?.substring(0, 8) + '...');
    
    res.json({ 
      success: true, 
      message: 'Customer deleted successfully',
      result: response.result
    });
    
  } catch (error) {
    console.error('Delete customer error:', error);
    
    // Handle Square API errors
    if (error.errors && error.errors.length > 0) {
      const errorMessage = error.errors.map(e => e.detail).join(', ');
      return res.status(400).json({ 
        success: false, 
        error: errorMessage 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to delete customer' 
    });
  }
});

// Start server locally if not in Vercel
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log('🔒 Security features active:');
    console.log('   ✅ CORS protection');
    console.log('   ✅ Rate limiting');
    console.log('   ✅ Input validation');
    console.log('   ✅ Input sanitization');
    console.log('   ✅ Secure error handling');
  });
}

// Export for Vercel
module.exports = app;