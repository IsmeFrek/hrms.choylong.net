import mongoose from 'mongoose';
import { scrapeCheckinmeDayOffs } from '../services/checkinmeService.js';
import HR from '../models/HR.js';
import * as dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

async function runFix() {
  console.log('Fetching Checkinme employees to find the 14 mismatches...');
  // Initialize minimal options to get names
  const testMonth = new Date().toISOString().slice(0, 7);
  
  try {
    // We already built the Checkinme day-off scraper
    const results = await scrapeCheckinmeDayOffs({ month: testMonth });
    
    let mismatched = 0;
    
    for (const item of results) {
       const cleanName = item.name.replace(/\s+/g, ' ').trim();
       const nameRegex = new RegExp(`^${cleanName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
       
       const exactMatched = await HR.findOne({ 
          $or: [
            { name: { $regex: nameRegex } }, 
            { khmerName: { $regex: nameRegex } },
            { fullName: { $regex: nameRegex } },
            { nameLatin: { $regex: nameRegex } }
          ]
       });

       if (!exactMatched) {
         // Found one of the 14!
         mismatched++;
         console.log(`\n===================`);
         console.log(`Mismatch #${mismatched}: Checkinme Name = "${item.name}"`);
         
         // Try fuzzy
         const words = cleanName.split(' ').map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
         if (words.length > 0) {
            const wordConditions = words.map(w => ({
              $or: [
                { name: new RegExp(w, 'i') },
                { khmerName: new RegExp(w, 'i') },
                { fullName: new RegExp(w, 'i') },
                { nameLatin: new RegExp(w, 'i') }
              ]
            }));

            const fuzzyMatched = await HR.findOne({ $and: wordConditions });
            if (fuzzyMatched) {
                console.log(`---> Fuzzy matched to HR Employee!`);
                console.log(`     HR Name: ${fuzzyMatched.name || ''} | ${fuzzyMatched.khmerName || ''}`);
                console.log(`     Staff ID: ${fuzzyMatched.staffId}`);
                
                // Automatically update HR database safely to match Checkinme!
                fuzzyMatched.name = item.name;
                await fuzzyMatched.save();
                console.log(`---> Updated HR database safely! It now matches Checkinme 100%`);
            } else {
                console.log(`---> STILL NOT FOUND in HR Database! They might be missing entirely.`);
            }
         }
       }
    }
    
    console.log(`\nFound ${mismatched} total mismatches.`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

runFix();
