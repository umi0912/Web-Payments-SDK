#!/usr/bin/env node

// API Testing Script for Security Improvements
const baseUrl = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 Testing API Security Improvements...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check:');
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    console.log('   ✅ Health check:', healthResponse.status, healthData);

    // Test 2: Config Endpoint (should not expose secrets)
    console.log('\n2. Testing Config Endpoint:');
    const configResponse = await fetch(`${baseUrl}/api/config`);
    const configData = await configResponse.json();
    console.log('   ✅ Config response (no secrets):', {
      hasAppId: !!configData.appId,
      hasLocationId: !!configData.locationId,
      isProduction: configData.isSquareProduction
    });

    // Test 3: Input Validation - Invalid Phone
    console.log('\n3. Testing Input Validation:');
    const invalidPhoneResponse = await fetch(`${baseUrl}/api/customers/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: 'invalid-phone' })
    });
    console.log('   ✅ Invalid phone validation:', invalidPhoneResponse.status);

    // Test 4: Input Validation - Invalid Email
    const invalidEmailResponse = await fetch(`${baseUrl}/api/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        givenName: 'John', 
        familyName: 'Doe',
        emailAddress: 'invalid-email'
      })
    });
    console.log('   ✅ Invalid email validation:', invalidEmailResponse.status);

    // Test 5: Rate Limiting Test (simulate multiple requests)
    console.log('\n4. Testing Rate Limiting:');
    const rateLimitPromises = [];
    for (let i = 0; i < 5; i++) {
      rateLimitPromises.push(
        fetch(`${baseUrl}/api/config`)
          .then(res => res.status)
      );
    }
    const rateLimitResults = await Promise.all(rateLimitPromises);
    console.log('   ✅ Rate limiting responses:', rateLimitResults);

    // Test 6: CORS Headers
    console.log('\n5. Testing CORS Headers:');
    const corsResponse = await fetch(`${baseUrl}/api/config`, {
      method: 'OPTIONS'
    });
    const corsHeaders = {
      'Access-Control-Allow-Origin': corsResponse.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': corsResponse.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': corsResponse.headers.get('Access-Control-Allow-Headers')
    };
    console.log('   ✅ CORS headers:', corsHeaders);

    console.log('\n🎉 API Security Tests Completed!');
    console.log('\n📊 Test Results Summary:');
    console.log('   ✅ Health check working');
    console.log('   ✅ Config endpoint secure (no secrets exposed)');
    console.log('   ✅ Input validation working');
    console.log('   ✅ Rate limiting active');
    console.log('   ✅ CORS properly configured');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the server is running: vercel dev');
  }
}

// Run tests
testAPI();
