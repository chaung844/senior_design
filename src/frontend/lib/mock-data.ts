// Mock data for Bank Reconciliation System

export type Transaction = {
    id: string;
    date: string;
    description: string;
    reference: string;
    debit: number | null;
    credit: number | null;
    balance: number;
    category: string;
    matched: boolean;
    matchConfidence: number | null; // 0-100 percentage, null if unmatched
    matchedWith: string | null; // reference to ledger entry
};

export type MonthData = {
    month: number; // 1-12
    label: string;
    transactions: Transaction[];
    totalDebit: number;
    totalCredit: number;
    openingBalance: number;
    closingBalance: number;
    matchedCount: number;
    unmatchedCount: number;
    matchRate: number; // percentage
    statementCount: number;
    reconciled: boolean;
};

export type YearData = {
    year: number;
    months: MonthData[];
    totalDebit: number;
    totalCredit: number;
    openingBalance: number;
    closingBalance: number;
    overallMatchRate: number;
    totalTransactions: number;
    totalMatched: number;
    totalUnmatched: number;
};

export type AccountBook = {
    id: string;
    name: string;
    bankName: string;
    accountNumber: string;
    currency: string;
    years: YearData[];
    createdAt: string;
    lastUpdated: string;
};

// --- Transaction generators ---

function generateTransactions(
    year: number,
    month: number,
    openingBalance: number,
): { transactions: Transaction[]; closingBalance: number } {
    const descriptions = [
        { desc: "Wire Transfer - Supplier Payment", cat: "Supplier Payment" },
        { desc: "ACH Direct Deposit - Payroll", cat: "Payroll" },
        { desc: "Check #1042 - Office Rent", cat: "Rent" },
        { desc: "POS Transaction - Office Supplies", cat: "Office Supplies" },
        { desc: "Online Transfer - Client Invoice #INV-2024", cat: "Revenue" },
        { desc: "ATM Withdrawal", cat: "Cash Withdrawal" },
        { desc: "Standing Order - Insurance Premium", cat: "Insurance" },
        {
            desc: "SWIFT Transfer - International Vendor",
            cat: "Vendor Payment",
        },
        { desc: "Direct Debit - Utility Bill", cat: "Utilities" },
        { desc: "Merchant Payment - Software License", cat: "Software" },
        { desc: "Bank Fee - Monthly Service Charge", cat: "Bank Fees" },
        { desc: "Interest Credit", cat: "Interest Income" },
        { desc: "Refund - Duplicate Payment", cat: "Refund" },
        { desc: "Wire Transfer - Tax Payment", cat: "Tax" },
        { desc: "ACH Credit - Customer Payment", cat: "Revenue" },
        { desc: "Check #1043 - Consulting Fee", cat: "Professional Services" },
        { desc: "Card Payment - Travel Expense", cat: "Travel" },
        { desc: "Transfer to Savings Account", cat: "Internal Transfer" },
        { desc: "Loan Repayment - Term Loan", cat: "Loan" },
        { desc: "Dividend Income", cat: "Investment Income" },
    ];

    const daysInMonth = new Date(year, month, 0).getDate();
    const count =
        12 + Math.floor(Math.abs(Math.sin(year * 13 + month * 7)) * 10);
    const transactions: Transaction[] = [];
    let runningBalance = openingBalance;

    for (let i = 0; i < count; i++) {
        const seed = Math.abs(
            Math.sin(year * 1000 + month * 100 + i * 37 + 0.5),
        );
        const seed2 = Math.abs(
            Math.cos(year * 777 + month * 53 + i * 19 + 0.3),
        );
        const day = Math.min(Math.floor(seed * daysInMonth) + 1, daysInMonth);
        const descIndex = Math.floor(seed2 * descriptions.length);
        const { desc, cat } = descriptions[descIndex];

        const isDebit = seed > 0.4;
        const amount = Math.round((500 + seed2 * 15000) * 100) / 100;

        const debit = isDebit ? amount : null;
        const credit = !isDebit ? amount : null;
        runningBalance = isDebit
            ? runningBalance - amount
            : runningBalance + amount;

        const isMatched = seed2 > 0.2;
        const confidence = isMatched ? Math.round(70 + seed * 30) : null;

        transactions.push({
            id: `TXN-${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(4, "0")}`,
            date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            description: desc,
            reference: `REF-${String(year).slice(2)}${String(month).padStart(2, "0")}${String(Math.floor(seed * 9000) + 1000)}`,
            debit,
            credit,
            balance: Math.round(runningBalance * 100) / 100,
            category: cat,
            matched: isMatched,
            matchConfidence: confidence,
            matchedWith: isMatched
                ? `LED-${year}-${String(month).padStart(2, "0")}-${String(Math.floor(seed2 * 900) + 100)}`
                : null,
        });
    }

    // Sort by date
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    // Recalculate running balances after sort
    let balance = openingBalance;
    for (const txn of transactions) {
        if (txn.debit) balance -= txn.debit;
        if (txn.credit) balance += txn.credit;
        txn.balance = Math.round(balance * 100) / 100;
    }

    return { transactions, closingBalance: Math.round(balance * 100) / 100 };
}

