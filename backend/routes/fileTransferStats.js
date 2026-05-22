import express from 'express';
import FileTransfer from '../models/FileTransfer.js';
import { authRequired } from '../middleware/auth.js';

const router = express.Router();

// GET /file-transfer-stats - aggregated statistics for file transfer statuses
router.get('/file-transfer-stats', authRequired, async (req, res, next) => {
  try {
    // Get all file transfers
    const fileTransfers = await FileTransfer.find({}).lean().exec();
    
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

    fileTransfers.forEach(fileTransfer => {
      const meta = fileTransfer.meta || {};
      const feedbackStages = meta.feedbackStages || {};
      
      // Check if any stages are assigned
      const hasAssignedStages = Object.keys(feedbackStages).some(key => 
        feedbackStages[key] && String(feedbackStages[key]).trim() !== ''
      );
      
      if (!hasAssignedStages) {
        // No feedback stages assigned
        noFeedback++;
        return;
      }
      
      // Check for completed stages (has feedback notes)
      let hasCompletedStage = false;
      for (const stageKey of stageSequence) {
        const noteKey = stageNoteKeys[stageKey];
        if (noteKey && meta[noteKey] && String(meta[noteKey]).trim()) {
          hasCompletedStage = true;
          break;
        }
      }
      
      if (hasCompletedStage) {
        completed++;
      } else {
        notCompleted++;
      }
    });

    // Additional breakdown by document type if needed
    const typeBreakdown = {};
    fileTransfers.forEach(ft => {
      const type = ft.type || ft.title || ft.letter_type || 'មិនកំណត់';
      if (!typeBreakdown[type]) {
        typeBreakdown[type] = { completed: 0, notCompleted: 0, noFeedback: 0, total: 0 };
      }
      
      const meta = ft.meta || {};
      const feedbackStages = meta.feedbackStages || {};
      const hasAssignedStages = Object.keys(feedbackStages).some(key => 
        feedbackStages[key] && String(feedbackStages[key]).trim() !== ''
      );
      
      if (!hasAssignedStages) {
        typeBreakdown[type].noFeedback++;
      } else {
        let hasCompletedStage = false;
        for (const stageKey of stageSequence) {
          const noteKey = stageNoteKeys[stageKey];
          if (noteKey && meta[noteKey] && String(meta[noteKey]).trim()) {
            hasCompletedStage = true;
            break;
          }
        }
        
        if (hasCompletedStage) {
          typeBreakdown[type].completed++;
        } else {
          typeBreakdown[type].notCompleted++;
        }
      }
      
      typeBreakdown[type].total++;
    });

    res.json({
      summary: {
        រួចរាល់: completed,
        មិនទាន់រួច: notCompleted, 
        មិនមានផ្ញើមតិ: noFeedback,
        សរុប: fileTransfers.length
      },
      typeBreakdown
    });

  } catch (err) {
    console.error('Error fetching file transfer stats:', err);
    next(err);
  }
});

// GET /file-transfer-stats/detailed - detailed breakdown with records
router.get('/file-transfer-stats/detailed', authRequired, async (req, res, next) => {
  try {
    const { status } = req.query; // 'completed', 'notCompleted', 'noFeedback'
    
    const fileTransfers = await FileTransfer.find({})
      .select('_id no type title letterNo source date content meta createdAt')
      .lean()
      .exec();
    
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

    const categorizedRecords = {
      completed: [],
      notCompleted: [],
      noFeedback: []
    };

    fileTransfers.forEach(ft => {
      const meta = ft.meta || {};
      const feedbackStages = meta.feedbackStages || {};
      
      const hasAssignedStages = Object.keys(feedbackStages).some(key => 
        feedbackStages[key] && String(feedbackStages[key]).trim() !== ''
      );
      
      const contentTrimmed = (ft.content || ft.title || '').substring(0, 100);

      if (!hasAssignedStages) {
        categorizedRecords.noFeedback.push({
          _id: ft._id,
          no: ft.no || '',
          type: ft.type,
          letterNo: ft.letterNo || 'មិនមាន',
          source: ft.source,
          date: ft.date || ft.createdAt,
          content: contentTrimmed,
          status: 'មិនមានផ្ញើមតិ'
        });
        return;
      }
      
      let hasCompletedStage = false;
      let completedStageInfo = null;
      let commented = [];
      let pending = [];
      
      for (const [key, val] of Object.entries(feedbackStages)) {
        if (!val || String(val).trim() === '') continue;
        const upperKey = String(key).toUpperCase();
        const noteKey = stageNoteKeys[upperKey];
        if (noteKey && meta[noteKey] && String(meta[noteKey]).trim() !== '') {
          commented.push(upperKey);
          hasCompletedStage = true;
          if (!completedStageInfo) {
            completedStageInfo = {
              stage: upperKey,
              note: meta[noteKey],
              date: meta[noteKey.replace('Note', 'Date')]
            };
          }
        } else {
          pending.push(upperKey);
        }
      }
      
      const record = {
        _id: ft._id,
        no: ft.no || '',
        type: ft.type,
        letterNo: ft.letterNo || 'មិនមាន',
        source: ft.source,
        date: ft.date || ft.createdAt,
        content: contentTrimmed,
        assignedStages: Object.keys(feedbackStages).filter(k => feedbackStages[k]),
        commented,
        pending
      };
      
      if (hasCompletedStage && pending.length === 0) {
        categorizedRecords.completed.push({
          ...record,
          status: 'រួចរាល់',
          lastCompletedStage: completedStageInfo
        });
      } else if (hasCompletedStage && pending.length > 0) {
        categorizedRecords.notCompleted.push({
          ...record,
          status: 'មិនទាន់រួច'
        });
      } else {
        categorizedRecords.notCompleted.push({
          ...record,
          status: 'មិនទាន់រួច'
        });
      }
    });

    // Return filtered results if status specified
    if (status && categorizedRecords[status]) {
      res.json({
        status,
        records: categorizedRecords[status],
        total: categorizedRecords[status].length
      });
    } else {
      // Return all categorized
      res.json({
        all: categorizedRecords,
        summary: {
          រួចរាល់: categorizedRecords.completed.length,
          មិនទាន់រួច: categorizedRecords.notCompleted.length,
          មិនមានផ្ញើមតិ: categorizedRecords.noFeedback.length
        }
      });
    }

  } catch (err) {
    console.error('Error fetching detailed file transfer stats:', err);
    next(err);
  }
});

export default router;