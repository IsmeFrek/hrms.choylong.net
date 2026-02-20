const mongoose = require('mongoose');
const Employee = require('./models/Employee');

const testConnection = async () => {
  try {
    // Connect to the kshf_hospital_app database as requested
    await mongoose.connect('mongodb://localhost:27017/kshf_hospital_app');
    console.log('✅ Connected to MongoDB kshf_hospital_app database');
    
    // Check if we can access the employees collection
    const employees = await Employee.find().limit(5);
    console.log('📊 Current employees in database:', employees.length);
    
    if (employees.length > 0) {
      console.log('👤 Sample employee data:');
      console.log(JSON.stringify(employees[0], null, 2));
    }
    
    // Check if the collections exist
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📁 Available collections:');
    collections.forEach(col => console.log(`  - ${col.name}`));
    
    mongoose.disconnect();
    console.log('✅ Test completed successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
};

testConnection();
