package expo.modules.customcamera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.YuvImage
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.util.Size
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.*
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraModule : Module() {
    // 카메라 관련 변수
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var recording: Recording? = null
    private var imageAnalyzer: ImageAnalysis? = null
    
    // 상태 변수
    private var isStreaming = false
    private var streamingEventName: String? = null
    
    // 스레드 핸들러
    private val mainHandler = Handler(Looper.getMainLooper())
    // 이미지 처리 전용 백그라운드 스레드 (UI 버벅임 방지)
    private val cameraExecutor: ExecutorService = Executors.newSingleThreadExecutor()

    // 성능 최적화: FPS 제한 (초당 약 5~10프레임)
    private var lastFrameTime = 0L
    private val TARGET_FPS = 10.0 
    private val FRAME_INTERVAL_MS = (1000.0 / TARGET_FPS).toLong()

    override fun definition() = ModuleDefinition {
        Name("Camera")

        // JS로 보낼 이벤트 정의
        Events("onCameraFrame", "onRecordingFinished", "onRecordingError")

        // 1. 권한 확인
        AsyncFunction("checkCameraPermission") { promise: Promise ->
            val context = appContext.reactContext
            if (context == null) {
                promise.resolve(mapOf("granted" to false, "status" to "unavailable"))
                return@AsyncFunction
            }

            val cameraGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
            val micGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

            promise.resolve(mapOf(
                "granted" to (cameraGranted && micGranted),
                "cameraGranted" to cameraGranted,
                "micGranted" to micGranted
            ))
        }

        // 2. 사진 촬영
        AsyncFunction("takePhoto") { promise: Promise ->
            if (imageCapture == null) {
                promise.resolve(mapOf("success" to false, "error" to "Camera not initialized"))
                return@AsyncFunction
            }

            try {
                val photoFile = File.createTempFile("photo_", ".jpg", appContext.reactContext?.cacheDir)
                val outputOptions = ImageCapture.OutputFileOptions.Builder(photoFile).build()

                imageCapture?.takePicture(
                    outputOptions,
                    cameraExecutor,
                    object : ImageCapture.OnImageSavedCallback {
                        override fun onImageSaved(output: ImageCapture.OutputFileResults) {
                            promise.resolve(mapOf("success" to true, "path" to photoFile.absolutePath))
                        }
                        override fun onError(exception: ImageCaptureException) {
                            promise.resolve(mapOf("success" to false, "error" to exception.message))
                        }
                    }
                )
            } catch (e: Exception) {
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }

        // 3. 카메라 시작 (비디오 + 스트리밍 옵션)
        AsyncFunction("startCamera") { facing: String, eventKey: String?, promise: Promise ->
            val context = appContext.reactContext ?: return@AsyncFunction
            
            val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
            
            cameraProviderFuture.addListener({
                try {
                    cameraProvider = cameraProviderFuture.get()
                    val lifecycleOwner = appContext.currentActivity as? LifecycleOwner

                    if (lifecycleOwner == null) {
                        promise.resolve(mapOf("success" to false, "error" to "Activity/LifecycleOwner is null"))
                        return@addListener
                    }

                    // 기존 바인딩 해제
                    cameraProvider?.unbindAll()

                    // 전면/후면 선택
                    val cameraSelector = if (facing == "front") {
                        CameraSelector.DEFAULT_FRONT_CAMERA
                    } else {
                        CameraSelector.DEFAULT_BACK_CAMERA
                    }

                    // UseCase 1: 이미지 캡처
                    imageCapture = ImageCapture.Builder()
                        .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                        .build()

                    // UseCase 2: 비디오 캡처
                    val recorder = Recorder.Builder()
                        .setQualitySelector(QualitySelector.from(Quality.HD))
                        .build()
                    videoCapture = VideoCapture.withOutput(recorder)

                    val useCases = mutableListOf<UseCase>(imageCapture!!, videoCapture!!)

                    // UseCase 3: 이미지 분석 (스트리밍 요청 시에만 추가)
                    if (eventKey != null) {
                        streamingEventName = eventKey
                        isStreaming = true
                        lastFrameTime = 0L // 타이머 초기화

                        imageAnalyzer = ImageAnalysis.Builder()
                            // 최신 이미지만 유지 (밀린 프레임 폐기)
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            // 해상도 제한 (성능 핵심: 너무 크면 Base64 변환 시 앱 죽음)
                            .setTargetResolution(Size(480, 640))
                            .build()
                            .also { analyzer ->
                                analyzer.setAnalyzer(cameraExecutor) { imageProxy ->
                                    // 백그라운드 스레드에서 처리
                                    processFrame(imageProxy)
                                }
                            }
                        useCases.add(imageAnalyzer!!)
                    }

                    // 카메라 생명주기 바인딩
                    camera = cameraProvider?.bindToLifecycle(
                        lifecycleOwner,
                        cameraSelector,
                        *useCases.toTypedArray()
                    )

                    // 비디오 녹화 준비 (실제 파일 저장은 startVideoRecording 내부에서)
                    startVideoRecording(promise)

                } catch (e: Exception) {
                    Log.e("CameraModule", "Start Camera Failed", e)
                    promise.resolve(mapOf("success" to false, "error" to e.message))
                }
            }, ContextCompat.getMainExecutor(context))
        }

        // 4. 카메라 중지
        AsyncFunction("stopCamera") { promise: Promise ->
            try {
                isStreaming = false
                streamingEventName = null
                
                recording?.stop()
                recording = null

                cameraProvider?.unbindAll()
                
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
    }

    // 내부 함수: 비디오 녹화 시작
    private fun startVideoRecording(promise: Promise) {
        val context = appContext.reactContext ?: return
        val videoCapture = this.videoCapture ?: return

        try {
            val videoFile = File.createTempFile("video_", ".mp4", context.cacheDir)
            val outputOptions = FileOutputOptions.Builder(videoFile).build()

            // 오디오 권한 체크 (권한 없으면 앱 죽는 것 방지)
            val micPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            
            var pendingRecording = videoCapture.output.prepareRecording(context, outputOptions)
            
            if (micPermission == PackageManager.PERMISSION_GRANTED) {
                pendingRecording = pendingRecording.withAudioEnabled()
            }

            recording = pendingRecording.start(ContextCompat.getMainExecutor(context)) { recordEvent ->
                when (recordEvent) {
                    is VideoRecordEvent.Start -> {
                        promise.resolve(mapOf(
                            "success" to true, 
                            "isRecording" to true,
                            "isStreaming" to isStreaming
                        ))
                    }
                    is VideoRecordEvent.Finalize -> {
                        if (!recordEvent.hasError()) {
                            sendEvent("onRecordingFinished", mapOf("path" to videoFile.absolutePath))
                        } else {
                            recording?.close()
                            recording = null
                            sendEvent("onRecordingError", mapOf("error" to "Video error code: ${recordEvent.error}"))
                        }
                    }
                }
            }
        } catch (e: Exception) {
            promise.resolve(mapOf("success" to false, "error" to "Recording failed: ${e.message}"))
        }
    }

    // 내부 함수: 프레임 처리 (가장 중요한 부분 - 크래시 방지 적용됨)
    private fun processFrame(imageProxy: ImageProxy) {
        if (!isStreaming || streamingEventName == null) {
            imageProxy.close()
            return
        }

        // 1. 프레임 스킵 (Throttling)
        val currentTime = System.currentTimeMillis()
        if (currentTime - lastFrameTime < FRAME_INTERVAL_MS) {
            imageProxy.close()
            return
        }
        lastFrameTime = currentTime

        try {
            // 2. YUV -> NV21 변환 (안전한 함수 사용)
            val nv21 = yuv420888ToNv21(imageProxy)
            
            // 3. JPEG 압축
            val yuvImage = YuvImage(
                nv21,
                ImageFormat.NV21,
                imageProxy.width,
                imageProxy.height,
                null
            )

            val out = ByteArrayOutputStream()
            // 화질 30으로 설정하여 속도 확보
            yuvImage.compressToJpeg(
                Rect(0, 0, imageProxy.width, imageProxy.height),
                30, 
                out
            )
            val imageBytes = out.toByteArray()

            // 4. 비트맵 회전
            val bitmap = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size)
            val matrix = Matrix()
            matrix.postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
            
            val rotatedBitmap = Bitmap.createBitmap(
                bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true
            )

            // 5. Base64 변환
            val finalOut = ByteArrayOutputStream()
            rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 30, finalOut)
            val base64 = Base64.encodeToString(finalOut.toByteArray(), Base64.NO_WRAP)

            // 6. JS로 이벤트 전송 (메인 스레드 사용)
            mainHandler.post {
                sendEvent(streamingEventName!!, mapOf(
                    "type" to "cameraFrame",
                    "base64" to "data:image/jpeg;base64,$base64",
                    "width" to rotatedBitmap.width,
                    "height" to rotatedBitmap.height
                ))
            }

            // 메모리 정리
            bitmap.recycle()
            rotatedBitmap.recycle()

        } catch (e: Exception) {
            Log.e("CameraModule", "Frame processing error", e)
        } finally {
            // [중요] 예외가 발생하더라도 이미지는 반드시 닫아야 함 (안 그러면 카메라 멈춤)
            imageProxy.close()
        }
    }

    // 내부 함수: YUV_420_888 -> NV21 변환 (인덱스 에러 방지 포함)
    private fun yuv420888ToNv21(image: ImageProxy): ByteArray {
        val width = image.width
        val height = image.height
        val ySize = width * height
        val uvSize = width * height / 4
        
        val nv21 = ByteArray(ySize + uvSize * 2)

        val yBuffer = image.planes[0].buffer
        val uBuffer = image.planes[1].buffer
        val vBuffer = image.planes[2].buffer

        val rowStride = image.planes[0].rowStride
        val pixelStride = image.planes[0].pixelStride

        var pos = 0

        // Y Plane 복사
        if (rowStride == width) {
            yBuffer.get(nv21, 0, ySize)
            pos = ySize
        } else {
            for (row in 0 until height) {
                if ((row * rowStride) + width > yBuffer.capacity()) break // 안전장치
                yBuffer.position(row * rowStride)
                yBuffer.get(nv21, pos, width)
                pos += width
            }
        }

        // UV Plane 복사
        val vBufferBytes = ByteArray(vBuffer.remaining())
        val uBufferBytes = ByteArray(uBuffer.remaining())
        vBuffer.get(vBufferBytes)
        uBuffer.get(uBufferBytes)

        val uRowStride = image.planes[1].rowStride
        val vRowStride = image.planes[2].rowStride
        val uPixelStride = image.planes[1].pixelStride
        val vPixelStride = image.planes[2].pixelStride

        try {
            for (row in 0 until height / 2) {
                for (col in 0 until width / 2) {
                    val vIndex = row * vRowStride + col * vPixelStride
                    val uIndex = row * uRowStride + col * uPixelStride
                    
                    if (vIndex >= vBufferBytes.size || uIndex >= uBufferBytes.size) continue

                    nv21[pos++] = vBufferBytes[vIndex]
                    nv21[pos++] = uBufferBytes[uIndex]
                }
            }
        } catch (e: Exception) {
            Log.e("CameraModule", "YUV conversion error", e)
        }
        
        return nv21
    }
}