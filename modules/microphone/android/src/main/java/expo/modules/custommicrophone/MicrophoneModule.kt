package expo.modules.custommicrophone

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.util.Base64
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive
import java.io.File
import java.io.FileInputStream

private const val MICROPHONE_PERMISSION_REQUEST_CODE = 1002
private const val SAMPLE_RATE = 44100
private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
private const val CHUNK_SIZE = 4096 // 청크 크기 (바이트)

class MicrophoneModule : Module() {
    private var audioRecord: AudioRecord? = null
    private var recordingJob: Job? = null
    private var isStreaming = false
    private val coroutineScope = CoroutineScope(Dispatchers.IO)
    private val context: Context
        get() = appContext.reactContext ?: throw IllegalStateException("React context is null")

    override fun definition() = ModuleDefinition {
        Name("Microphone")

        Events("onAudioChunk")

        OnCreate {
            // 모듈 초기화
        }

        OnDestroy {
            cleanup()
        }

        // 권한 확인
        AsyncFunction("checkMicrophonePermission") { promise: Promise ->
            try {
                val micGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

                promise.resolve(mapOf(
                    "granted" to micGranted,
                    "status" to if (micGranted) "granted" else "denied"
                ))
            } catch (e: Exception) {
                Log.e("MicrophoneModule", "checkMicrophonePermission error", e)
                promise.resolve(mapOf("granted" to false, "status" to "error"))
            }
        }

        // 권한 요청
        AsyncFunction("requestMicrophonePermission") { promise: Promise ->
            try {
                val activity = appContext.currentActivity
                if (activity == null) {
                    promise.resolve(mapOf("granted" to false, "status" to "unavailable"))
                    return@AsyncFunction
                }

                val micGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

                if (micGranted) {
                    promise.resolve(mapOf(
                        "granted" to true,
                        "status" to "granted"
                    ))
                    return@AsyncFunction
                }

                // 권한 요청
                activity.requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), MICROPHONE_PERMISSION_REQUEST_CODE)

                promise.resolve(mapOf(
                    "granted" to false,
                    "status" to "requesting"
                ))
            } catch (e: Exception) {
                Log.e("MicrophoneModule", "requestMicrophonePermission error", e)
                promise.resolve(mapOf("granted" to false, "status" to "error"))
            }
        }

        // 녹음 시작
        AsyncFunction("startRecording") { promise: Promise ->
            try {
                if (isStreaming) {
                    promise.resolve(mapOf("success" to false, "error" to "Already streaming"))
                    return@AsyncFunction
                }

                // 권한 확인
                val micGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                if (!micGranted) {
                    promise.resolve(mapOf("success" to false, "error" to "Microphone permission not granted"))
                    return@AsyncFunction
                }

                val minBufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
                if (minBufferSize == AudioRecord.ERROR || minBufferSize == AudioRecord.ERROR_BAD_VALUE) {
                    promise.resolve(mapOf("success" to false, "error" to "Audio recording not supported"))
                    return@AsyncFunction
                }

                val bufferSize = minBufferSize * 2

                audioRecord = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    AudioRecord.Builder()
                        .setAudioSource(MediaRecorder.AudioSource.MIC)
                        .setAudioFormat(AudioFormat.Builder()
                            .setSampleRate(SAMPLE_RATE)
                            .setChannelMask(CHANNEL_CONFIG)
                            .setEncoding(AUDIO_FORMAT)
                            .build())
                        .setBufferSizeInBytes(bufferSize)
                        .build()
                } else {
                    @Suppress("DEPRECATION")
                    AudioRecord(
                        MediaRecorder.AudioSource.MIC,
                        SAMPLE_RATE,
                        CHANNEL_CONFIG,
                        AUDIO_FORMAT,
                        bufferSize
                    )
                }

                audioRecord?.startRecording()
                isStreaming = true

                // 백그라운드에서 오디오 스트리밍
                recordingJob = coroutineScope.launch {
                    streamAudio()
                }

                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e("MicrophoneModule", "startRecording error", e)
                cleanup()
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }

        // 녹음 중지
        AsyncFunction("stopRecording") { promise: Promise ->
            try {
                if (!isStreaming) {
                    promise.resolve(mapOf("success" to false, "error" to "Not streaming"))
                    return@AsyncFunction
                }

                cleanup()
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e("MicrophoneModule", "stopRecording error", e)
                cleanup()
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }

        // 마이크 상태 조회
        AsyncFunction("getMicrophoneStatus") { promise: Promise ->
            try {
                promise.resolve(mapOf(
                    "isStreaming" to isStreaming,
                    "hasMicrophone" to true
                ))
            } catch (e: Exception) {
                Log.e("MicrophoneModule", "getMicrophoneStatus error", e)
                promise.resolve(mapOf(
                    "isStreaming" to false,
                    "hasMicrophone" to false
                ))
            }
        }
    }

    private fun streamAudio() {
        val audioData = ByteArray(CHUNK_SIZE)
        var chunkNumber = 0

        while (isStreaming && recordingJob?.isActive == true) {
            try {
                val readSize = audioRecord?.read(audioData, 0, CHUNK_SIZE) ?: 0
                if (readSize > 0) {
                    chunkNumber++
                    
                    // PCM 데이터를 base64로 인코딩
                    val base64Data = Base64.encodeToString(audioData, 0, readSize, Base64.NO_WRAP)
                    
                    // 이벤트 전송
                    this@MicrophoneModule.sendEvent("onAudioChunk", mapOf(
                        "type" to "audioChunk",
                        "base64" to base64Data,
                        "chunkSize" to readSize,
                        "chunkNumber" to chunkNumber,
                        "timestamp" to System.currentTimeMillis(),
                        "sampleRate" to SAMPLE_RATE,
                        "encoding" to "pcm_16bit"
                    ))
                }
            } catch (e: Exception) {
                Log.e("MicrophoneModule", "streamAudio error", e)
                break
            }
        }
    }

    private fun cleanup() {
        try {
            isStreaming = false
            recordingJob?.cancel()
            recordingJob = null

            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
        } catch (e: Exception) {
            Log.e("MicrophoneModule", "cleanup error", e)
        }
    }
}
