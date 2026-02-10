# Welcome to Matcha

## Introduction
**Matcha** is an *AI-Assisted Bank Statement Reconciliation System* aims to reduce manual processing time while improving accuracy. Given user-uploaded bank statement and receipts, Matcha automatically extract structured transaction data using a Vision Language Model (VLM), eliminating the need for traditional Optical Character Recognition (OCR) and Natural Language Processing (NLP) pipline. Matcha then reconciles each bank transaction with its corresponding receipt, flags discrepancies, and triggers an alert workflow for administrative review - ensuring accuracy while keeping a human in the loop.

## How to use
To begin using Matha as an end user, head over to our website [working title], start by making an admin account (Google SSO or email and password signup). Upload your first reconciliation task documents which must includes:

- Bank statement (PDFs)
- Receipts (PDFs or scanned images)

Once uploaded, our system will start processing these documents in parallel: batch extracting data from receipts and bank statement. After a brief period, you will be served a cleaned, digitized report of the reconcilition task which can be edit, review and export as a CSV file. 

!!! note "If you are a developer, head over to our [developer guide](dev-guides.md) for more information on Matcha underlying system."

## FAQ
??? question "What is Matcha?"
    Matcha is an **AI-assisted bank statement reconciliation system** that automates the extraction, matching, and validation of transactions between bank statements and receipts. It reduces manual effort while improving reconciliation accuracy.
    
??? question "How is Matcha different from traditional OCR-based systems?"
    Traditional systems rely on separate OCR and NLP pipelines, which can be brittle and error-prone. Matcha replaces these steps with a single **Vision Language Model** that understands both visual layout and semantic context, resulting in more accurate and robust data extraction.
    
??? question "What is being process by AI?"
    Matcha use Vision Language Model (VLM) enhanced data extraction of Language Model on images input. Matcha will only parse **receipts data** using VLM, bank statements use a different pipeline that ensure data integrity and absolute accuracy being working directly with the PDF metadata. 
    
    **All data sent to VLM has no data retention policy and will not be used for model training.**
    
??? question "What types of documents does Matcha support?"
    Matcha supports common bank statement formats and receipt types, including **PDFs** and **scanned images**. The system is designed to handle variations in layout, formatting, and image quality.
    
??? question "What data does Matcha extract?"
    Matcha extracts structured transaction data such as **transaction amount, date, and merchant name**. The extracted data is stored in a database for reconciliation, reporting, and auditing purposes.
    
??? question "Can Matcha generate reports?"
    **Yes**. After reconciliation, Matcha can generate expense and reconciliation reports that summarize matched transactions, discrepancies, and review status.

??? question "How secure is the data processed by Matcha?"
    **Matcha is designed with data security in mind**. Uploaded documents and extracted data can be processed and stored using standard encryption, role-based access control, and auditing practices.
