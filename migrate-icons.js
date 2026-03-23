const fs = require('fs');
const path = require('path');

const iconMap = {
  DownloadOutlined: 'Download', InfoCircleFilled: 'Info', CheckCircleFilled: 'CheckCircle', 
  ExclamationCircleFilled: 'AlertCircle', CloseCircleFilled: 'XCircle', UserOutlined: 'User', 
  CopyOutlined: 'Copy', CloseOutlined: 'X', CaretDownOutlined: 'ChevronDown', 
  CaretRightOutlined: 'ChevronRight', SettingOutlined: 'Settings', SendOutlined: 'Send', 
  UnorderedListOutlined: 'List', HistoryOutlined: 'History', PlayCircleOutlined: 'PlayCircle', 
  LoadingOutlined: 'Loader2', ArrowRightOutlined: 'ArrowRight', CloseCircleOutlined: 'XCircle', 
  RobotOutlined: 'Bot', CheckOutlined: 'Check', EditOutlined: 'Edit', EyeOutlined: 'Eye', 
  ThunderboltOutlined: 'Zap', PlusOutlined: 'Plus', MinusCircleFilled: 'MinusCircle', 
  MinusCircleOutlined: 'MinusCircle', ReloadOutlined: 'RefreshCw', QuestionCircleOutlined: 'HelpCircle', 
  BookOutlined: 'Book', LinkOutlined: 'Link', FullscreenExitOutlined: 'Minimize', 
  AppstoreOutlined: 'LayoutGrid', DesktopOutlined: 'Monitor', MoreOutlined: 'MoreHorizontal', 
  DownOutlined: 'ChevronDown', FolderOpenOutlined: 'FolderOpen', PlusCircleOutlined: 'PlusCircle', 
  FolderOutlined: 'Folder', FileOutlined: 'File', CheckCircleOutlined: 'CheckCircle', 
  DeleteOutlined: 'Trash2', InfoCircleOutlined: 'Info', CodeOutlined: 'Code', FrownOutlined: 'Frown', 
  MinusSquareOutlined: 'MinusSquare', UpCircleOutlined: 'ArrowUpCircle', PushpinOutlined: 'Pin', 
  SearchOutlined: 'Search', FullscreenOutlined: 'Maximize', PaperClipOutlined: 'Paperclip', 
  ApartmentOutlined: 'Network', HeartOutlined: 'Heart', SunOutlined: 'Sun', MoonOutlined: 'Moon', 
  KeyOutlined: 'Key', LaptopOutlined: 'Laptop', ImportOutlined: 'Import', ExportOutlined: 'Upload', 
  ArrowDownOutlined: 'ArrowDown', ArrowUpOutlined: 'ArrowUp', SaveOutlined: 'Save', 
  ClearOutlined: 'Delete', EyeInvisibleFilled: 'EyeOff', EyeFilled: 'Eye', HomeOutlined: 'Home', 
  StarOutlined: 'Star', PlusSquareOutlined: 'PlusSquare', UpOutlined: 'ChevronUp', 
  FilterOutlined: 'Filter', EditFilled: 'Edit', ClockCircleOutlined: 'Clock', BookFilled: 'Book', 
  GithubOutlined: 'Github', GlobalOutlined: 'Globe', HighlightOutlined: 'Highlighter', 
  WarningOutlined: 'AlertTriangle', AlignLeftOutlined: 'AlignLeft', BugOutlined: 'Bug', 
  ArrowsAltOutlined: 'Maximize2', ShrinkOutlined: 'Shrink', SelectOutlined: 'Pointer', 
  PauseCircleOutlined: 'PauseCircle', SwapOutlined: 'ArrowLeftRight', 
  VerticalAlignTopOutlined: 'ArrowUpToLine', BorderHorizontalOutlined: 'SplitSquareHorizontal', 
  SwitcherOutlined: 'PanelLeft', CloudDownloadOutlined: 'CloudDownload', 
  CloudUploadOutlined: 'CloudUpload', CheckSquareOutlined: 'CheckSquare', ContainerOutlined: 'Box', 
  EnterOutlined: 'CornerDownLeft', FileAddOutlined: 'FilePlus', FileExcelOutlined: 'FileSpreadsheet', 
  FolderAddOutlined: 'FolderPlus', LockOutlined: 'Lock', FileZipOutlined: 'FileArchive', 
  CodeFilled: 'Code', RightSquareFilled: 'ArrowRightSquare', LeftOutlined: 'ChevronLeft', 
  RightOutlined: 'ChevronRight', LayoutOutlined: 'Layout', Loading3QuartersOutlined: 'Loader', 
  BorderlessTableOutlined: 'LayoutList', MinusOutlined: 'Minus', ArrowLeftOutlined: 'ArrowLeft', 
  BarsOutlined: 'Menu', DatabaseOutlined: 'Database', ApiOutlined: 'Network', 
  PartitionOutlined: 'Share2', MenuOutlined: 'Menu', MergeOutlined: 'Merge', 
  RightSquareOutlined: 'ArrowRightSquare', EllipsisOutlined: 'MoreHorizontal',
  DisconnectOutlined: 'Unplug', WifiOutlined: 'Wifi', DesktopOutlined: 'Monitor'
};

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(getFiles(file));
    } else { 
      if(file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.ts') || file.endsWith('.tsx')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = getFiles('src/client');
let count = 0;

files.forEach(f => {
  let content = fs.readFileSync(f, 'utf8');
  if (content.includes('@ant-design/icons')) {
    // 1. replace imports
    content = content.replace(/import\s+\{([^}]+)\}\s+from\s+'@ant-design\/icons'/g, (match, icons) => {
      let iconList = icons.split(',').map(i => i.trim()).filter(Boolean);
      let newIcons = iconList.map(item => {
        let parts = item.split(/\s+as\s+/);
        let name = parts[0];
        let alias = parts[0];
        if (parts.length > 1) {
            alias = parts[1];
        }
        let mapped = iconMap[name] || name;
        if(mapped !== alias) {
           return `${mapped} as ${alias}`;
        }
        return mapped;
      });
      newIcons = [...new Set(newIcons)];
      return `import { ${newIcons.join(', ')} } from 'lucide-react'`;
    });

    for (const [antdIcon, lucideIcon] of Object.entries(iconMap)) {
      if (antdIcon !== lucideIcon) {
        let reOpen = new RegExp(`<${antdIcon}(\\s|>)`, 'g');
        content = content.replace(reOpen, `<${lucideIcon}$1`);
        
        // Match closing tag carefully (the escaping \/ must be exact)
        let reClose = new RegExp(`</${antdIcon}>`, 'g');
        content = content.replace(reClose, `</${lucideIcon}>`);
      }
    }
    
    // Also Antd icons sometimes have component={Icon} which is rare but possible, 
    // And spin attribute is different in Lucide. Let's do a basic spin conversion if it's there.
    
    fs.writeFileSync(f, content, 'utf8');
    count++;
  }
});
console.log('Migration complete, updated ' + count + ' files.');

