// Complete API test suite for kshf_hospital_app database
const API_BASE = process.env.API_BASE || 'http://localhost:5000/api';

const testAPI = async () => {
  console.log('🧪 Testing all API endpoints...\n');

  // Test 1: Health check
  try {
  const base = process.env.API_BASE || 'http://localhost:5000';
  const response = await fetch(`${base}/`);
    const data = await response.json();
    console.log('✅ Health Check:', data.message);
  } catch (error) {
    console.error('❌ Health Check failed:', error.message);
  }

  // Test 2: Get all employees
  try {
    const response = await fetch(`${API_BASE}/employees`);
    const data = await response.json();
  console.log(`✅ Get hr: Found ${data.totalEmployees} employees`);
  } catch (error) {
  console.error('❌ Get hr failed:', error.message);
  }

  // Test 3: Get documents
  try {
    const response = await fetch(`${API_BASE}/documents/staff/CS0012`);
    const data = await response.json();
    console.log(`✅ Get Documents: Found ${data.length} documents`);
  } catch (error) {
    console.error('❌ Get Documents failed:', error.message);
  }

  // Test 4: Get files
  try {
    const response = await fetch(`${API_BASE}/files`);
    const data = await response.json();
    console.log(`✅ Get Files: Found ${data.length} files`);
  } catch (error) {
    console.error('❌ Get Files failed:', error.message);
  }

  console.log('\n🎯 API Testing Complete!');
};

testAPI();
