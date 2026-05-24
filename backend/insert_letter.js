import mongoose from 'mongoose';

const uri = 'mongodb://localhost:27017/kshf_hospital_app';

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collection = db.collection('letters');
  
  const payload = {
    templateType: 'appointment',
    officer: 'ណយ ពិសី',
    officerId: 'D0293',
    letterNo: '123',
    subject: 'លិខិតបង្គាប់ការ',
    recipient: '- កិច្ចប្រជុំថ្នាក់ដឹកនាំមន្ទីរពេទ្យមិត្តភាព-ខ្មែរសូវៀត ថ្ងៃទីខែឆ្នាំ dd/mm/yyyy។\n- តាមការចាំបាច់របស់មន្ទីរពេទ្យ។',
    department: 'ផ្នែកជំងឺទូទៅទារក និងកុមារ',
    body: 'លោក ណយ ពិសី បច្ចុប្បន្នជាណយ ពិសី ត្រូវបានតែងតាំងជា...... នៅផ្នែកផ្នែកជំងឺទូទៅទារក និងកុមារ។\n\nការិយាល័យរដ្ឋបាលនិងបុគ្គលិក ការិយាល័យបច្ចេកទេស ការិយាល័យហិរញ្ញវត្ថុ ផ្នែកពាក់ព័ន្ធនានា សាមីខ្លួន ត្រូវអនុវត្តតាមលិខិតបង្គាប់ការនេះ ចាប់ពីថ្ងៃចុះហត្ថលេខានេះតទៅ។',
    signPlace: 'រាជធានីភ្នំពេញ',
    signTitle: 'នាយកមន្ទីរពេទ្យ',
    signName: 'សាស្ត្រាចារ្យ ងី ម៉េង',
    createdAt: new Date('2026-05-23T00:00:00.000Z'),
    type: 'instruction'
  };
  
  await collection.insertOne(payload);
  console.log('Inserted successfully!');
  await mongoose.disconnect();
}

run().catch(console.error);
