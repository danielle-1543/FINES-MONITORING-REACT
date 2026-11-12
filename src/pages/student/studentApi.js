import { apiRequest } from '../../utils/apiRequest'
export function studentRequest(path, accessToken, body, signal) {
    return apiRequest(`/api/student/${path}`, accessToken, body, signal, {
        invalidResponseMessage: 'Unable to read the API response.'
    })
}
