RULES = [
    # Income — checked first so payroll/tax deposits aren't misread as transfers
    ("Income", [
        "payroll", "direct dep", "salary", "ach deposit",
        "zelle from", "venmo from",
        "irs treas", "tax ref", "nysttaxrfd", "tax rfd",
        "interest paid", "monthly interest",
        "refund", "check deposit",
        "byu refund", "edipymnts", "edi pymnts",
        "usaa", "insurance refund",
    ]),
    # Transfers — internal moves between own accounts and credit card payments
    ("Transfer", [
        "withdrawal to ",       # Capital One: "Withdrawal to Account XXXXXXX"
        "capital one mobile pmt",
        "capital one online pmt",
        "payment thank",
        "autopay",
        "online payment",
        "mobile payment",
        "zelle to",
        "venmo to",
        "funds tran",           # wire / internal funds transfer
    ]),
    # Rent & Housing
    ("Rent & Housing", [
        "yardi", "tpm, inc", "tpm inc", "resident",
        "rent", "lease", "landlord", "property mgmt",
    ]),
    # Utilities & Bills
    ("Utilities", [
        "provo city", "billpay",
        "questargas", "questar gas",
        "google fiber",
        "electric", "dominion", "pepco", "conedison", "electricity",
        "water bill", "gas bill", "sewage",
        "comcast", "xfinity", "verizon", "at&t", "t-mobile", "sprint",
        "internet", "cable ", "phone bill",
    ]),
    # Groceries
    ("Groceries", [
        "winco", "winco foods",
        "smiths food", "smith's food",
        "whole foods", "trader joe", "kroger", "giant", "safeway", "publix",
        "aldi", "lidl", "wegmans", "harris teeter", "food lion",
        "shoprite", "stop & shop", "grocery",
        "costco", "sam's club", "bj's",
        "walmart supercenter", "walmart grocery", "wm supercenter",
    ]),
    # Dining & Restaurants
    ("Dining", [
        "taco bell", "chick fil a", "chick-fil-a",
        "five sushi", "sushi brother",
        "cubbys", "cubby",
        "blue line deli",
        "java junkie",
        "hruska",
        "bakery",
        "creamery",
        "library cafe",
        "cougar express",
        "restaurant", "cafe", "coffee", "pizza", "burger", "sushi",
        "grill", "diner",
        "mcdonald", "chipotle", "subway", "starbucks", "dunkin", "panera",
        "domino", "papa john", "wendy's", "popeyes", "shake shack",
        "five guys",
        "doordash", "uber eats", "grubhub", "postmates",
        "ihop", "applebee", "olive garden", "outback", "cheesecake factory",
        "south end market",
    ]),
    # Gas & Fuel
    ("Gas & Fuel", [
        "maverik",
        "shell", "bp ", "exxon", "chevron", "sunoco", "mobil ",
        "speedway", "wawa gas", "sheetz", "circle k gas",
        "gas station", "fuel",
    ]),
    # Transportation
    ("Transportation", [
        "clipper systems",      # transit card top-up
        "airgarage",
        "park sundance honk", "honk",
        "parking",
        "uber", "lyft", "taxi", "transit", "metro", "bus ",
        "toll", "ezpass",
        "zipcar", "enterprise rent", "hertz", "avis", "budget rent",
    ]),
    # Education
    ("Education", [
        "brigham young", "byu",
        "myeducator",
        "ww norton", "norton co",
        "textbook", "tuition",
        "faithmatters",
        "mtc ",                 # Missionary Training Center (BYU-adjacent)
    ]),
    # Subscriptions & Streaming
    ("Subscriptions", [
        "perplexity",
        "spotify",
        "netflix", "hulu", "disney+", "hbo",
        "apple music", "amazon prime",
        "youtube", "peacock", "paramount",
        "apple one", "icloud", "apple com bill",
        "google one",
        "adobe", "microsoft 365", "dropbox", "notion", "chatgpt", "openai",
        "membership", "subscription",
    ]),
    # Shopping
    ("Shopping", [
        "butora", "hmhoutdoor", "outdoor",
        "amazon", "target", "walmart", "best buy",
        "macy's", "nordstrom", "tj maxx", "marshalls", "ross ",
        "gap ", "h&m", "zara", "old navy", "forever 21",
        "home depot", "lowe's", "ikea", "wayfair", "etsy", "ebay",
        "apple store", "microsoft store",
        "nintendo",
        "7 eleven", "7-eleven",
    ]),
    # Entertainment
    ("Entertainment", [
        "fandango",
        "movie", "cinema", "amc ", "regal ", "theater", "concert",
        "ticketmaster", "eventbrite",
        "bowling", "arcade", "dave & buster", "topgolf",
        "museum", "zoo ", "aquarium",
        "sundance",
    ]),
    # Health & Medical
    ("Health & Medical", [
        "walgreens", "cvs", "rite aid", "pharmacy", "rx ", "prescription",
        "doctor", "hospital", "clinic", "dental", "vision", "optometrist",
        "health insurance", "copay", "medical",
    ]),
    # Fitness
    ("Fitness", [
        "planet fitness", "equinox", "24 hour fitness", "anytime fitness",
        "la fitness", "crossfit", "peloton", "yoga", "pilates",
    ]),
    # Travel & Hotels
    ("Travel", [
        "airline", "delta", "united", "american air", "southwest", "jetblue",
        "spirit air", "frontier", "airbnb", "vrbo", "hotel",
        "marriott", "hilton", "hyatt", "expedia", "booking.com", "kayak",
    ]),
    # Pet
    ("Pet", [
        "petco", "petsmart", "veterinary", "vet ", "banfield", "chewy",
        "animal hospital",
    ]),
    # Home & Garden
    ("Home & Garden", [
        "ace hardware", "menards", "garden",
        "plumber", "electrician", "contractor",
    ]),
    # Savings & Investments
    ("Savings & Investments", [
        "robinhood", "fidelity", "vanguard", "schwab", "tdameritrade",
        "etrade", "coinbase", "401k",
    ]),
    # Fees & Charges — bank fees, NSF, monthly service charges
    ("Fees & Charges", [
        "elevated checking fee",
        "non-sufficient funds", "nsf fee", "returned item fee",
        "overdraft fee", "overdraft protection",
        "monthly fee", "annual fee", "service charge",
        "late fee", "foreign transaction",
        "atm fee", "wire transfer fee",
    ]),
]


