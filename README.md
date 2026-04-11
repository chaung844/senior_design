# 2025-2026 UC Computer Science Senior Capstone

```

     ^^
 ^^         ^^                ^^                         ^^
       ^^         ^^                                                          ^^
   ^^    ^^                           ^^
             ^^                                   ^^             ^^
                 _
               _(_)_                          wWWWw   _
   @@@@       (_)@(_)   vVVVv     _     @@@@  (___) _(_)_
  @@()@@ wWWWw  (_)\    (___)   _(_)_  @@()@@   Y  (_)@(_)          ^^     ^^
   @@@@  (___)     `|/    Y    (_)@(_)  @@@@   \|/   (_)\              ^^^
    /      Y       \|    \|/    /(_)    \|      |/      |     ^^^^^    \|/     ^^^^
 \ |     \ |/       | / \ | /  \|/       |/    \|      \|/   \\\|//  \\\|//    \||/
 \\|//   \\|///  \\\|//\\\|/// \|///  \\\|//  \\|//  \\\|//  \\\|//  \\\|//  \\\|//
^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^

```
## Table of Contents 
1. [Project Description](#project-description)
2. [User Interface Specification](https://github.com/chaung844/senior_design/blob/main/Documents/matcha_ui_specifications.md)
3. [Test Plan and Results](#test-plan-and-results)
4. [Matcha Docs Page](#matcha-docs-page)
5. [Link to Spring final presentation](https://docs.google.com/presentation/d/1sw_oC3WZhbq-6qRZyEqjGtKMVnaSyBNfV1IztxLbw5U/edit?slide=id.g3bee7031db0_0_0#slide=id.g3bee7031db0_0_0)
6. [Link to the final EXPO poster](https://github.com/chaung844/senior_design/blob/main/Documents/tran2tp_EXPO.pdf)
7. [Assessments](#assessments)
8. [Summary of Hours and Justification](#summary-of-hours-and-justification)
9. [Budget](./Documents/budget.md) 
10. [Appendix](#appendix)

## Project Description

### Team JaPolCha
```
     .-./`)     ____    .-------.     ,-----.      .---.        _______   .---.  .---.    ____     
     \ '_ .') .'  __ `. \  _(`)_ \  .'  .-,  '.    | ,_|       /   __  \  |   |  |_ _|  .'  __ `.  
    (_ (_) _)/   '  \  \| (_ o._)| / ,-.|  \ _ \ ,-./  )      | ,_/  \__) |   |  ( ' ) /   '  \  \ 
      / .  \ |___|  /  ||  (_,_) /;  \  '_ /  | :\  '_ '`)  ,-./  )       |   '-(_{;}_)|___|  /  | 
 ___  |-'`|     _.-`   ||   '-.-' |  _`,/ \ _/  | > (_)  )  \  '_ '`)     |      (_,_)    _.-`   | 
|   | |   '  .'   _    ||   |     : (  '\_/ \   ;(  .  .-'   > (_)  )  __ | _ _--.   | .'   _    | 
|   `-'  /   |  _( )_  ||   |      \ `"/  \  ) /  `-'`-'|___(  .  .-'_/  )|( ' ) |   | |  _( )_  | 
 \      /    \ (_ o _) //   )       '. \_/``".'    |        \`-'`-'     / (_{;}_)|   | \ (_ o _) / 
  `-..-'      '.(_,_).' `---'         '-----'      `--------`  `._____.'  '(_,_) '---'  '.(_,_).'  
                                                                                                                                                                                 
