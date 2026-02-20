import mongoose from 'mongoose';

const ShiftGroupSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  department: {
    type: String,
    required: true,
    trim: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  subgroups: [{
    name: {
      type: String,
      required: true
    },
    employees: [{
      type: String,
      required: true
    }],
    employeeCount: {
      type: Number,
      default: 0
    }
  }],
  shifts: [{
    title: {
      type: String,
      required: true
    },
    start: {
      type: String,
      default: ''
    },
    end: {
      type: String,
      default: ''
    }
     ,
     dayOffOnWeekendOrHoliday: {
       type: Boolean,
       default: false
     }
    ,
    // Persist extra frontend fields so notes and colors survive save/load
    shortTitle: {
      type: String,
      default: ''
    },
    note: {
      type: String,
      default: ''
    },
    notes: {
      type: String,
      default: ''
    },
    color: {
      type: String,
      default: ''
    },
    categoryId: {
      type: String,
      default: ''
    },
    // New: per-day weekend work flags (split Saturday/Sunday)
    weekendWorkSaturday: {
      type: Boolean,
      default: false
    },
    weekendWorkSunday: {
      type: Boolean,
      default: false
    },
    // New: work on official holidays
    holidayWork: {
      type: Boolean,
      default: false
    }
  }],
  totalEmployees: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String,
    default: 'system'
  },
  updatedBy: {
    type: String,
    default: 'system'
  }
}, {
  timestamps: true
});

// Index for efficient queries
ShiftGroupSchema.index({ department: 1, isActive: 1 });
ShiftGroupSchema.index({ createdAt: -1 });

export default mongoose.model('ShiftGroup', ShiftGroupSchema);