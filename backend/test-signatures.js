import mongoose from 'mongoose';
import SignSchema from './models/SignSchema.js';

async function testSignatures() {
  try {
    await mongoose.connect('mongodb://localhost:27017/hrms');
    console.log('Connected to MongoDB');
    
    // Check all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('Available collections:');
    collections.forEach(col => console.log('-', col.name));
    
    const signatures = await SignSchema.find({}).limit(5);
    console.log('Found signatures:', signatures.length);
    
    if (signatures.length === 0) {
      console.log('No signatures found. Creating sample signatures...');
      
      // Create sample signatures based on existing files
      const sampleSignatures = [
        {
          name: 'ស្បៀង ថៃ',
          fullNameKh: 'ស្បៀង ថៃ',
          type: 'employee',
          filePath: '/Uploads/D0001.jpg',
          status: 'active'
        },
        {
          name: 'សាន្ត គិម',
          fullNameKh: 'សាន្ត គិម',
          type: 'employee', 
          filePath: '/Uploads/D0002.jpg',
          status: 'active'
        },
        {
          name: 'គីម សុវណ្ណ',
          fullNameKh: 'គីម សុវណ្ណ',
          type: 'director',
          filePath: '/Uploads/D0007.jpg',
          status: 'active'
        }
      ];
      
      for (let sigData of sampleSignatures) {
        const signature = new SignSchema(sigData);
        await signature.save();
        console.log('Created signature for:', sigData.name);
      }
    }
    
    signatures.forEach((sig, index) => {
      console.log(`\nSignature ${index + 1}:`);
      console.log('Name:', sig.name);
      console.log('FilePath:', sig.filePath);
      console.log('SignatureUrl:', sig.signatureUrl);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testSignatures();