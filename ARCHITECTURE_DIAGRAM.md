# 🏗️ **ДИАГРАММА АРХИТЕКТУРЫ СИСТЕМЫ**

## 📊 **ВЫСОКОУРОВНЕВАЯ АРХИТЕКТУРА**

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│  🌐 Browser (Chrome, Safari, Firefox, Edge)                   │
│  📱 Mobile (iOS, Android)                                      │
│  💻 Desktop (Windows, macOS, Linux)                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTPS/WSS
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PRESENTATION LAYER                        │
├─────────────────────────────────────────────────────────────────┤
│  🎨 Frontend (public/index.html)                              │
│  ├── HTML5/CSS3/JavaScript                                    │
│  ├── Square Web Payments SDK                                  │
│  ├── Responsive Design                                        │
│  └── Client-side Validation                                   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ API Calls
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                        API GATEWAY                             │
├─────────────────────────────────────────────────────────────────┤
│  🚀 Vercel Edge Network                                       │
│  ├── HTTPS Enforcement                                        │
│  ├── CORS Protection                                          │
│  ├── Rate Limiting                                            │
│  └── Request Routing                                          │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ Serverless Functions
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  🔧 Vercel Serverless Functions (api/index.js)               │
│  ├── Express.js Framework                                     │
│  ├── Input Validation & Sanitization                          │
│  ├── Authentication & Authorization                           │
│  ├── Error Handling                                           │
│  └── Business Logic                                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ API Calls
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      INTEGRATION LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│  🔗 External Services                                         │
│  ├── Square API (Payments, Customers, Cards)                  │
│  ├── N8N Webhook (Token Management)                           │
│  └── OAuth 2.0 (Authentication)                              │
└─────────────────────────────────────────────────────────────────┘
```

## 🔄 **ДЕТАЛЬНЫЙ ПОТОК ДАННЫХ**

### **1. Поиск клиента:**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │───▶│   API       │───▶│  Square API │───▶│   Response  │
│             │    │             │    │             │    │             │
│ Phone Input │    │ Validation  │    │ Search      │    │ Customer    │
│ +16287893902│    │ Sanitization│    │ Customers   │    │ Data        │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       ▲                                                           │
       │                                                           │
       └───────────────────────────────────────────────────────────┘
```

### **2. Создание клиента:**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │───▶│   API       │───▶│  Square API │───▶│   Response  │
│             │    │             │    │             │    │             │
│ Form Data   │    │ Validation  │    │ Create      │    │ Customer    │
│ Name, Phone │    │ Sanitization│    │ Customer    │    │ Created     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       ▲                                                           │
       │                                                           │
       └───────────────────────────────────────────────────────────┘
```

### **3. Сохранение карты:**
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │───▶│ Square SDK  │───▶│   API       │───▶│  Square API │
│             │    │             │    │             │    │             │
│ Card Input  │    │ Tokenization│    │ Validation  │    │ Save Card   │
│ 4111 1111   │    │ Secure      │    │ Sanitization│    │ Token       │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       ▲                                                           │
       │                                                           │
       └───────────────────────────────────────────────────────────┘
```

