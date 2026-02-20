require('dotenv').config();
const mongoose = require('mongoose');

console.log('Environment Variables:');
console.log('MONGODB_URI:', process.env.MONGODB_URI);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ Successfully connected to:', process.env.MONGODB_URI);
    console.log('✅ Database name:', mongoose.connection.db.databaseName);
    return mongoose.connection.close();
  })
  .then(() => {
    console.log('✅ Connection closed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  });