function generateMonthData(
    year: number,
    month: number,
    openingBalance: number,
): MonthData {
    const monthLabels = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    const { transactions, closingBalance } = generateTransactions(
        year,
        month,
        openingBalance,
    );

    const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
    const totalCredit = transactions.reduce(
        (sum, t) => sum + (t.credit || 0),
        0,
    );
    const matchedCount = transactions.filter((t) => t.matched).length;
    const unmatchedCount = transactions.length - matchedCount;
    const matchRate =
        transactions.length > 0
            ? Math.round((matchedCount / transactions.length) * 1000) / 10
            : 0;

    // Consider months in the past as reconciled if match rate > 90
    const now = new Date();
    const isInPast =
        new Date(year, month - 1) < new Date(now.getFullYear(), now.getMonth());
    const reconciled = isInPast && matchRate > 90;

    return {
        month,
        label: monthLabels[month - 1],
        transactions,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        openingBalance,
        closingBalance,
        matchedCount,
        unmatchedCount,
        matchRate,
        statementCount: transactions.length,
        reconciled,
    };
}

function generateYearData(year: number, openingBalance: number): YearData {
    const months: MonthData[] = [];
    let balance = openingBalance;

    // Generate up to current month for current year, all months for past years
    const now = new Date();
    const maxMonth = year < now.getFullYear() ? 12 : now.getMonth() + 1;

    for (let m = 1; m <= maxMonth; m++) {
        const monthData = generateMonthData(year, m, balance);
        months.push(monthData);
        balance = monthData.closingBalance;
    }

    const totalDebit = months.reduce((sum, m) => sum + m.totalDebit, 0);
    const totalCredit = months.reduce((sum, m) => sum + m.totalCredit, 0);
    const totalTransactions = months.reduce(
        (sum, m) => sum + m.statementCount,
        0,
    );
    const totalMatched = months.reduce((sum, m) => sum + m.matchedCount, 0);
    const totalUnmatched = months.reduce((sum, m) => sum + m.unmatchedCount, 0);
    const overallMatchRate =
        totalTransactions > 0
            ? Math.round((totalMatched / totalTransactions) * 1000) / 10
            : 0;

    return {
        year,
        months,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        openingBalance,
        closingBalance: balance,
        overallMatchRate,
        totalTransactions,
        totalMatched,
        totalUnmatched,
    };
}

// --- Credit card transaction generators ---

