import csv
import random
import sys

# רשימת דגמים לדוגמה (אלו חייבים להיות קיימים במערכת או שהיא תיצור אותם)
MODELS = [
    'iPhone 15 Pro',
    'iPhone 15', 
    'iPhone 14',
    'Galaxy S24 Ultra',
    'Galaxy S24',
    'Galaxy A55',
    'Xiaomi 14',
    'Redmi Note 13',
    'Pixel 8 Pro',
    'Pixel 8a'
]

def calculate_luhn_digit(imei_prefix):
    """מחשב את ספרת הביקורת לפי אלגוריתם Luhn"""
    total = 0
    double = True  # מתחילים מהסוף, אז הספרה הראשונה (ה-15) לא מוכפלת, השנייה כן וכו'
    
    # רצים מהסוף להתחלה על 14 הספרות
    for digit in reversed(imei_prefix):
        d = int(digit)
        if double:
            d *= 2
            if d > 9:
                d -= 9
        total += d
        double = not double
        
    return (10 - (total % 10)) % 10

def generate_imei():
    """מייצר IMEI תקין בן 15 ספרות"""
    # מייצרים 14 ספרות אקראיות
    prefix = ''.join([str(random.randint(0, 9)) for _ in range(14)])
    # מחשבים את ספרת הביקורת
    check_digit = calculate_luhn_digit(prefix)
    return prefix + str(check_digit)

def generate_csv(filename, num_rows):
    headers = ['דגם', 'IMEI1', 'IMEI2']
    
    print(f"מייצר {num_rows} רשומות לקובץ {filename}...")
    
    with open(filename, 'w', newline='', encoding='utf-8-sig') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(headers)
        
        for i in range(num_rows):
            model = random.choice(MODELS)
            imei1 = generate_imei()
            
            # ב-30% מהמקרים נוסיף גם IMEI2 (כמו בטלפונים עם סים כפול)
            imei2 = generate_imei() if random.random() < 0.3 else ''
            
            writer.writerow([model, imei1, imei2])
            
    print(f"✅ הקובץ נוצר בהצלחה: {filename}")

if __name__ == "__main__":
    try:
        # בקשת קלט מהמשתמש
        user_input = input("כמה מכשירים תרצה לייצר? (ברירת מחדל 50): ")
        count = int(user_input) if user_input.strip() else 50
        
        filename = "devices_import.csv"
        generate_csv(filename, count)
        
    except ValueError:
        print("שגיאה: נא להזין מספר תקין.")