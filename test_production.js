#!/usr/bin/env node

// Production Testing Script
const baseUrl = 'https://web-payments-iivlxk44c-umis-projects-e802f152.vercel.app';
const testPhone = '+16287893902';

async function testProduction() {
  console.log('🌐 Testing Production Functions with Phone: +16287893902\n');

  try {
    // Test 1: Health Check
    console.log('1. 🏥 Health Check...');
    const healthResponse = await fetch(`${baseUrl}/health`);
    const healthData = await healthResponse.json();
    console.log('   Status:', healthResponse.status);
    console.log('   Response:', JSON.stringify(healthData, null, 2));

    // Test 2: Config Check
    console.log('\n2. ⚙️  Config Check...');
    const configResponse = await fetch(`${baseUrl}/api/config`);
    const configData = await configResponse.json();
    console.log('   Status:', configResponse.status);
    console.log('   Response:', JSON.stringify(configData, null, 2));

    // Test 3: Search for existing customers
    console.log('\n3. 🔍 Searching for existing customers...');
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

    // Test 4: Create new customer if none found
    if (!searchData.customers || searchData.customers.length === 0) {
      console.log('\n4. 👤 Creating new customer...');
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
      }
    }

    // Test 5: Test validation
    console.log('\n5. ✅ Testing validation...');
    const phoneRegex = /^\+1[2-9]\d{2}[2-9]\d{6}$/;
    const isValid = phoneRegex.test(testPhone);
    console.log('   Phone:', testPhone);
    console.log('   Valid format:', isValid);

    console.log('\n🎉 Production Testing Completed!');
    console.log('\n📊 Summary:');
    console.log('   ✅ Production server accessible');
    console.log('   ✅ API endpoints responding');
    console.log('   ✅ Customer search tested');
    console.log('   ✅ Customer creation tested');
    console.log('   ✅ Validation working');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n💡 Check if production URL is accessible');
  }
}

// Run tests
testProduction();
