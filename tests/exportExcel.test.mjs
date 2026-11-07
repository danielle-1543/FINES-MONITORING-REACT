import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { createExportWorkbook } from '../src/utils/exportExcel.js'
const result = {
    columns: {
        course: 'Course',
        full_name: 'Full Name',
        student_number: 'Student Number',
        total_fine: 'Total Fine (PHP)'
    },
    data: [{
        course: 'CAS',
        full_name: '=1+1',
        student_number: '00001',
        total_fine: '15.25'
    }, {
        course: 'CCS',
        full_name: 'Beta',
        student_number: '00002',
        total_fine: '0.00'
    }]
}
const bytes = XLSX.write(createExportWorkbook(result), {
    type: 'buffer',
    bookType: 'xlsx'
})
assert.equal(bytes.subarray(0, 2).toString(), 'PK', 'Must generate a real zipped Excel workbook')
const book = XLSX.read(bytes, {
    type: 'buffer',
    cellStyles: true
})
const sheet = book.Sheets.Records
assert.equal(sheet.B2.t, 's', 'Formula-looking names must remain plain text')
assert.equal(sheet.B2.f, undefined)
assert.equal(sheet.C2.v, '00001', 'Leading zeros in student numbers must survive')
assert.equal(sheet.D2.t, 'n')
assert.equal(sheet.D2.v, 15.25)
assert.equal(sheet.D2.z, '#,##0.00')
assert.deepEqual(XLSX.utils.sheet_to_json(sheet, {
    header: 1
}).map(row => {
    return row[0]
}), ['Course', 'CAS', 'CCS'])
const empty = createExportWorkbook({
    columns: result.columns,
    data: []
})
assert.equal(empty.Sheets.Records.A1.v, 'Course')
console.log('PASS: Excel workbook format, text safety, numeric fines, ordering, and empty exports.')
