// Test script for schedule overrides functionality
const testScheduleOverrides = async () => {
  const baseURL = 'http://localhost:5000/api';
  
  // Test data
  const testOverride = {
    employeeRef: 'D0433',
    date: '2025-10-15',
    shiftTitle: '10:00-18:00',
    shiftStart: '10:00',
    shiftEnd: '18:00',
    shiftColor: '#FF5722'
  };
  
  try {
    // Test creating a schedule override
    console.log('Testing schedule override creation...');
    const response = await fetch(`${baseURL}/schedule-overrides`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testOverride)
    });
    
    if (response.ok) {
      const created = await response.json();
      console.log('✅ Schedule override created:', created);
      
      // Test retrieving the override
      console.log('Testing schedule override retrieval...');
      const getResponse = await fetch(`${baseURL}/schedule-overrides?from=2025-10-01&to=2025-10-31`);
      if (getResponse.ok) {
        const overrides = await getResponse.json();
        console.log('✅ Schedule overrides retrieved:', overrides.length, 'items');
        console.log('Sample override:', overrides[0]);
      } else {
        console.error('❌ Failed to retrieve schedule overrides');
      }
    } else {
      console.error('❌ Failed to create schedule override:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testScheduleOverrides();