#!/usr/bin/env node

const axios = require('axios');

const BACKEND_URL = 'http://192.168.1.97:5000';

async function testConnection() {
  console.log('🔍 Testing connection to backend...');
  console.log(`📍 Backend URL: ${BACKEND_URL}`);
  
  try {
    const response = await axios.get(`${BACKEND_URL}/health`, { timeout: 5000 });
    console.log('✅ Connection successful!');
    console.log('📊 Backend response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('❌ Connection failed!');
    if (error.code === 'ECONNREFUSED') {
      console.error('💡 Make sure the backend server is running on port 5000');
    } else if (error.code === 'ENOTFOUND') {
      console.error('💡 Check if the IP address 192.168.1.97 is correct');
    } else {
      console.error('💡 Error details:', error.message);
    }
  }
}

testConnection();
