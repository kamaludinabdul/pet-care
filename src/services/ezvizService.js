// EZVIZ Open API Service
// API Documentation: https://open.ys7.com/

// Use local proxy in development to avoid CORS
// In production, this should point to your backend server which then calls EZVIZ
const EZVIZ_API_BASE = import.meta.env.DEV ? '/api/ezviz' : 'https://open.ezvizlife.com';

/**
 * Get EZVIZ Access Token
 */
export const getAccessToken = async (appKey, appSecret) => {
    try {
        const response = await fetch(`${EZVIZ_API_BASE}/api/lapp/token/get`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `appKey=${appKey}&appSecret=${appSecret}`
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw error;
    }
};

/**
 * Get Device Info
 */
export const getDeviceInfo = async (areaDomain, accessToken, deviceSerial) => {
    try {
        const response = await fetch(`${areaDomain}/api/lapp/device/info`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `accessToken=${accessToken}&deviceSerial=${deviceSerial}`
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting device info:', error);
        throw error;
    }
};

/**
 * Get Device List
 */
export const getDeviceList = async (areaDomain, accessToken) => {
    try {
        const response = await fetch(`${areaDomain}/api/lapp/device/list`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `accessToken=${accessToken}&pageStart=0&pageSize=50`
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting device list:', error);
        throw error;
    }
};

/**
 * Get Live Stream URL
 */
export const getLiveStreamUrl = async (areaDomain, accessToken, deviceSerial, channelNo = 1, code = '') => {
    try {
        // Create URLSearchParams
        const params = new URLSearchParams();
        params.append('accessToken', accessToken);
        params.append('deviceSerial', deviceSerial);
        params.append('channelNo', channelNo.toString());
        params.append('protocol', '2'); // HLS
        params.append('quality', '1');

        // Add verification code if provided
        if (code) {
            params.append('code', code);
            // Some API versions check 'validateCode' for decryption
            params.append('validateCode', code);
        }

        console.log('EZVIZ Request Params:', params.toString());

        // Use v2 endpoint
        const url = `${areaDomain}/api/lapp/v2/live/address/get`;
        console.log('EZVIZ Request URL:', url);

        const response = await fetch(url, {
            method: 'POST',
            // IMPORTANT: Do NOT set Content-Type header manually when using URLSearchParams
            // The browser will automatically set it to 'application/x-www-form-urlencoded;charset=UTF-8'
            body: params
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error getting live stream URL:', error);
        throw error;
    }
};

/**
 * Test Connection
 */
export const testConnection = async (appKey, appSecret, deviceSerial) => {
    try {
        const tokenResponse = await getAccessToken(appKey, appSecret);

        if (tokenResponse.code !== '200') {
            return {
                success: false,
                step: 'token',
                error: tokenResponse.msg || 'Failed to get access token',
                code: tokenResponse.code
            };
        }

        const { accessToken, areaDomain } = tokenResponse.data;

        const deviceResponse = await getDeviceInfo(areaDomain, accessToken, deviceSerial);

        if (deviceResponse.code !== '200') {
            return {
                success: false,
                step: 'device',
                error: deviceResponse.msg || 'Device not found or offline',
                code: deviceResponse.code
            };
        }

        return {
            success: true,
            device: deviceResponse.data,
            accessToken,
            areaDomain
        };

    } catch (error) {
        return {
            success: false,
            step: 'network',
            error: error.message || 'Network error',
            corsLikely: error.message?.includes('Failed to fetch')
        };
    }
};
