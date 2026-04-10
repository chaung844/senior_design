# Matcha User Guide

> AI-Assisted Bank Statement Reconciliation System

---

## Welcome to Matcha

Matcha helps you reconcile bank statements with receipts using AI. Upload your bank statements and receipts, and Matcha will automatically match transactions, flag discrepancies, and provide AI-powered insights for unmatched items.

---

## Getting Started

### Logging In

1. Go to the Matcha website
2. Click **Log In** on the landing page
3. Enter your email and password
4. Click **Sign In**

> **Note:** New user registration is currently closed during active development. Contact your administrator to get an account.

### Your First Login

After logging in, you will be taken to the **Dashboard**. If you have multiple bank accounts set up, you will see your first account by default. Use the sidebar on the left to switch between accounts.

---

## Understanding the Dashboard

### Navigation

The left sidebar shows your **account books** organized by year and month:

- Click an **account name** to see all years of data
- Click a **year** to see a monthly breakdown
- Click a **month** to see individual transactions

The URL in your browser updates as you navigate, so you can bookmark specific views or share links with teammates.

### Breadcrumb Bar

At the top of the main content area, a breadcrumb shows your current location (e.g., **Account Name > 2024 > March**). Click any part of the breadcrumb to navigate back.

---

## User Roles

Your role determines what you can do in Matcha:

| Role | What You Can Do |
|------|----------------|
| **Admin** | Upload documents, edit data, run reconciliation, manage accounts and members |
| **Developer** | All admin capabilities plus manage tenants and user accounts |
| **Viewer** | Browse data and view reports only (read-only mode) |

> **Viewers:** If you have a Viewer role, you will see an amber banner at the top of the dashboard reminding you that you are in read-only mode.

---

## Uploading Documents

### Uploading a Bank Statement

1. Navigate to the account you want to upload for
2. Click the **Upload** button in the dashboard
3. Select **Bank Statement** as the document type
4. Drag and drop your PDF file, or click to browse
5. Wait for the upload to complete

The system will begin parsing your statement automatically. You can track progress using the **Job Status** widget in the bottom-right corner.

### Uploading Receipts

1. Click the **Upload** button in the dashboard
2. Select **Receipt** as the document type
3. Drag and drop your receipt image(s), or click to browse
4. (Optional) Link the receipt to an existing statement
5. Wait for the upload to complete

Receipts are parsed using AI to extract vendor, date, amount, and line items.

### Upload Progress

After uploading, a floating widget appears in the bottom-right corner showing:

- **Parsing jobs:** Shows how many documents have been processed
- **Reconciliation jobs:** Shows matching progress

Completed jobs disappear after 15 seconds. You can collapse the widget if you prefer.

---

## Viewing Your Data

### Account Level

Shows an overview of all years for the selected account:

- Total transactions per year
- Match rate (percentage of transactions matched to receipts)
- Visual charts showing spending trends

### Year Level

Shows a monthly breakdown for the selected year:

- Monthly transaction counts
- Monthly match rates
- Charts comparing income vs. expenses

### Month Level

Shows the detailed transaction table for the selected month:

- **Transaction list** with date, description, amount, and match status
- **AI Reconciliation Summary** tab with insights on unmatched transactions
- Sortable columns and pagination

---

## Understanding Match Status

Each transaction is labeled with a match status:

| Status | Meaning |
|--------|---------|
| **Unmatched** | No matching receipt found |
| **Perfect Matched** | One receipt matches this transaction exactly |
| **Bundle Matched** | Multiple receipts together match this transaction |
| **Manual** | Matched manually by a user |

---

## Running Reconciliation

Reconciliation matches your bank statement transactions to uploaded receipts.

### How to Run Reconciliation

1. Navigate to the **month** you want to reconcile
2. Click the **Reconcile** button
3. Wait for the process to complete (progress shown in the Job Status widget)
4. Review the results in the transaction table and AI Summary tab

### What Happens During Reconciliation

1. Matcha compares each transaction to available receipts
2. Transactions are matched based on amount, date, and vendor similarity
3. AI analyzes unmatched transactions and provides suggestions
4. Results are displayed in your dashboard

---

## AI Reconciliation Summary

After reconciliation, switch to the **AI Summary** tab in the month view to see:

- Analysis of unmatched transactions
- Possible reasons why transactions did not match
- Suggestions for resolving discrepancies

This is especially useful for investigating transactions that need manual review.

---

## Editing Data

### Correcting a Transaction

1. Navigate to the month containing the transaction
2. Find the transaction in the table
3. Click on the transaction to open the edit dialog
4. Make your corrections
5. Save changes

> **Viewers:** Editing is not available in read-only mode.

### Correcting a Receipt

1. Find the receipt you want to edit
2. Open the receipt detail view
3. Click **Edit**
4. Update the parsed information
5. Save changes

---

## Managing Accounts

### Viewing Accounts

Your available accounts appear in the left sidebar. Click any account to view its data.

### Account Members (Admin Only)

Admins can add or remove members from an account:

1. Go to account settings
2. View current members
3. Add new members by email
4. Remove members as needed

---

## Statement Archival

Statements are automatically archived after a set retention period (default: 18 months). When a statement is archived:

- Original files are removed from storage
- All transaction data and matches are preserved
- The statement cannot be edited or used for new reconciliation
- You can still view the transaction data in the dashboard

> Archival happens automatically. There is no action required from you.

---

## Developer Console (Developers Only)

If you have a Developer role, you can access the **Developer Console** to:

- View all tenants and their account books
- Manage user accounts (create, edit, deactivate)
- Assign roles and permissions
- Manage account book memberships

Access the console from the dashboard landing page or via the direct link.

---

## Logging Out

Click the **Logout** button in the sidebar to end your session.

---

## Troubleshooting

### Common Issues

| Issue | What to Do |
|-------|-----------|
| **Upload seems stuck** | Check the Job Status widget. If it shows an error, try uploading again. |
| **No data showing** | Make sure you have selected the correct account, year, and month in the sidebar. |
| **Cannot edit data** | Check if you have a Viewer role (look for the amber banner). Contact an admin for edit access. |
| **Cannot log in** | Verify your email and password. Contact your administrator if you do not have an account. |
| **Reconciliation not completing** | Ensure receipts have been uploaded and fully parsed before running reconciliation. |

### Match Status Tips

- **High unmatched rate:** Upload more receipts for the period
- **Bundle matches:** Multiple small receipts may combine to match a single transaction
- **Manual matches:** Review and confirm manually matched transactions are correct

---

## Tips for Best Results

1. **Upload statements first** before uploading receipts for the same period
2. **Use clear, readable PDFs** for bank statements
3. **Upload complete receipt images** — blurry or cropped images may not parse correctly
4. **Run reconciliation after all documents are parsed** — check the Job Status widget
5. **Review the AI Summary** for unmatched transactions before manually correcting
6. **Bookmark important views** — the URL reflects your current location in the dashboard

---

## Glossary

| Term | Definition |
|------|-----------|
| **Account Book** | A bank account you are tracking |
| **Bank Statement** | A monthly statement from your bank showing all transactions |
| **Receipt** | A proof of purchase that gets matched to a bank transaction |
| **Transaction** | A single line item on your bank statement |
| **Reconciliation** | The process of matching transactions to receipts |
| **Match Rate** | The percentage of transactions that have been matched to receipts |
| **Job** | A background task (parsing or reconciliation) running in the system |

---

## Need Help?

Contact your system administrator or the Matcha development team for assistance.
