import React from 'react';
import SchedulePreview from '../components/SchedulePreview';

// A lightweight page that renders a SchedulePreview in exampleLayout mode and
// exposes print/download controls for group reports.
export default function GroupReportPage({
  // optionally pass props; defaults use exampleLayout
  groupLabelMap = null,
}) {
  const labels = groupLabelMap || {
    A: 'ក្រុមគ្រូពេទ្យ',
    B: 'ថែទាំ',
    C: 'ក្រុម C',
    D: 'ក្រុម D',
    E: 'ក្រុម E',
    F: 'ក្រុម F',
    G: 'ក្រុម G',
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Report per Group (A..G)</h1>
      <SchedulePreview
        exampleLayout={true}
        exampleVariant={'A'}
        days={31}
        groupLabelMap={labels}
      />
    </div>
  );
}
