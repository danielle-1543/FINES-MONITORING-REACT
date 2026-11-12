import * as XLSX from 'xlsx'
export function createExportWorkbook(result) {
    const columns = Object.entries(result.columns)
    const values = [columns.map(([, label]) => {
        return label
    }), ...result.data.map(row => {
        return columns.map(([key]) => {
            const value = row[key]
            return ['fine_amount', 'total_fine', 'amount', 'paid_amount', 'pending_amount', 'outstanding', 'total_violations', 'total_absences'].includes(key) && value !== null && value !== undefined ? Number(value) : String(value ?? '')
        })
    })]
    const sheet = XLSX.utils.aoa_to_sheet(values)
    sheet['!cols'] = columns.map(([, label]) => {
        return {
            wch: Math.max(16, Math.min(32, label.length + 4))
        }
    })
    sheet['!autofilter'] = {
        ref: sheet['!ref']
    }
    if (result.totals) {
        const totalRow = columns.map(([key]) => result.totals[key] ?? '')
        XLSX.utils.sheet_add_aoa(sheet, [totalRow], { origin: values.length })
        values.push(totalRow)
    }
    columns.forEach(([key], column) => {
        if (['fine_amount', 'total_fine', 'amount', 'paid_amount', 'pending_amount', 'outstanding'].includes(key)) {
            for (let row = 1; row < values.length; row++) {
                const cell = sheet[XLSX.utils.encode_cell({
                    r: row,
                    c: column
                })]
                if (cell) {
                    cell.z = '#,##0.00'
                }
            }
        }
    })
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Records')
    return book
}
export function downloadExcel(result, filename) {
    XLSX.writeFile(createExportWorkbook(result), filename, {
        bookType: 'xlsx',
        compression: true
    })
}
