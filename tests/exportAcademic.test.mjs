import test from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { createExportWorkbook } from '../src/utils/exportExcel.js'

test('all Excel reports include one academic column and preserve each historical period and numeric totals', () => {
    const workbook = createExportWorkbook({
        columns: { academic_period_label: 'Old Heading', student_number: 'Student', amount: 'Amount' },
        data: [{ academic_period_label: '2026–2027 · First Semester', student_number: 'A', amount: '25.50' },
            { academic_period_label: '2026–2027 · Second Semester', student_number: 'A', amount: '30.00' },
            { student_number: 'B', amount: '0.00' }], totals: { student_number: 'TOTAL', amount: 55.5 }
    })
    const restored = XLSX.read(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' })
    const values = XLSX.utils.sheet_to_json(restored.Sheets.Records, { header: 1, defval: '' })
    assert.deepEqual(values[0], ['Academic Year / Semester', 'Student', 'Amount'])
    assert.equal(values[1][0], '2026–2027 · First Semester')
    assert.equal(values[2][0], '2026–2027 · Second Semester')
    assert.equal(values[3][0], 'Not assigned')
    assert.equal(values[1][2], 25.5)
    assert.equal(values[4][2], 55.5)
})

test('organization master exports can declare report context without claiming an original semester', () => {
    const workbook = createExportWorkbook({ columns: { organization_name: 'Organization' },
        academic_period_label: '2026–2027 · First Semester (report context)', data: [{ organization_name: 'CCS' }] })
    assert.equal(workbook.Sheets.Records.A2.v, '2026–2027 · First Semester (report context)')
})
