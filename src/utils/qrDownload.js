// The QR token stays unchanged. Add readable academic context outside its quiet zone.
export async function qrDownloadImage(dataUrl, student) {
    const image = new Image()
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error('Unable to prepare QR download.')); image.src = dataUrl })
    const canvas = document.createElement('canvas')
    canvas.width = 480; canvas.height = 560
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to prepare QR download.')
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 40, 20, 400, 400)
    context.fillStyle = '#17271b'; context.textAlign = 'center'
    context.font = 'bold 20px Arial'; context.fillText(student.student_number, 240, 452, 440)
    context.font = '18px Arial'; context.fillText(student.full_name, 240, 482, 440)
    context.font = '16px Arial'; context.fillText('Academic Year / Semester', 240, 514, 440)
    context.fillText(student.academic_period_label || 'Not assigned', 240, 540, 440)
    return canvas.toDataURL('image/png')
}
