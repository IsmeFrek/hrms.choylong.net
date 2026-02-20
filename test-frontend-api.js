// Test API connection
const testAPI = async () => {
  try {
  const base = process.env.API_BASE || 'http://localhost:5000';
  const response = await fetch(`${base}/api/employees`);
    const data = await response.json();
    console.log('✅ API Connection successful');
  console.log('📊 hr data:', data);
  } catch (error) {
    console.error('❌ API Connection failed:', error);
  }
};

// Test backend health
const testHealth = async () => {
  try {
  const base = process.env.API_BASE || 'http://localhost:5000';
  const response = await fetch(`${base}/`);
    const data = await response.json();
    console.log('✅ Backend health check:', data);
  } catch (error) {
    console.error('❌ Backend health check failed:', error);
  }
};

console.log('🧪 Testing API connections...');
testHealth();
testAPI();
