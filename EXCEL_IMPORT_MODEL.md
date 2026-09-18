# Excel Student Import Model

Use `public/student-accounts-template.xlsx` as the model.

## Student columns
- Student ID: optional; if blank, the system generates one.
- Full Name: required.
- Email: required and unique.
- Password: required, minimum 8 characters.
- Phone: optional/valid phone format.
- System: `general` or `azhar`.
- Grade: `Preparatory 1`, `Preparatory 2`, `Preparatory 3`, `Secondary 1`, `Secondary 2`, or `Secondary 3`.
- Group ID is the group code, not the internal database ID.

## Group codes
### General
1 = Preparatory 1
2 = Preparatory 2
3 = Preparatory 3
4 = Secondary 1
5 = Secondary 2
6 = Secondary 3

### Azhar
1A = Preparatory 1
2A = Preparatory 2
3A = Preparatory 3
4A = Secondary 1
5A = Secondary 2
6A = Secondary 3