function generateCreditCardTransactions(
    year: number,
    month: number,
    openingBalance: number,
): { transactions: Transaction[]; closingBalance: number } {
    const descriptions = [
        { desc: "Amazon.com - Online Purchase", cat: "Online Shopping" },
        { desc: "Uber Eats - Food Delivery", cat: "Dining" },
        { desc: "Shell Gas Station #4482", cat: "Gas & Fuel" },
        { desc: "Whole Foods Market #1027", cat: "Groceries" },
        { desc: "Delta Air Lines - Flight Booking", cat: "Travel" },
        { desc: "Netflix Monthly Subscription", cat: "Entertainment" },
        { desc: "Starbucks Store #8831", cat: "Dining" },
        { desc: "Hilton Hotels - Room Charge", cat: "Travel" },
        { desc: "Apple.com - App Store", cat: "Software & Apps" },
        { desc: "Target Store #2290", cat: "Retail" },
        { desc: "Costco Wholesale #415", cat: "Groceries" },
        { desc: "Lyft Ride - Airport Transfer", cat: "Transportation" },
        { desc: "Home Depot #0643", cat: "Home Improvement" },
        { desc: "Spotify Premium", cat: "Entertainment" },
        { desc: "CVS Pharmacy #7821", cat: "Health & Pharmacy" },
        { desc: "Payment - Thank You", cat: "Payment" },
        { desc: "AutoPay Payment Received", cat: "Payment" },
        { desc: "Interest Charge - Purchases", cat: "Interest & Fees" },
        { desc: "Annual Fee", cat: "Interest & Fees" },
        { desc: "Cash Back Reward Credit", cat: "Rewards" },
        { desc: "Refund - Amazon.com Return", cat: "Refund" },
        { desc: "DoorDash - Food Delivery", cat: "Dining" },
        { desc: "Airbnb - Lodging", cat: "Travel" },
        { desc: "Google Cloud Platform", cat: "Software & Apps" },
        { desc: "Walgreens #3345", cat: "Health & Pharmacy" },
    ];

    const daysInMonth = new Date(year, month, 0).getDate();
    // Credit cards tend to have more transactions than bank accounts
    const count =
        18 + Math.floor(Math.abs(Math.sin(year * 17 + month * 11)) * 14);
    const transactions: Transaction[] = [];
    // For credit cards, balance = amount owed (positive means you owe)
    let runningBalance = openingBalance;

    for (let i = 0; i < count; i++) {
        const seed = Math.abs(
            Math.sin(year * 1100 + month * 130 + i * 41 + 0.7),
        );
        const seed2 = Math.abs(
            Math.cos(year * 830 + month * 61 + i * 23 + 0.4),
        );
        const day = Math.min(Math.floor(seed * daysInMonth) + 1, daysInMonth);
        const descIndex = Math.floor(seed2 * descriptions.length);
        const { desc, cat } = descriptions[descIndex];

        // Credit card: most transactions are charges (debits), some are payments/credits
        // Payments, rewards, and refunds are credits; everything else is a debit (charge)
        const isCreditCategory =
            cat === "Payment" || cat === "Rewards" || cat === "Refund";
        const isCharge = !isCreditCategory;

        let amount: number;
        if (cat === "Payment") {
            // Payments are larger
            amount = Math.round((1500 + seed * 5000) * 100) / 100;
        } else if (cat === "Interest & Fees") {
            amount = Math.round((25 + seed2 * 175) * 100) / 100;
        } else if (cat === "Rewards") {
            amount = Math.round((10 + seed * 80) * 100) / 100;
        } else if (cat === "Refund") {
            amount = Math.round((20 + seed2 * 200) * 100) / 100;
        } else {
            // Normal purchases
            amount = Math.round((8 + seed2 * 350) * 100) / 100;
        }

        const debit = isCharge ? amount : null;
        const credit = !isCharge ? amount : null;
        // Charges increase balance owed, payments decrease it
        runningBalance = isCharge
            ? runningBalance + amount
            : runningBalance - amount;

        const isMatched = seed2 > 0.25;
        const confidence = isMatched ? Math.round(68 + seed * 32) : null;

        transactions.push({
            id: `CC-${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(4, "0")}`,
            date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
            description: desc,
            reference: `CC-${String(year).slice(2)}${String(month).padStart(2, "0")}${String(Math.floor(seed * 9000) + 1000)}`,
            debit,
            credit,
            balance: Math.round(runningBalance * 100) / 100,
            category: cat,
            matched: isMatched,
            matchConfidence: confidence,
            matchedWith: isMatched
                ? `LED-${year}-${String(month).padStart(2, "0")}-${String(Math.floor(seed2 * 900) + 100)}`
                : null,
        });
    }

    // Sort by date
    transactions.sort((a, b) => a.date.localeCompare(b.date));

    // Recalculate running balances after sort
    let balance = openingBalance;
    for (const txn of transactions) {
        if (txn.debit) balance += txn.debit; // charges increase balance owed
        if (txn.credit) balance -= txn.credit; // payments decrease balance owed
        txn.balance = Math.round(balance * 100) / 100;
    }

    return { transactions, closingBalance: Math.round(balance * 100) / 100 };
}

function generateCreditCardMonthData(
    year: number,
    month: number,
    openingBalance: number,
): MonthData {
    const monthLabels = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
    ];

    const { transactions, closingBalance } = generateCreditCardTransactions(
        year,
        month,
        openingBalance,
    );

    const totalDebit = transactions.reduce((sum, t) => sum + (t.debit || 0), 0);
    const totalCredit = transactions.reduce(
        (sum, t) => sum + (t.credit || 0),
        0,
    );
    const matchedCount = transactions.filter((t) => t.matched).length;
    const unmatchedCount = transactions.length - matchedCount;
    const matchRate =
        transactions.length > 0
            ? Math.round((matchedCount / transactions.length) * 1000) / 10
            : 0;

    const now = new Date();
    const isInPast =
        new Date(year, month - 1) < new Date(now.getFullYear(), now.getMonth());
    const reconciled = isInPast && matchRate > 90;

    return {
        month,
        label: monthLabels[month - 1],
        transactions,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        openingBalance,
        closingBalance,
        matchedCount,
        unmatchedCount,
        matchRate,
        statementCount: transactions.length,
        reconciled,
    };
}