```

- [Chau Nguyen](https://github.com/chaung844) - Computer Science Senior - nguye2cu@mail.uc.edu
- [Tiep Tran](https://github.com/polskiTran) - Computer Science Senior - tran2tp@mail.uc.edu
- [Jack Nguyen](https://github.com/Jack51003) - Computer Science Senior - nguye2lo@mail.uc.edu

### Advisor
- Ryan Persaud - Project Leader at Midea - ryan.persaud@midea.com

### Project Abstract

Bank statement reconciliation is a time-consuming, error-prone task that remains largely manual for small businesses or accounting teams. Matcha addresses this challenge by combining AI-powered document parsing with configurable reconciliation algorithms to automate the matching workflow and surface actionable insights for unmatched transactions.

The system accepts bank statements and receipts document as PDF or images format, extracting structured data using vision-language models (VLM) via AWS Bedrock. Parsed transactions and receipts are then matched through a multi-pass algorithm that considers multiple signals: amount, date windows, and vendor similarity, with support for bundle matching where multiple receipts combine to satisfy a single transaction line. Unmatched items are analyzed by AI to generate human-readable summaries explaining potential discrepancies and suggesting resolution paths.

Matcha is built as a full-stack web application. The backend uses FastAPI with asynchronous SQLAlchemy, PostgreSQL for persistent storage, AWS S3 for document storage, and SQS for background job processing. The frontend is a Next.js application featuring a drill-down dashboard (Account/Year/Month/Transactions) with interactive tables, charts, and real-time job status tracking. Authentication is cookie-based with CSRF protection, and role-based access control supports admin, developer, and viewer roles.

Key features include automated statement and receipt parsing, configurable reconciliation thresholds, AI-generated unmatched transaction analysis, multi-tenant account management with member permissions, automatic statement archival after configurable retention periods, and a read-only viewer mode for auditors and stakeholders. The system is designed for deployment on AWS infrastructure with App Runner, ECS Fargate, RDS, and S3.

Matcha demonstrates how modern AI capabilities can be integrated into financial workflows to reduce manual effort while preserving human oversight for edge cases and exceptions. The project is developed as a senior capstone in partnership with industry advisor Midea.


## Test Plan and Results
[Test plan](https://github.com/chaung844/senior_design/blob/main/Documents/Matcha_Capstone_Test_Plan.pdf)

Results:
![matcha backend pytest results](Documents/matcha_backend_pytest_results.png)

## Matcha Docs Page
[Matcha dev/user doc page](https://chaung844.github.io/senior_design/)
![matcha docs page screenshot](Documents/matcha-docs-page-screenshot.png)

## Assessments

### Tiep Tran's assessments
- [Initial assessment](https://github.com/chaung844/senior_design/blob/main/Documents/Capstone_Assessments/Fall2025_assessments/TiepTran_capstone_assessment.md)
- [Final assessment](https://github.com/chaung844/senior_design/blob/main/Documents/Capstone_Assessments/Spring2026_assessments/TiepTran_final_self_assessment.md)

### Chau Nguyen's assessments
- [Initial assessment](https://github.com/chaung844/senior_design/blob/main/Documents/Capstone_Assessments/Fall2025_assessments/ChauNguyen_capstone_assessment.md)
- [Final assessment](https://github.com/chaung844/senior_design/blob/main/Documents/Capstone_Assessments/Spring2026_assessments/ChauNguyen_final_self_assessment.md)

### Jack Nguyen's assessments
- [Initial assessment](https://github.com/chaung844/senior_design/blob/main/Documents/Capstone_Assessments/Fall2025_assessments/JackNguyen_capstone_assessment.md)
- [Final assessment](https://github.com/chaung844/senior_design/blob/main/Documents/Capstone_Assessments/Spring2026_assessments/JackNguyen_final_self_assessment.md)

## Summary of Hours and Justification

- [Tiep Tran hours and justification](https://github.com/chaung844/senior_design/blob/main/Documents/Individual_Hours_Justification/TiepTran_hours.md)
- [Chau Nguyen hours and justification](https://github.com/chaung844/senior_design/blob/main/Documents/Individual_Hours_Justification/ChauNguyen_hours.md)
- [Jack Nguyen hours and justification](https://github.com/chaung844/senior_design/blob/main/Documents/Individual_Hours_Justification/JackNguyen_hours.md)

> In-person team meeting (major task blocks, update, assignment) occurs weekly after Senior Design class. Online disucssion and small task update occurs regularly thorughout the week via Discord. 

## Appendix

- [Code repo](https://github.com/chaung844/senior_design)
- [Midea project proposal slides](https://mailuc-my.sharepoint.com/:p:/g/personal/tran2tp_mail_uc_edu/Eco2b7lw3Q9Ntb0eswqJq_UBNOusbNZco1s2Mnr52X-n2A?e=bap2SZ)
- [Link to team planner used for task assignment and project tracking](https://github.com/users/chaung844/projects/1/views/3)
