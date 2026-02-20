require('dotenv').config();
const mongoose = require('mongoose');

console.log('='.repeat(60));
console.log('📋 HRMS DATABASE CONFIGURATION REPORT');
console.log('='.repeat(60));

console.log('\n🔧 Environment Configuration:');
console.log(`- Database URI: ${process.env.MONGODB_URI}`);
console.log(`- Server Port: ${process.env.PORT || 5000}`);
console.log(`- Environment: ${process.env.NODE_ENV || 'development'}`);

console.log('\n🗄️ Database Connection Test:');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log(`✅ Successfully connected to: ${mongoose.connection.db.databaseName}`);
    
    // Check collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`\n📊 Available Collections (${collections.length}):`);
    collections.forEach((col, index) => {
      console.log(`${index + 1}. ${col.name}`);
    });
    
    // Check sample data
    const Employee = require('./models/Employee');
    const count = await Employee.countDocuments();
    console.log(`\n👥 Employee Records: ${count} employees`);
    
    if (count > 0) {
      const sample = await Employee.findOne();
      console.log(`\n📋 Sample Employee Data:`);
      console.log(`- Staff ID: ${sample.staffId}`);
      console.log(`- Name: ${sample.name} (${sample.khmerName})`);
      console.log(`- Department: ${sample.department}`);
      console.log(`- Position: ${sample.position}`);
    }
    
    console.log('\n✅ Database configuration is correctly set up!');
    console.log('🌐 Your HRMS system is ready for use at:');
    console.log('- Frontend: http://192.168.8.79:5173:5173/');
  console.log('- Backend API: http://0.0.0.0:5000');
    console.log('='.repeat(60));
    
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error.message);
  })
  .finally(() => {
    mongoose.connection.close();
    process.exit(0);
  });