function generateCreditCardYearData(
    year: number,
    openingBalance: number,
): YearData {
    const months: MonthData[] = [];
    let balance = openingBalance;

    const now = new Date();
    const maxMonth = year < now.getFullYear() ? 12 : now.getMonth() + 1;

    for (let m = 1; m <= maxMonth; m++) {
        const monthData = generateCreditCardMonthData(year, m, balance);
        months.push(monthData);
        balance = monthData.closingBalance;
    }

    const totalDebit = months.reduce((sum, m) => sum + m.totalDebit, 0);
    const totalCredit = months.reduce((sum, m) => sum + m.totalCredit, 0);
    const totalTransactions = months.reduce(
        (sum, m) => sum + m.statementCount,
        0,
    );
    const totalMatched = months.reduce((sum, m) => sum + m.matchedCount, 0);
    const totalUnmatched = months.reduce((sum, m) => sum + m.unmatchedCount, 0);
    const overallMatchRate =
        totalTransactions > 0
            ? Math.round((totalMatched / totalTransactions) * 1000) / 10
            : 0;

    return {
        year,
        months,
        totalDebit: Math.round(totalDebit * 100) / 100,
        totalCredit: Math.round(totalCredit * 100) / 100,
        openingBalance,
        closingBalance: balance,
        overallMatchRate,
        totalTransactions,
        totalMatched,
        totalUnmatched,
    };
}

// --- Account books ---

export const accountBooks: AccountBook[] = [
    {
        id: "acct-001",
        name: "Main Operating Account",
        bankName: "Chase Bank",
        accountNumber: "****4821",
        currency: "USD",
        years: [
            generateYearData(2023, 125000.0),
            generateYearData(2024, 148230.55),
            generateYearData(2025, 162450.3),
        ],
        createdAt: "2023-01-15",
        lastUpdated: "2025-06-15",
    },
    {
        id: "acct-002",
        name: "Payroll Account",
        bankName: "Bank of America",
        accountNumber: "****7193",
        currency: "USD",
        years: [
            generateYearData(2024, 85000.0),
            generateYearData(2025, 92340.75),
        ],
        createdAt: "2024-01-10",
        lastUpdated: "2025-06-14",
    },
    {
        id: "acct-003",
        name: "EUR Revenue Account",
        bankName: "Deutsche Bank",
        accountNumber: "****3356",
        currency: "EUR",
        years: [
            generateYearData(2024, 210000.0),
            generateYearData(2025, 245680.2),
        ],
        createdAt: "2024-03-01",
        lastUpdated: "2025-06-13",
    },
    {
        id: "acct-004",
        name: "Savings Reserve",
        bankName: "Wells Fargo",
        accountNumber: "****9047",
        currency: "USD",
        years: [generateYearData(2025, 500000.0)],
        createdAt: "2025-01-01",
        lastUpdated: "2025-06-10",
    },
    {
        id: "acct-005",
        name: "Corporate Credit Card",
        bankName: "American Express",
        accountNumber: "****3718",
        currency: "USD",
        years: [
            generateCreditCardYearData(2024, 4250.8),
            generateCreditCardYearData(2025, 6120.45),
        ],
        createdAt: "2024-02-15",
        lastUpdated: "2025-06-15",
    },
];

// --- Selection types ---

export type SelectionLevel = "account" | "year" | "month";

export type Selection = {
    accountId: string;
    year: number | null;
    month: number | null;
    level: SelectionLevel;
};

// --- Helper functions ---

export function getAccountBook(accountId: string): AccountBook | undefined {
    return accountBooks.find((a) => a.id === accountId);
}

export function getYearData(
    accountId: string,
    year: number,
): YearData | undefined {
    const account = getAccountBook(accountId);
    return account?.years.find((y) => y.year === year);
}

export function getMonthData(
    accountId: string,
    year: number,
    month: number,
): MonthData | undefined {
    const yearData = getYearData(accountId, year);
    return yearData?.months.find((m) => m.month === month);
}

export function formatCurrency(
    amount: number,
    currency: string = "USD",
): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);
}

export function formatNumber(n: number): string {
    return new Intl.NumberFormat("en-US").format(n);
}
