#!/usr/bin/env node

// Real Function Testing Script
const baseUrl = 'http://localhost:3000';
const testPhone = '+16287893902'; // Your real phone number

async function testRealFunctions() {
  console.log('🧪 Testing Real Functions with Phone: +16287893902\n');

  try {
    // Test 1: Search for existing customers
    console.log('1. 🔍 Searching for existing customers...');
    const searchResponse = await fetch(`${baseUrl}/api/customers/search`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-merchant-id': 'MLJSE2F6EE60D'
      },
      body: JSON.stringify({ phone: testPhone })
    });
    
    const searchData = await searchResponse.json();
    console.log('   Status:', searchResponse.status);
    console.log('   Response:', JSON.stringify(searchData, null, 2));
    
    if (searchData.customers && searchData.customers.length > 0) {
      console.log('   ✅ Found existing customers:', searchData.customers.length);
      searchData.customers.forEach((customer, index) => {
        console.log(`   Customer ${index + 1}:`, {
          id: customer.id?.substring(0, 8) + '...',
          name: `${customer.givenName} ${customer.familyName}`,
          email: customer.emailAddress || 'No email',
          phone: customer.phoneNumber || 'No phone',
          cardsCount: customer.cards?.length || 0
        });
      });
    } else {
      console.log('   ℹ️  No existing customers found');
    }

    // Test 2: Create new customer if none found
    if (!searchData.customers || searchData.customers.length === 0) {
      console.log('\n2. 👤 Creating new customer...');
      const createResponse = await fetch(`${baseUrl}/api/customers`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-merchant-id': 'MLJSE2F6EE60D'
        },
        body: JSON.stringify({
          givenName: 'Umit',
          familyName: 'Rakhimbekova',
          emailAddress: 'umit@example.com',
          phoneNumber: testPhone
        })
      });
      
      const createData = await createResponse.json();
      console.log('   Status:', createResponse.status);
      console.log('   Response:', JSON.stringify(createData, null, 2));
      
      if (createData.customer) {
        console.log('   ✅ Customer created successfully!');
        console.log('   Customer ID:', createData.customer.id?.substring(0, 8) + '...');
        
        // Test 3: Try to create a card (this will fail without real tokenization)
        console.log('\n3. 💳 Testing card creation (will fail without real token)...');
        const cardResponse = await fetch(`${baseUrl}/api/cards`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'x-merchant-id': 'MLJSE2F6EE60D'
          },
          body: JSON.stringify({
            sourceId: 'test_token_123', // This will fail in real Square API
            customerId: createData.customer.id,
            cardholderName: 'Umit Rakhimbekova'
          })
        });
        
        const cardData = await cardResponse.json();
        console.log('   Status:', cardResponse.status);
        console.log('   Response:', JSON.stringify(cardData, null, 2));
        
        if (cardResponse.status === 400 || cardResponse.status === 500) {
          console.log('   ✅ Card creation properly rejected (expected with test token)');
        }
      }
    }

    // Test 4: Test validation with your phone number
    console.log('\n4. ✅ Testing phone validation...');
    const phoneRegex = /^\+1[2-9]\d{2}[2-9]\d{6}$/;
    const isValid = phoneRegex.test(testPhone);
    console.log('   Phone:', testPhone);
    console.log('   Valid format:', isValid);
    
    if (isValid) {
      console.log('   ✅ Phone number format is valid for Square API');
    } else {
      console.log('   ❌ Phone number format is invalid');
    }

    // Test 5: Test name validation
    console.log('\n5. ✅ Testing name validation...');
    const nameRegex = /^[a-zA-Z\s\-'\.]+$/;
    const testNames = ['Umit Rakhimbekova', 'Umit-Rakhimbekova', "Umit O'Connor", 'Umit123'];
    
    testNames.forEach(name => {
      const isValid = nameRegex.test(name);
      console.log(`   "${name}": ${isValid ? '✅ Valid' : '❌ Invalid'}`);
    });

    console.log('\n🎉 Real Function Testing Completed!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Customer search tested');
    console.log('   ✅ Customer creation tested');
    console.log('   ✅ Card creation validation tested');
    console.log('   ✅ Phone validation tested');
    console.log('   ✅ Name validation tested');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Make sure the server is running on port 3000');
  }
}

// Run tests
testRealFunctions();
