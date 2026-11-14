import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { qrDownloadImage } from '../../utils/qrDownload'
import { studentRequest } from './studentApi'
export default function StudentQR({
    accessToken
}) {
    const [data, setData] = useState(null),
        [image, setImage] = useState(''),
        [downloadImage, setDownloadImage] = useState(''),
        [error, setError] = useState('')
    useEffect(() => {
        const controller = new AbortController()
        studentRequest('qr', accessToken, undefined, controller.signal).then(async result => {
            const value = result.data
            const png = value.qr_token ? await QRCode.toDataURL(value.qr_token, {
                width: 400,
                margin: 3,
                errorCorrectionLevel: 'M'
            }) : ''
            const download = png ? await qrDownloadImage(png, value.profile) : ''
            if (!controller.signal.aborted) {
                setData(value)
                setImage(png)
                setDownloadImage(download)
                setError('')
            }
        }).catch(err => {
            if (err.name !== 'AbortError') {
                setError(err.message)
            }
        })
        return () => {
            return controller.abort()
        }
    }, [accessToken])
    return <section className="student-panel student-qr">
        <h2>My Student QR Code</h2>
        {error ? <p
            role="alert"
            className="account-error"
        >{error}</p> : !data ? <p>Loading your QR…</p> : <>
            <h3>{data.profile.full_name}</h3><p>{data.profile.student_number}</p><p>{data.profile.course} · {data.profile.year_level} · {data.profile.section}</p>
            {image ? <><img
                src={image}
                width="320"
                height="320"
                alt={`Assigned QR code for ${data.profile.student_number}`}
            />
                <p>Display this QR to the organization scanner. It is your assigned code; downloading it does not change it.</p>
                <a
                    className="student-button"
                    href={downloadImage}
                    download={`QR-${data.profile.student_number}.png`}
                >Download QR (PNG)</a></> : <p role="alert">Your QR code is {data.qr_token_status === 'REVOKED' ? 'revoked' : 'unavailable'}. Contact the administrator for assistance.</p>}
        </>}
    </section>
}
