#!/usr/bin/env node

/**
 * סקריפט לעדכון אוטומטי של העיצוב הצבעוני בכל העמודים
 * 
 * הסקריפט מחפש כרטיסי סטטיסטיקה ומעדכן אותם לעיצוב הצבעוני החדש
 */

const fs = require('fs');
const path = require('path');

// מיפוי צבעים לפי סוג הסטטיסטיקה
const colorMapping = {
  // מכשירים
  'סה"כ': 'blue',
  'total': 'blue',
  'חדשים': 'gray',
  'new': 'gray',
  'פעילים': 'green',
  'active': 'green',
  'פג תוקף': 'red',
  'expired': 'red',
  'הוחלפו': 'purple',
  'replaced': 'purple',
  
  // תיקונים
  'בתיקון': 'orange',
  'in_repair': 'orange',
  'בטיפול': 'orange',
  'in_progress': 'orange',
  'הושלם': 'green',
  'completed': 'green',
  'התקבל': 'blue',
  'received': 'blue',
  
  // אחריות
  'אחריות פעילה': 'green',
  'אחריות פעילות': 'green',
  'active_warranties': 'green',
  
  // בקשות
  'בקשות החלפה': 'orange',
  'replacement_requests': 'orange',
  'ממתין': 'orange',
  'pending': 'orange',
  
  // תשלומים
  'תשלומים': 'cyan',
  'payments': 'cyan',
  'הכנסות': 'purple',
  'revenue': 'purple',
};

// מיפוי אייקונים לצבעים
const iconColorMapping = {
  'Package': 'blue',
  'Shield': 'green',
  'Wrench': 'orange',
  'RefreshCw': 'purple',
  'XCircle': 'red',
  'Clock': 'orange',
  'CheckCircle': 'green',
  'AlertCircle': 'red',
  'ShekelIcon': 'purple',
  'Users': 'pink',
  'Store': 'cyan',
  'Plus': 'gray',
};

function getColorForTitle(title) {
  const lowerTitle = title.toLowerCase();
  for (const [key, color] of Object.entries(colorMapping)) {
    if (lowerTitle.includes(key.toLowerCase())) {
      return color;
    }
  }
  return 'blue'; // ברירת מחדל
}

function updateCardToColorful(cardContent, title, icon) {
  const color = getColorForTitle(title) || iconColorMapping[icon] || 'blue';
  
  // החלף את ה-Card הרגיל בכרטיס צבעוני
  let updated = cardContent;
  
  // הוסף classes לכרטיס
  updated = updated.replace(
    /<Card>/,
    `<Card className="shadow-sm hover:shadow-md transition-shadow border-r-4 border-r-${color}-500">`
  );
  
  // עדכן את האייקון לעיצוב עגול צבעוני
  const iconRegex = new RegExp(`<${icon}\\s+className="[^"]*"\\s*\\/>`);
  updated = updated.replace(
    iconRegex,
    `<div className="h-10 w-10 rounded-full bg-${color}-100 dark:bg-${color}-900 flex items-center justify-center">
              <${icon} className="h-5 w-5 text-${color}-600 dark:text-${color}-400" />
            </div>`
  );
  
  // עדכן את הערך להיות צבעוני
  updated = updated.replace(
    /className="text-2xl font-bold"/g,
    `className="text-2xl font-bold text-${color}-600"`
  );
  
  return updated;
}

function processFile(filePath) {
  console.log(`מעבד: ${filePath}`);
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;
    
    // חפש כרטיסי סטטיסטיקה פשוטים
    const cardRegex = /<Card>\s*<CardHeader[^>]*>[\s\S]*?<CardTitle[^>]*>(.*?)<\/CardTitle>[\s\S]*?<(\w+)\s+className="[^"]*"[\s\S]*?<\/Card>/g;
    
    content = content.replace(cardRegex, (match, title, icon) => {
      modified = true;
      return updateCardToColorful(match, title, icon);
    });
    
    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✓ עודכן: ${filePath}`);
      return true;
    } else {
      console.log(`- לא נדרש עדכון: ${filePath}`);
      return false;
    }
  } catch (error) {
    console.error(`✗ שגיאה בעיבוד ${filePath}:`, error.message);
    return false;
  }
}

function findPageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.next')) {
        findPageFiles(filePath, fileList);
      }
    } else if (file === 'page.tsx') {
      fileList.push(filePath);
    }
  });
  
  return fileList;
}

// הרץ את הסקריפט
console.log('🎨 מתחיל עדכון עיצוב צבעוני...\n');

const srcDir = path.join(process.cwd(), 'src', 'app');
const pageFiles = findPageFiles(srcDir);

console.log(`נמצאו ${pageFiles.length} קבצי page.tsx\n`);

let updatedCount = 0;
pageFiles.forEach(file => {
  if (processFile(file)) {
    updatedCount++;
  }
});

console.log(`\n✨ הושלם! עודכנו ${updatedCount} מתוך ${pageFiles.length} קבצים`);
