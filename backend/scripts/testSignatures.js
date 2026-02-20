#!/usr/bin/env node

import mongoose from 'mongoose';
import SignSchema from '../models/SignSchema.js';
import dotenv from 'dotenv';

dotenv.config();

const testSignatures = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');
    console.log('Testing signature search functionality...\n');

    // Test cases
    const testCases = [
      'នាយកការិយាល័យ',
      'D001',
      'd001', // lowercase
      'D0007',
      'នាយករង១',
      'នាយកមន្ទីរពេទ្យ',
      'E0001',
      'M0001',
      'A0001',
      'INVALID_NAME' // should not be found
    ];

    for (const testName of testCases) {
      try {
        const signature = await SignSchema.findByName(testName);
        if (signature) {
          console.log(`✅ Found: ${testName}`);
          console.log(`   - Full Name: ${signature.fullNameKh || 'N/A'}`);
          console.log(`   - File Path: ${signature.filePath}`);
          console.log(`   - Type: ${signature.type}`);
          console.log(`   - Position: ${signature.position || 'N/A'}`);
          console.log(`   - Status: ${signature.status}`);
          console.log(`   - Usage Count: ${signature.metadata?.usageCount || 0}`);
        } else {
          console.log(`❌ Not found: ${testName}`);
        }
      } catch (error) {
        console.log(`⚠️  Error searching ${testName}: ${error.message}`);
      }
      console.log(''); // blank line for readability
    }

    // Test type-based search
    console.log('\n📋 Testing type-based searches:');
    const types = ['khmer', 'employee', 'director', 'deputy', 'office', 'admin'];
    
    for (const type of types) {
      try {
        const signatures = await SignSchema.findByType(type);
        console.log(`${type}: ${signatures.length} signatures found`);
        if (signatures.length > 0) {
          signatures.slice(0, 3).forEach(sig => { // Show first 3
            console.log(`  - ${sig.name} (${sig.fullNameKh || 'N/A'})`);
          });
          if (signatures.length > 3) {
            console.log(`  ... and ${signatures.length - 3} more`);
          }
        }
      } catch (error) {
        console.log(`⚠️  Error searching type ${type}: ${error.message}`);
      }
    }

    // Test statistics
    console.log('\n📊 Statistics:');
    const stats = await SignSchema.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$status', 'inactive'] }, 1, 0] } },
          archived: { $sum: { $cond: [{ $eq: ['$status', 'archived'] }, 1, 0] } }
        }
      }
    ]);

    const typeStats = await SignSchema.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    console.log('Overall Statistics:');
    console.log(`  Total: ${stats[0]?.total || 0}`);
    console.log(`  Active: ${stats[0]?.active || 0}`);
    console.log(`  Inactive: ${stats[0]?.inactive || 0}`);
    console.log(`  Archived: ${stats[0]?.archived || 0}`);
    
    console.log('\nBy Type:');
    typeStats.forEach(stat => {
      console.log(`  ${stat._id}: ${stat.count}`);
    });

    // Test record usage functionality
    console.log('\n🔄 Testing usage recording...');
    const testSig = await SignSchema.findByName('D001');
    if (testSig) {
      const originalUsage = testSig.metadata?.usageCount || 0;
      await testSig.recordUsage();
      const updatedSig = await SignSchema.findById(testSig._id);
      console.log(`Usage count updated: ${originalUsage} → ${updatedSig.metadata?.usageCount || 0}`);
      console.log(`Last used: ${updatedSig.metadata?.lastUsed?.toISOString()}`);
    }

    console.log('\n✅ All signature tests completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing signatures:', error);
    process.exit(1);
  }
};

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testSignatures();
}

export default testSignatures;