def categorize(description: str, raw_capital_one_category: str = "", merchant_rules: list = None) -> str:
    text = description.lower()

    # Merchant rules take highest priority — learned from manual corrections
    if merchant_rules:
        for rule in merchant_rules:
            if rule["pattern"] in text:
                return rule["category"]

    for category, keywords in RULES:
        for kw in keywords:
            if kw in text:
                return category

    # Fall back to the bank's own category label (Capital One and UCCU both provide one)
    if raw_capital_one_category:
        raw = raw_capital_one_category.lower()
        fallback_map = {
            # Capital One credit card labels
            "food & drink":      "Dining",
            "groceries":         "Groceries",
            "gas":               "Gas & Fuel",
            "travel":            "Travel",
            "entertainment":     "Entertainment",
            "health":            "Health & Medical",
            "shopping":          "Shopping",
            "bills & utilities": "Utilities",
            "automotive":        "Gas & Fuel",
            "education":         "Education",
            "transfer":          "Transfer",
            "payment":           "Transfer",
            "fees":              "Fees & Charges",
            # UCCU classification labels
            "food & dining":     "Dining",
            "fast food":         "Dining",
            "fees & charges":    "Fees & Charges",
            "banking fee":       "Fees & Charges",
            "income":            "Income",
        }
        for key, mapped in fallback_map.items():
            if key in raw:
                return mapped

    return "Other"


ALL_CATEGORIES = sorted({cat for cat, _ in RULES} | {"Other", "Uncategorized", "Fees & Charges"})
