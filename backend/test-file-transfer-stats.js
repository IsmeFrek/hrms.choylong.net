// Demo script to test file transfer statistics aggregation
// Run with: node test-file-transfer-stats.js

import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import the FileTransfer model
const FileTransferSchema = new mongoose.Schema({
  type: String,
  letterNo: String,
  source: String,
  date: Date,
  content: String,
  meta: {
    feedbackStages: { type: Object, default: {} }, // Stage assignments (S, S1, S2, etc.)
    CourseNote: String,     // S stage feedback
    Course1Note: String,    // S1 stage feedback  
    Course2Note: String,    // S2 stage feedback
    Course3Note: String,    // S3 stage feedback
    Course4Note: String,    // S4 stage feedback
    Course5Note: String,    // S5 stage feedback
    Course6Note: String,    // S6 stage feedback
    CourseDate: Date,
    Course1Date: Date,
    Course2Date: Date,
    Course3Date: Date,
    Course4Date: Date,
    Course5Date: Date,
    Course6Date: Date
  }
}, { timestamps: true });

const FileTransfer = mongoose.model('FileTransfer', FileTransferSchema);

// Statistics aggregation function
async function getFileTransferStats() {
  console.log('🔍 Fetching file transfer statistics...\n');

  // Get all file transfers
  const fileTransfers = await FileTransfer.find({}).lean();
  
  let completed = 0;      // រួចរាល់ - has completed stages
  let notCompleted = 0;   // មិនទាន់រួច - has assigned stages but not completed
  let noFeedback = 0;     // មិនមានផ្ញើមតិ - no feedback stages assigned
  
  // Stage sequence for checking completion
  const stageSequence = ['S6', 'S5', 'S4', 'S3', 'S2', 'S1', 'S'];
  const stageNoteKeys = {
    'S': 'CourseNote',
    'S1': 'Course1Note',
    'S2': 'Course2Note', 
    'S3': 'Course3Note',
    'S4': 'Course4Note',
    'S5': 'Course5Note',
    'S6': 'Course6Note'
  };

  console.log(`📊 Processing ${fileTransfers.length} file transfers...\n`);

  // Process each file transfer
  fileTransfers.forEach((fileTransfer, index) => {
    const meta = fileTransfer.meta || {};
    const feedbackStages = meta.feedbackStages || {};
    
    // Check if any stages are assigned
    const hasAssignedStages = Object.keys(feedbackStages).some(key => 
      feedbackStages[key] && String(feedbackStages[key]).trim() !== ''
    );
    
    if (!hasAssignedStages) {
      // No feedback stages assigned
      noFeedback++;
      console.log(`📄 ${index + 1}. ${fileTransfer.type || 'N/A'} - ${fileTransfer.letterNo || 'N/A'} → មិនមានផ្ញើមតិ`);
      return;
    }
    
    // Check for completed stages (has feedback notes)
    let hasCompletedStage = false;
    let completedStageInfo = null;
    
    for (const stageKey of stageSequence) {
      const noteKey = stageNoteKeys[stageKey];
      if (noteKey && meta[noteKey] && String(meta[noteKey]).trim()) {
        hasCompletedStage = true;
        completedStageInfo = { stage: stageKey, note: meta[noteKey] };
        break;
      }
    }
    
    if (hasCompletedStage) {
      completed++;
      console.log(`✅ ${index + 1}. ${fileTransfer.type || 'N/A'} - ${fileTransfer.letterNo || 'N/A'} → រួចរាល់ (${completedStageInfo.stage})`);
    } else {
      notCompleted++;
      const assignedStages = Object.keys(feedbackStages).filter(k => feedbackStages[k]).join(', ');
      console.log(`⏳ ${index + 1}. ${fileTransfer.type || 'N/A'} - ${fileTransfer.letterNo || 'N/A'} → មិនទាន់រួច (assigned: ${assignedStages})`);
    }
  });

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 SUMMARY STATISTICS');
  console.log('='.repeat(60));
  console.log(`🔢 Total Files:           ${fileTransfers.length}`);
  console.log(`✅ Completed (រួចរាល់):    ${completed}`);
  console.log(`⏳ Not Completed (មិនទាន់រួច): ${notCompleted}`);
  console.log(`❌ No Feedback (មិនមានផ្ញើមតិ):  ${noFeedback}`);
  console.log('='.repeat(60));

  // Calculate percentages
  if (fileTransfers.length > 0) {
    console.log('\n📊 PERCENTAGES:');
    console.log(`✅ Completed:     ${Math.round((completed / fileTransfers.length) * 100)}%`);
    console.log(`⏳ Not Completed: ${Math.round((notCompleted / fileTransfers.length) * 100)}%`);
    console.log(`❌ No Feedback:   ${Math.round((noFeedback / fileTransfers.length) * 100)}%`);
  }

  return {
    summary: {
      រួចរាល់: completed,
      មិនទាន់រួច: notCompleted, 
      មិនមានផ្ញើមតិ: noFeedback,
      សរុប: fileTransfers.length
    },
    details: fileTransfers.length > 0 ? {
      completionRate: Math.round((completed / fileTransfers.length) * 100),
      pendingRate: Math.round((notCompleted / fileTransfers.length) * 100),
      noFeedbackRate: Math.round((noFeedback / fileTransfers.length) * 100)
    } : null
  };
}

// Main execution function
async function main() {
  try {
    console.log('🚀 Starting File Transfer Statistics Demo');
    console.log('==========================================\n');

    // Connect to MongoDB
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/kshf_hospital_app';
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('📊 Connected to MongoDB\n');

    // Get and display statistics
    const stats = await getFileTransferStats();

    console.log('\n🎯 API Response Format:');
    console.log(JSON.stringify(stats, null, 2));

    console.log('\n✨ Demo completed successfully!');

  } catch (error) {
    console.error('❌ Error running demo:', error);
  } finally {
    // Cleanup
    await mongoose.disconnect();
    console.log('\n📍 Disconnected from MongoDB');
    process.exit(0);
  }
}

// Run the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default getFileTransferStats;