import React from 'react';
import { 
  ClipboardPaste, Scissors, Copy, Brush, 
  Bold, Italic, Underline, Grid3X3, PaintBucket, Baseline,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  WrapText, Group, ArrowDownToLine, ArrowUpToLine,
  Percent, DollarSign, ListFilter, Search, Plus, Minus,
  Calculator, TableProperties, Palette, Save, Printer
} from 'lucide-react';

const RibbonButton = ({ icon: Icon, label, className = "", small = false }) => (
  <button className={`flex flex-col items-center justify-center hover:bg-gray-200 rounded p-1 transition-colors ${className}`}>
    <Icon className={`${small ? 'w-4 h-4' : 'w-6 h-6'} text-gray-700`} />
    {label && <span className="text-[10px] mt-1 text-gray-700">{label}</span>}
  </button>
);

const RibbonSmallButton = ({ icon: Icon, label }) => (
  <button className="flex items-center gap-1 hover:bg-gray-200 rounded px-1.5 py-0.5 transition-colors">
    <Icon className="w-3.5 h-3.5 text-gray-700" />
    {label && <span className="text-[11px] text-gray-700">{label}</span>}
  </button>
);

export default function ExcelRibbon({ onToggleStyle, activeStyles = {}, onExport, onMerge, onSave }) {
  const toggleStyle = (style) => {
    if (onToggleStyle) onToggleStyle(style);
  };
  const setStyle = (style, value) => {
    if (onToggleStyle) onToggleStyle(style, value);
  };

  return (
    <div className="w-full bg-[#F3F2F1] border-b border-gray-300 font-sans select-none flex flex-col">
      {/* Top Tabs */}
      <div className="flex bg-[#107C41] text-white pt-2 px-2 gap-1 items-end overflow-x-auto custom-scrollbar">
        <div className="px-3 py-1.5 hover:bg-[#0c5c30] text-sm cursor-pointer rounded-t-sm">File</div>
        <div className="px-3 py-1.5 bg-[#F3F2F1] text-[#107C41] text-sm cursor-pointer border-t-2 border-[#107C41] font-semibold">Home</div>
        <div className="px-3 py-1.5 hover:bg-[#0c5c30] text-sm cursor-pointer rounded-t-sm">Insert</div>
        <div className="px-3 py-1.5 hover:bg-[#0c5c30] text-sm cursor-pointer rounded-t-sm">Draw</div>
        <div className="px-3 py-1.5 hover:bg-[#0c5c30] text-sm cursor-pointer rounded-t-sm">Page Layout</div>
        <div className="px-3 py-1.5 hover:bg-[#0c5c30] text-sm cursor-pointer rounded-t-sm">Formulas</div>
        <div className="px-3 py-1.5 hover:bg-[#0c5c30] text-sm cursor-pointer rounded-t-sm">Data</div>
        <div className="px-3 py-1.5 hover:bg-[#0c5c30] text-sm cursor-pointer rounded-t-sm">Review</div>
        <div className="px-3 py-1.5 hover:bg-[#0c5c30] text-sm cursor-pointer rounded-t-sm">View</div>
        <div className="px-3 py-1.5 hover:bg-[#0c5c30] text-sm cursor-pointer rounded-t-sm">Help</div>
      </div>

      {/* Ribbon Content */}
      <div className="flex items-stretch bg-[#F3F2F1] px-1 py-1 gap-1 overflow-x-auto custom-scrollbar h-24">
        
        {/* Clipboard */}
        <div className="flex items-stretch pr-2 border-r border-gray-300">
          <div onClick={onSave} className="flex flex-col items-center justify-center p-1 hover:bg-[#107C41] hover:text-white rounded cursor-pointer min-w-[50px] transition-colors">
            <Save className="w-8 h-8 mb-1" />
            <span className="text-[10px] font-medium">Save</span>
          </div>
          <div onClick={() => window.print()} className="flex flex-col items-center justify-center p-1 hover:bg-gray-700 hover:text-white rounded cursor-pointer min-w-[50px] transition-colors ml-1">
            <Printer className="w-8 h-8 mb-1" />
            <span className="text-[10px] font-medium">Print</span>
          </div>
          <div className="flex flex-col justify-center gap-1 pl-2 border-l border-gray-200 ml-1">
            <RibbonSmallButton icon={Scissors} label="Cut" />
            <RibbonSmallButton icon={Copy} label="Copy" />
            <RibbonSmallButton icon={ClipboardPaste} label="Paste" />
          </div>
          <div className="self-end pb-1 px-1 text-gray-400 text-[10px] w-full text-center mt-auto">File & Clipboard</div>
        </div>

        {/* Font */}
        <div className="flex flex-col justify-between px-2 pr-2 border-r border-gray-300 min-w-[200px]">
          <div className="flex gap-1 mt-1">
            <select className="border border-gray-300 rounded px-1 py-0.5 text-xs bg-white flex-1 outline-none">
              <option>Khmer OS Siemreap</option>
              <option>Arial</option>
              <option>Calibri</option>
            </select>
            <select className="border border-gray-300 rounded px-1 py-0.5 text-xs bg-white w-12 outline-none">
              <option>11</option>
              <option>12</option>
              <option>14</option>
            </select>
            <div className="flex border border-gray-300 rounded bg-white overflow-hidden ml-1">
              <button className="px-1.5 py-0.5 hover:bg-gray-100 text-xs font-bold border-r border-gray-200">A^</button>
              <button className="px-1.5 py-0.5 hover:bg-gray-100 text-xs font-bold">Av</button>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <div className="flex">
              <button onClick={() => toggleStyle('bold')} className={`w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded font-bold text-gray-700 ${activeStyles.bold ? 'bg-gray-300 shadow-inner' : ''}`}>B</button>
              <button onClick={() => toggleStyle('italic')} className={`w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded italic font-serif text-gray-700 ${activeStyles.italic ? 'bg-gray-300 shadow-inner' : ''}`}>I</button>
              <button onClick={() => toggleStyle('underline')} className={`w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded underline text-gray-700 ${activeStyles.underline ? 'bg-gray-300 shadow-inner' : ''}`}>U</button>
            </div>
            <div className="w-[1px] h-4 bg-gray-300 mx-1"></div>
            <button className="w-6 h-6 flex items-center justify-center hover:bg-gray-200 rounded text-gray-700"><Grid3X3 className="w-4 h-4" /></button>
            
            {/* Background Color Picker */}
            <label className="w-6 h-6 flex flex-col items-center justify-center hover:bg-gray-200 rounded text-gray-700 relative cursor-pointer overflow-hidden">
              <PaintBucket className="w-4 h-4" />
              <input type="color" className="absolute opacity-0 w-0 h-0" onChange={(e) => setStyle('bg', e.target.value)} />
              <div className="w-3 h-1 absolute bottom-0" style={{ backgroundColor: activeStyles.bg || '#FFF' }}></div>
            </label>
            
            {/* Text Color Picker */}
            <label className="w-6 h-6 flex flex-col items-center justify-center hover:bg-gray-200 rounded text-gray-700 relative cursor-pointer overflow-hidden">
              <span className="font-bold text-sm leading-none mt-1">A</span>
              <input type="color" className="absolute opacity-0 w-0 h-0" onChange={(e) => setStyle('color', e.target.value)} />
              <div className="w-3 h-1 absolute bottom-0" style={{ backgroundColor: activeStyles.color || '#000' }}></div>
            </label>
          </div>
          <div className="text-gray-400 text-[10px] w-full text-center mt-auto pb-1">Font</div>
        </div>

        {/* Alignment */}
        <div className="flex flex-col justify-between px-2 pr-2 border-r border-gray-300 min-w-[150px]">
          <div className="flex items-start gap-3 mt-1">
            <div className="flex flex-col gap-1">
              <div className="flex gap-0.5">
                <button className="p-0.5 hover:bg-gray-200 rounded"><ArrowUpToLine className="w-3 h-3 text-gray-600" /></button>
                <button className="p-0.5 bg-gray-200 rounded"><AlignJustify className="w-3 h-3 text-gray-600" /></button>
                <button className="p-0.5 hover:bg-gray-200 rounded"><ArrowDownToLine className="w-3 h-3 text-gray-600" /></button>
              </div>
              <div className="flex gap-0.5">
                <button onClick={() => setStyle('align', 'left')} className={`p-0.5 hover:bg-gray-200 rounded ${activeStyles.align === 'left' ? 'bg-gray-300 shadow-inner' : ''}`}><AlignLeft className="w-3 h-3 text-gray-600" /></button>
                <button onClick={() => setStyle('align', 'center')} className={`p-0.5 hover:bg-gray-200 rounded ${activeStyles.align === 'center' ? 'bg-gray-300 shadow-inner' : ''}`}><AlignCenter className="w-3 h-3 text-gray-600" /></button>
                <button onClick={() => setStyle('align', 'right')} className={`p-0.5 hover:bg-gray-200 rounded ${activeStyles.align === 'right' ? 'bg-gray-300 shadow-inner' : ''}`}><AlignRight className="w-3 h-3 text-gray-600" /></button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <button onClick={() => toggleStyle('wrapText')} className={`flex items-center gap-1 hover:bg-gray-200 rounded px-1 py-0.5 ${activeStyles.wrapText ? 'bg-gray-300 shadow-inner' : ''}`}>
                <WrapText className="w-3 h-3 text-blue-600" />
                <span className="text-[11px] text-gray-700">Wrap Text</span>
              </button>
              <button onClick={onMerge} className="flex items-center gap-1 hover:bg-gray-200 rounded px-1 py-0.5">
                <Group className="w-3 h-3 text-blue-600" />
                <span className="text-[11px] text-gray-700">Merge & Center</span>
              </button>
            </div>
          </div>
          <div className="text-gray-400 text-[10px] w-full text-center mt-auto pb-1">Alignment</div>
        </div>

        {/* Number */}
        <div className="flex flex-col justify-between px-2 pr-2 border-r border-gray-300 min-w-[120px]">
           <div className="flex flex-col gap-1 mt-1">
             <select className="border border-gray-300 rounded px-1 py-0.5 text-xs bg-white w-full outline-none">
              <option>General</option>
              <option>Number</option>
              <option>Currency</option>
            </select>
            <div className="flex items-center gap-1 mt-1">
              <button className="p-1 hover:bg-gray-200 rounded"><DollarSign className="w-4 h-4 text-gray-600" /></button>
              <button className="p-1 hover:bg-gray-200 rounded"><Percent className="w-4 h-4 text-gray-600" /></button>
              <button className="p-1 hover:bg-gray-200 rounded font-serif font-bold text-gray-600 text-sm leading-none">,</button>
            </div>
           </div>
           <div className="text-gray-400 text-[10px] w-full text-center mt-auto pb-1">Number</div>
        </div>
        
        {/* Styles & Cells */}
        <div className="flex items-stretch px-2 pr-2 border-r border-gray-300 gap-2">
           <div className="flex flex-col items-center justify-center hover:bg-gray-200 p-1 rounded cursor-pointer min-w-[60px]">
             <Palette className="w-6 h-6 text-blue-500 mb-1" />
             <span className="text-[10px] text-gray-600 leading-tight text-center">Conditional<br/>Formatting</span>
           </div>
           <div className="flex flex-col items-center justify-center hover:bg-gray-200 p-1 rounded cursor-pointer min-w-[60px]">
             <TableProperties className="w-6 h-6 text-blue-500 mb-1" />
             <span className="text-[10px] text-gray-600 leading-tight text-center">Format as<br/>Table</span>
           </div>
           
           {/* Cell Previews Mock */}
           <div className="flex flex-col gap-1 my-auto bg-white p-1 border border-gray-200 rounded-md">
             <div className="flex gap-1">
               <div className="border border-gray-300 bg-white px-2 py-0.5 text-[10px] text-gray-700">Normal</div>
               <div className="border border-red-200 bg-red-100 px-2 py-0.5 text-[10px] text-red-800">Bad</div>
               <div className="border border-green-200 bg-green-100 px-2 py-0.5 text-[10px] text-green-800">Good</div>
             </div>
           </div>
           
           <div className="flex flex-col justify-end pb-1 text-gray-400 text-[10px] w-full text-center">Styles</div>
        </div>

        {/* Editing */}
        <div className="flex items-stretch px-2 pr-2">
          <div className="flex flex-col items-center justify-center hover:bg-gray-200 p-1 rounded cursor-pointer min-w-[50px]">
             <Calculator className="w-6 h-6 text-blue-600 mb-1" />
             <span className="text-[10px] text-gray-600">AutoSum</span>
          </div>
          <div className="flex flex-col justify-center gap-1 pl-1">
            <RibbonSmallButton icon={ArrowDownToLine} label="Fill" />
            <RibbonSmallButton icon={Brush} label="Clear" />
          </div>
          <div className="flex flex-col justify-center gap-1 pl-2">
            <div className="flex flex-col items-center justify-center hover:bg-gray-200 p-1 rounded cursor-pointer">
              <ListFilter className="w-5 h-5 text-gray-600 mb-0.5" />
              <span className="text-[10px] text-gray-600 leading-tight text-center">Sort &<br/>Filter</span>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-1 pl-2">
            <div className="flex flex-col items-center justify-center hover:bg-gray-200 p-1 rounded cursor-pointer">
              <Search className="w-5 h-5 text-gray-600 mb-0.5" />
              <span className="text-[10px] text-gray-600 leading-tight text-center">Find &<br/>Select</span>
            </div>
          </div>
          <div className="flex flex-col justify-end pb-1 text-gray-400 text-[10px] w-full text-center">Editing</div>
        </div>

      </div>
    </div>
  );
}
