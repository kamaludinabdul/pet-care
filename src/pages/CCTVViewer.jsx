import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Camera, Clock, PawPrint, Home, AlertTriangle, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import Hls from 'hls.js';
import { getLiveStreamUrl } from '../services/ezvizService';

const CCTVViewer = () => {
    const { token } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [accessData, setAccessData] = useState(null);
    const [hlsUrl, setHlsUrl] = useState(null);
    const videoRef = useRef(null);
    const hlsRef = useRef(null);

    // Initialize HLS Player
    useEffect(() => {
        if (!hlsUrl || !videoRef.current) return;

        const video = videoRef.current;

        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true, // Try to keep low latency but...
                backBufferLength: 90,
                maxBufferLength: 30, // Increase buffer from default
                maxMaxBufferLength: 600,
                manifestLoadingTimeOut: 20000, // Be more patient
                levelLoadingTimeOut: 20000,
                fragLoadingTimeOut: 20000,
                startLevel: -1 // Auto quality selection
            });

            hls.loadSource(hlsUrl);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log('HLS manifest parsed, attempting to play');
                video.play().catch(e => console.log('Autoplay prevented:', e));
            });

            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS Error:', data);
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log('Network error, trying to recover');
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log('Media error, trying to recover');
                            hls.recoverMediaError();
                            break;
                        default:
                            setError('error');
                            hls.destroy();
                            break;
                    }
                }
            });

            hlsRef.current = hls;

            return () => {
                if (hlsRef.current) {
                    hlsRef.current.destroy();
                }
            };
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            video.src = hlsUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e => console.log('Autoplay prevented:', e));
            });
        } else {
            console.error('HLS is not supported in this browser');
            setError('error');
        }
    }, [hlsUrl]);

    // Update validation logic to include ezvizToken
    const validateToken = async () => {
        setLoading(true);
        setError(null);

        try {
            // 1. Find token in cctv_tokens collection
            const tokenQuery = query(
                collection(db, 'cctv_tokens'),
                where('token', '==', token)
            );
            const tokenSnap = await getDocs(tokenQuery);

            if (tokenSnap.empty) {
                setError('invalid');
                setLoading(false);
                return;
            }

            const tokenData = { id: tokenSnap.docs[0].id, ...tokenSnap.docs[0].data() };

            // 2. Check if token is expired
            const now = new Date();
            const validUntil = new Date(tokenData.validUntil);
            if (now > validUntil) {
                setError('expired');
                setLoading(false);
                return;
            }

            // 3. Get booking details
            const bookingRef = doc(db, 'bookings', tokenData.bookingId);
            const bookingSnap = await getDoc(bookingRef);

            if (!bookingSnap.exists()) {
                setError('booking_not_found');
                setLoading(false);
                return;
            }

            const booking = { id: bookingSnap.id, ...bookingSnap.data() };

            // 4. Check booking status (must be checked_in or confirmed)
            if (!['checked_in', 'confirmed'].includes(booking.status)) {
                setError('booking_ended');
                setLoading(false);
                return;
            }

            // 5. Get room and camera info
            let roomName = 'Room';
            let cameraSerial = null;
            let cameraChannel = 1;
            let cameraCode = ''; // Verification code for encrypted cameras

            if (tokenData.roomId) {
                const roomRef = doc(db, 'rooms', tokenData.roomId);
                const roomSnap = await getDoc(roomRef);
                if (roomSnap.exists()) {
                    const room = roomSnap.data();
                    roomName = room.name;
                    cameraSerial = room.cameraSerial;
                    cameraChannel = room.cameraChannel || 1;
                    const storeId = room.storeId || tokenData.storeId; // Use room's storeId as fallback or primary

                    // Fetch verification code from device data
                    if (cameraSerial && storeId) {
                        const deviceQuery = query(
                            collection(db, 'cctv_devices'),
                            where('storeId', '==', storeId),
                            where('serialNumber', '==', cameraSerial)
                        );
                        console.log('Looking for device:', { storeId, serialNumber: cameraSerial });
                        const deviceSnap = await getDocs(deviceQuery);

                        if (!deviceSnap.empty) {
                            const deviceData = deviceSnap.docs[0].data();
                            cameraCode = deviceData.verificationCode || '';
                            console.log('Device found, verification code:', cameraCode ? '***' + cameraCode.slice(-2) : '(empty)', 'Full:', cameraCode);
                        } else {
                            console.warn('Device not found in cctv_devices collection');
                        }
                    } else {
                        console.warn('Missing serial or storeId for device lookup', { cameraSerial, storeId });
                    }

                    console.log('Room data:', { roomName, cameraSerial, cameraChannel, hasCode: !!cameraCode });
                }
            }

            // 6. Get HLS stream URL from EZVIZ API
            if (cameraSerial) {
                try {
                    let ezvizAccessToken = tokenData.ezvizToken;

                    // If no token stored or it might be expired, fetch a fresh one
                    if (!ezvizAccessToken) {
                        console.log('No stored EZVIZ token, fetching fresh one...');
                        const settingsRef = doc(db, 'cctv_settings', tokenData.storeId);
                        const settingsSnap = await getDoc(settingsRef);

                        if (settingsSnap.exists()) {
                            const settings = settingsSnap.data();
                            if (settings.appKey && settings.appSecret) {
                                const { getAccessToken } = await import('../services/ezvizService');
                                const tokenResponse = await getAccessToken(settings.appKey, settings.appSecret);
                                if (tokenResponse.code === '200' && tokenResponse.data) {
                                    ezvizAccessToken = tokenResponse.data.accessToken;
                                    console.log('Fresh EZVIZ token obtained');
                                }
                            }
                        }
                    }

                    if (!ezvizAccessToken) {
                        console.error('No EZVIZ access token available');
                        setError('error');
                        return;
                    }

                    const areaDomain = import.meta.env.DEV ? '/api/ezviz' : 'https://open.ys7.com';

                    console.log('Fetching HLS stream URL for camera:', cameraSerial, 'with code:', cameraCode || '(empty)');
                    const streamResponse = await getLiveStreamUrl(
                        areaDomain,
                        ezvizAccessToken,
                        cameraSerial,
                        cameraChannel,
                        cameraCode
                    );

                    console.log('Stream response:', JSON.stringify(streamResponse, null, 2));

                    if (streamResponse.code === '200' && streamResponse.data) {
                        // EZVIZ returns HLS URL in data.url
                        const hlsStreamUrl = streamResponse.data.url;
                        console.log('HLS URL obtained:', hlsStreamUrl);
                        setHlsUrl(hlsStreamUrl);
                    } else if (streamResponse.code === '20007') {
                        // Device is offline
                        console.log('Camera device is offline (code 20007)');
                        setError('camera_offline');
                    } else if (streamResponse.code === '10002') {
                        // Token expired, try to get a fresh one
                        console.log('Token expired (10002), fetching fresh token...');
                        const settingsRef = doc(db, 'cctv_settings', tokenData.storeId);
                        const settingsSnap = await getDoc(settingsRef);

                        if (settingsSnap.exists()) {
                            const settings = settingsSnap.data();
                            if (settings.appKey && settings.appSecret) {
                                const { getAccessToken } = await import('../services/ezvizService');
                                const freshTokenResponse = await getAccessToken(settings.appKey, settings.appSecret);
                                if (freshTokenResponse.code === '200' && freshTokenResponse.data) {
                                    const freshToken = freshTokenResponse.data.accessToken;
                                    console.log('Retrying with fresh token');

                                    // Retry stream URL fetch with fresh token
                                    const retryResponse = await getLiveStreamUrl(
                                        areaDomain,
                                        freshToken,
                                        cameraSerial,
                                        cameraChannel,
                                        cameraCode
                                    );

                                    if (retryResponse.code === '200' && retryResponse.data) {
                                        setHlsUrl(retryResponse.data.url);
                                        console.log('Stream URL obtained with fresh token');
                                    } else {
                                        console.error('Failed even with fresh token. Response:', JSON.stringify(retryResponse, null, 2));
                                        setError('error');
                                    }
                                }
                            }
                        }
                    } else {
                        console.error('Failed to get stream URL. Response:', JSON.stringify(streamResponse, null, 2));
                        setError('error');
                    }
                } catch (streamErr) {
                    console.error('Error fetching stream URL:', streamErr);
                    setError('error');
                }
            }

            setAccessData({
                petName: booking.petName,
                roomName,
                checkIn: booking.startDate,
                checkOut: booking.endDate,
                validUntil: tokenData.validUntil,
                cameraSerial,
                ezvizToken: tokenData.ezvizToken
            });

        } catch (err) {
            console.error('Error validating token:', err);
            setError('error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        validateToken();
    }, [token]);

    // ... [Render Logic Update Below] ...


    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center p-8">
                    <div className="animate-pulse space-y-4">
                        <Camera className="h-12 w-12 mx-auto text-indigo-400" />
                        <p className="text-slate-600">Memvalidasi akses...</p>
                    </div>
                </Card>
            </div>
        );
    }

    if (error) {
        const errorMessages = {
            invalid: {
                title: 'Link Tidak Valid',
                message: 'Link CCTV yang Anda gunakan tidak valid atau sudah tidak aktif.',
                icon: AlertTriangle
            },
            expired: {
                title: 'Akses Berakhir',
                message: 'Periode akses CCTV untuk booking ini sudah berakhir.',
                icon: Clock
            },
            booking_not_found: {
                title: 'Booking Tidak Ditemukan',
                message: 'Data booking tidak ditemukan dalam sistem.',
                icon: AlertTriangle
            },
            booking_ended: {
                title: 'Booking Sudah Selesai',
                message: 'Hewan peliharaan Anda sudah check-out. Akses CCTV tidak tersedia.',
                icon: CheckCircle
            },
            camera_offline: {
                title: 'Kamera Sedang Offline',
                message: 'Kamera CCTV sedang tidak terhubung. Silakan hubungi pet care atau coba lagi nanti.',
                icon: AlertTriangle
            },
            error: {
                title: 'Terjadi Kesalahan',
                message: 'Gagal memuat stream CCTV. Silakan coba lagi nanti.',
                icon: AlertTriangle
            }
        };

        const errorInfo = errorMessages[error] || errorMessages.error;
        const IconComponent = errorInfo.icon;

        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
                <Card className="w-full max-w-md text-center">
                    <CardContent className="p-8 space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
                            <IconComponent className="h-8 w-8 text-amber-600" />
                        </div>
                        <h1 className="text-xl font-bold text-slate-800">{errorInfo.title}</h1>
                        <p className="text-slate-600">{errorInfo.message}</p>
                        <p className="text-xs text-slate-400 pt-4">
                            Jika Anda merasa ini adalah kesalahan, silakan hubungi Pet Care.
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 to-slate-900 p-4">
            <div className="max-w-4xl mx-auto space-y-4">
                {/* Header Info */}
                <Card className="bg-white/10 backdrop-blur-lg border-white/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between text-white">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center">
                                    <PawPrint className="h-5 w-5" />
                                </div>
                                <div>
                                    <h1 className="font-bold">{accessData?.petName}</h1>
                                    <div className="flex items-center gap-2 text-sm text-white/70">
                                        <Home className="h-3 w-3" />
                                        {accessData?.roomName}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right text-sm text-white/70">
                                <div>Check-in: {accessData?.checkIn && format(new Date(accessData.checkIn), 'dd MMM', { locale: idLocale })}</div>
                                <div>Check-out: {accessData?.checkOut && format(new Date(accessData.checkOut), 'dd MMM', { locale: idLocale })}</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Video Player */}
                <Card className="overflow-hidden bg-black aspect-video">
                    {accessData?.cameraSerial ? (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900 relative">
                            {/* HLS Video Player */}
                            <video
                                ref={videoRef}
                                className="w-full h-full absolute inset-0 object-contain bg-black"
                                controls
                                playsInline
                                autoPlay
                                muted
                            />

                            {/* Loading Overlay */}
                            {!hlsUrl && (
                                <div className="z-10 text-center text-white space-y-4 p-8">
                                    <Camera className="h-16 w-16 mx-auto text-indigo-400" />
                                    <p className="text-lg font-medium">Loading stream...</p>
                                    <p className="text-sm text-slate-400">Fetching camera feed...</p>
                                </div>
                            )}
                        </div>

                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-900">
                            <div className="text-center text-white space-y-2">
                                <AlertTriangle className="h-12 w-12 mx-auto text-amber-400" />
                                <p>Camera belum dikonfigurasi untuk room ini.</p>
                            </div>
                        </div>
                    )}
                </Card>

                {/* Footer */}
                <div className="text-center text-white/50 text-xs py-4">
                    <p>Akses valid hingga: {accessData?.validUntil && format(new Date(accessData.validUntil), 'dd MMM yyyy HH:mm', { locale: idLocale })}</p>
                    <p className="mt-2">Powered by KULA Pet Care</p>
                </div>
            </div>
        </div>
    );
};

export default CCTVViewer;