## 🛡️ **БЕЗОПАСНОСТЬ АРХИТЕКТУРЫ**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                             │
├─────────────────────────────────────────────────────────────────┤
│  🔒 Layer 1: HTTPS Enforcement                                 │
│  ├── TLS 1.3 Encryption                                        │
│  ├── Certificate Management                                     │
│  └── HSTS Headers                                              │
├─────────────────────────────────────────────────────────────────┤
│  🛡️ Layer 2: CORS Protection                                   │
│  ├── Origin Validation                                         │
│  ├── Method Restrictions                                       │
│  └── Header Validation                                         │
├─────────────────────────────────────────────────────────────────┤
│  ⚡ Layer 3: Rate Limiting                                      │
│  ├── IP-based Limiting                                         │
│  ├── Endpoint-specific Limits                                  │
│  └── Burst Protection                                          │
├─────────────────────────────────────────────────────────────────┤
│  🔍 Layer 4: Input Validation                                  │
│  ├── Data Type Validation                                      │
│  ├── Format Validation                                         │
│  └── Length Validation                                         │
├─────────────────────────────────────────────────────────────────┤
│  🧹 Layer 5: Input Sanitization                                │
│  ├── HTML Entity Encoding                                      │
│  ├── XSS Protection                                            │
│  └── SQL Injection Prevention                                  │
├─────────────────────────────────────────────────────────────────┤
│  🚨 Layer 6: Error Handling                                    │
│  ├── Secure Error Messages                                     │
│  ├── Logging Security                                          │
│  └── Information Disclosure Prevention                         │
├─────────────────────────────────────────────────────────────────┤
│  🔑 Layer 7: Token Management                                  │
│  ├── OAuth 2.0 Authentication                                  │
│  ├── Token Refresh Logic                                       │
│  └── Secure Storage                                            │
├─────────────────────────────────────────────────────────────────┤
│  💳 Layer 8: PCI DSS Compliance                                │
│  ├── Card Tokenization                                         │
│  ├── No Card Data Storage                                      │
│  └── Secure Transmission                                       │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 **КОМПОНЕНТНАЯ АРХИТЕКТУРА**

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRONTEND COMPONENTS                         │
├─────────────────────────────────────────────────────────────────┤
│  🎨 UI Components                                              │
│  ├── Header (Logo, Title)                                      │
│  ├── Search Form (Phone Input)                                 │
│  ├── Customer Form (Name, Phone)                               │
│  ├── Payment Form (Square SDK)                                 │
│  ├── Results Display (Customer List)                           │
│  └── Status Messages (Success/Error)                           │
├─────────────────────────────────────────────────────────────────┤
│  🔧 JavaScript Modules                                         │
│  ├── Square SDK Integration                                    │
│  ├── API Communication                                         │
│  ├── Form Validation                                           │
│  ├── Error Handling                                            │
│  └── UI State Management                                       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND COMPONENTS                          │
├─────────────────────────────────────────────────────────────────┤
│  🚀 API Endpoints                                              │
│  ├── Health Check (/health)                                    │
│  ├── Configuration (/api/config)                               │
│  ├── Customer Search (/api/customers/search)                   │
│  ├── Customer Creation (/api/customers)                        │
│  ├── Card Management (/api/cards)                              │
│  ├── Payment Processing (/api/payments/create)                 │
│  └── Token Management (/api/update-token)                      │
├─────────────────────────────────────────────────────────────────┤
│  🛡️ Middleware                                                 │
│  ├── CORS Middleware                                           │
│  ├── Rate Limiting Middleware                                  │
│  ├── Authentication Middleware                                 │
│  ├── Validation Middleware                                     │
│  └── Error Handling Middleware                                 │
├─────────────────────────────────────────────────────────────────┤
│  🔗 External Integrations                                      │
│  ├── Square API Client                                         │
│  ├── N8N Webhook Integration                                   │
│  ├── OAuth 2.0 Handler                                         │
│  └── Token Refresh Logic                                       │
└─────────────────────────────────────────────────────────────────┘
```

## 🌐 **СЕТЕВАЯ АРХИТЕКТУРА**

```
┌─────────────────────────────────────────────────────────────────┐
│                    NETWORK TOPOLOGY                            │
├─────────────────────────────────────────────────────────────────┤
│  🌍 Global CDN (Vercel Edge)                                   │
│  ├── North America (US, Canada)                                │
│  ├── Europe (UK, Germany, France)                              │
│  ├── Asia Pacific (Japan, Australia)                           │
│  └── Other Regions                                             │
├─────────────────────────────────────────────────────────────────┤
│  🚀 Serverless Functions                                       │
│  ├── Auto-scaling                                              │
│  ├── Cold Start Optimization                                   │
│  ├── Memory Management                                         │
│  └── Timeout Handling                                          │
├─────────────────────────────────────────────────────────────────┤
│  🔗 External APIs                                              │
│  ├── Square API (Production)                                   │
│  ├── N8N Webhook (Automation)                                  │
│  └── OAuth Providers                                           │
└─────────────────────────────────────────────────────────────────┘
```

## 📈 **МАСШТАБИРУЕМОСТЬ АРХИТЕКТУРЫ**

```
┌─────────────────────────────────────────────────────────────────┐
│                    SCALABILITY PATTERNS                        │
├─────────────────────────────────────────────────────────────────┤
│  📊 Horizontal Scaling                                         │
│  ├── Serverless Functions (Auto-scale)                         │
│  ├── CDN Distribution (Global)                                 │
│  ├── Database Sharding (Square API)                            │
│  └── Load Balancing (Vercel)                                   │
├─────────────────────────────────────────────────────────────────┤
│  📈 Vertical Scaling                                           │
│  ├── Memory: 50MB → 3GB                                        │
│  ├── CPU: 1 vCPU → 10 vCPU                                     │
│  ├── Timeout: 10s → 60s                                        │
│  └── Concurrency: 100 → 1000                                   │
├─────────────────────────────────────────────────────────────────┤
│  🔄 Performance Optimization                                   │
│  ├── Code Splitting                                            │
│  ├── Lazy Loading                                              │
│  ├── Caching Strategies                                        │
│  └── Compression (gzip/brotli)                                 │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 **ЗАКЛЮЧЕНИЕ**

Архитектура системы представляет собой **современную, безопасную и масштабируемую** serverless архитектуру с четким разделением ответственности между слоями. Система спроектирована с учетом лучших практик безопасности, производительности и удобства сопровождения.

**Ключевые преимущества:**
- ✅ **Простота** - минимальная сложность
- ✅ **Безопасность** - многоуровневая защита
- ✅ **Масштабируемость** - автоматическое масштабирование
- ✅ **Производительность** - оптимизированная архитектура
- ✅ **Стоимость** - эффективное использование ресурсов

**Система готова к продакшену и может масштабироваться для обслуживания тысяч пользователей!** 🚀
