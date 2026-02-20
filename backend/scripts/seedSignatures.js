import mongoose from 'mongoose';
import SignSchema from '../models/SignSchema.js';
import dotenv from 'dotenv';

dotenv.config();

// Sample signature data
const sampleSignatures = [
  {
    name: 'នាយកការិយាល័យ',
    fullNameKh: 'លោក ហុង វាសនា',
    type: 'office',
    filePath: '/Uploads/office-head.png',
    position: 'ប្រធានការិយាល័យ',
    department: 'ការិយាល័យរដ្ឋបាល',
    description: 'ហត្ថលេខានាយកការិយាល័យ',
    status: 'active'
  },
  {
    name: 'នាយករង១',
    fullNameKh: 'លោក សុខ មករា',
    type: 'deputy',
    filePath: '/Uploads/deputy1.png',
    position: 'នាយករងទី១',
    department: 'ផ្នែកគ្រប់គ្រង',
    description: 'ហត្ថលេខានាយករងទី១',
    status: 'active'
  },
  {
    name: 'នាយករង២',
    fullNameKh: 'លោកស្រី ចាន់ សុភាព',
    type: 'deputy',
    filePath: '/Uploads/deputy2.png',
    position: 'នាយករងទី២',
    department: 'ផ្នែកបច្ចេកទេស',
    description: 'ហត្ថលេខានាយករងទី២',
    status: 'active'
  },
  {
    name: 'នាយកមន្ទីរពេទ្យ',
    fullNameKh: 'លោកវេជ្ជបណ្ឌិត វ៉ាន់ ហេង',
    type: 'director',
    filePath: '/Uploads/director.png',
    position: 'នាយកមន្ទីរពេទ្យ',
    department: 'ការិយាល័យនាយក',
    description: 'ហត្ថលេខានាយកមន្ទីរពេទ្យ',
    status: 'active'
  },
  // Employee signatures with common IDs
  {
    name: 'D000',
    fullNameKh: 'លោក ភី សុខា',
    type: 'employee',
    filePath: '/Uploads/D000.jpg',
    position: 'បុគ្គលិកការិយាល័យ',
    department: 'ការិយាល័យរដ្ឋបាល',
    description: 'ហត្ថលេខាបុគ្គលិក D000',
    status: 'active'
  },
  {
    name: 'D001',
    fullNameKh: 'លោកស្រី ម៉ៅ ស្រីមុំ',
    type: 'employee',
    filePath: '/Uploads/D001.jpg',
    position: 'គ្រូពេទ្យ',
    department: 'ផ្នែកព្យាបាល',
    description: 'ហត្ថលេខាបុគ្គលិក D001',
    status: 'active'
  },
  {
    name: 'D0001',
    fullNameKh: 'លោក រ៉ាន់ ពិសាច',
    type: 'employee',
    filePath: '/Uploads/D0001.jpg',
    position: 'បុគ្គលិកបច្ចេកទេស',
    department: 'ផ្នែកបច្ចេកទេស',
    description: 'ហត្ថលេខាបុគ្គលិក D0001',
    status: 'active'
  },
  {
    name: 'D002',
    fullNameKh: 'លោកស្រី ហ៊ុន ស្រីលាង',
    type: 'employee',
    filePath: '/Uploads/D002.jpg',
    position: 'គ្រូពេទ្យ',
    department: 'ផ្នែកព្យាបាល',
    description: 'ហត្ថលេខាបុគ្គលិក D002',
    status: 'active'
  },
  {
    name: 'D0002',
    fullNameKh: 'លោក ឃឹម ធារ៉ា',
    type: 'employee',
    filePath: '/Uploads/D0002.jpg',
    position: 'បុគ្គលិកការិយាល័យ',
    department: 'ការិយាល័យរដ្ឋបាល',
    description: 'ហត្ថលេខាបុគ្គលិក D0002',
    status: 'active'
  },
  {
    name: 'D007',
    fullNameKh: 'លោក សុខ ពិរុណ',
    type: 'employee',
    filePath: '/Uploads/D007.jpg',
    position: 'បុគ្គលិកបច្ចេកទេស',
    department: 'ផ្នែកបច្ចេកទេស',
    description: 'ហត្ថលេខាបុគ្គលិក D007',
    status: 'active'
  },
  {
    name: 'D0007',
    fullNameKh: 'លោកស្រី យិន ស្រីពេជ្រ',
    type: 'employee',
    filePath: '/Uploads/D0007.jpg',
    position: 'គ្រូពេទ្យ',
    department: 'ផ្នែកព្យាបាល',
    description: 'ហត្ថលេខាបុគ្គលិក D0007',
    status: 'active'
  },
  {
    name: 'D009',
    fullNameKh: 'លោក ហេង ស្រីបុប្ផា',
    type: 'employee',
    filePath: '/Uploads/D009.jpg',
    position: 'បុគ្គលិកការិយាល័យ',
    department: 'ការិយាល័យរដ្ឋបាល',
    description: 'ហត្ថលេខាបុគ្គលិក D009',
    status: 'active'
  },
  {
    name: 'D0009',
    fullNameKh: 'លោកស្រី គឹម ស្រីចែម',
    type: 'employee',
    filePath: '/Uploads/D0009.jpg',
    position: 'គ្រូពេទ្យ',
    department: 'ផ្នែកព្យាបាល',
    description: 'ហត្ថលេខាបុគ្គលិក D0009',
    status: 'active'
  },
  {
    name: 'D00011',
    fullNameKh: 'លោក ធាន វិបុល',
    type: 'employee',
    filePath: '/Uploads/D00011.jpg',
    position: 'បុគ្គលិកបច្ចេកទេស',
    department: 'ផ្នែកបច្ចេកទេស',
    description: 'ហត្ថលេខាបុគ្គលិក D00011',
    status: 'active'
  },
  {
    name: 'D0015',
    fullNameKh: 'លោកស្រី ព្រាន ស្រីអង្គរ',
    type: 'employee',
    filePath: '/Uploads/D0015.jpg',
    position: 'គ្រូពេទ្យ',
    department: 'ផ្នែកព្យាបាល',
    description: 'ហត្ថលេខាបុគ្គលិក D0015',
    status: 'active'
  },
  {
    name: 'D0019',
    fullNameKh: 'លោក ប៊ុន សុវណ្ណរ៉ា',
    type: 'employee',
    filePath: '/Uploads/D0019.jpg',
    position: 'បុគ្គលិកការិយាល័យ',
    department: 'ការិយាល័យរដ្ឋបាល',
    description: 'ហត្ថលេខាបុគ្គលិក D0019',
    status: 'active'
  },
  {
    name: 'D0020',
    fullNameKh: 'លោកស្រី ឆាយ ស្រីពេជ្រ',
    type: 'employee',
    filePath: '/Uploads/D0020.jpg',
    position: 'គ្រូពេទ្យ',
    department: 'ផ្នែកព្យាបាល',
    description: 'ហត្ថលេខាបុគ្គលិក D0020',
    status: 'active'
  },
  {
    name: 'D0022',
    fullNameKh: 'លោក ឈៀង វិសាល',
    type: 'employee',
    filePath: '/Uploads/D0022.jpg',
    position: 'បុគ្គលិកបច្ចេកទេស',
    department: 'ផ្នែកបច្ចេកទេស',
    description: 'ហត្ថលេខាបុគ្គលិក D0022',
    status: 'active'
  },
  {
    name: 'E0001',
    fullNameKh: 'លោកស្រី ណុប ស្រីខែម',
    type: 'employee',
    filePath: '/Uploads/E0001.jpg',
    position: 'គ្រូពេទ្យ',
    department: 'ផ្នែកអាសន្ន',
    description: 'ហត្ថលេខាបុគ្គលិក E0001',
    status: 'active'
  },
  {
    name: 'E0002',
    fullNameKh: 'លោក ទូច សុខសាន្ត',
    type: 'employee',
    filePath: '/Uploads/E0002.jpg',
    position: 'គ្រូពេទ្យ',
    department: 'ផ្នែកអាសន្ន',
    description: 'ហត្ថលេខាបុគ្គលិក E0002',
    status: 'active'
  },
  {
    name: 'M0001',
    fullNameKh: 'លោកស្រី មុំ ស្រីគន្ធា',
    type: 'employee',
    filePath: '/Uploads/M0001.jpg',
    position: 'គ្រូពេទ្យ',
    department: 'ផ្នែកសម្ភព',
    description: 'ហត្ថលេខាបុគ្គលិក M0001',
    status: 'active'
  },
  {
    name: 'M0002',
    fullNameKh: 'លោក ប៊ី ហួកធីម',
    type: 'employee',
    filePath: '/Uploads/M0002.jpg',
    position: 'គ្រូពេទ្យ',
    department: 'ផ្នែកសម្ភព',
    description: 'ហត្ថលេខាបុគ្គលិក M0002',
    status: 'active'
  },
  {
    name: 'A0001',
    fullNameKh: 'លោកស្រី ខែម ស្រីនាង',
    type: 'admin',
    filePath: '/Uploads/A0001.jpg',
    position: 'បុគ្គលិករដ្ឋបាល',
    department: 'ការិយាល័យរដ្ឋបាល',
    description: 'ហត្ថលេខាបុគ្គលិក A0001',
    status: 'active'
  }
];

const seedSignatures = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('Connected to MongoDB');

    // Clear existing signatures
    await SignSchema.deleteMany({});
    console.log('Cleared existing signatures');

    // Insert sample signatures
    await SignSchema.insertMany(sampleSignatures);
    console.log(`Inserted ${sampleSignatures.length} sample signatures`);

    // Create indexes
    await SignSchema.ensureIndexes();
    console.log('Created indexes');

    console.log('Signature seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding signatures:', error);
    process.exit(1);
  }
};

// Run the seeding if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedSignatures();
}

export default seedSignatures;