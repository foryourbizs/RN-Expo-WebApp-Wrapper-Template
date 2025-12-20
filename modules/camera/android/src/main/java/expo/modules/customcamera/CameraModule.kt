package expo.modules.customcamera

import android.Manifest
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
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
import java.util.concurrent.Executors

class CameraModule : Module() {
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var recording: Recording? = null
    private var imageAnalyzer: ImageAnalysis? = null
    private var isStreaming = false
    private var streamingEventName: String? = null
    private var lastFrameTime = 0L
    private val TARGET_FPS = 10.0
    private val FRAME_INTERVAL_MS = (1000.0 / TARGET_FPS).toLong()
    
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }
    private val cameraExecutor by lazy { Executors.newSingleThreadExecutor() }

    override fun definition() = ModuleDefinition {
        Name("Camera")
        Events("onCameraFrame", "onRecordingFinished", "onRecordingError")

        OnCreate {
            Log.d("CameraModule", "Camera module created")
        }

        OnDestroy {
            try {
                isStreaming = false
                recording?.stop()
                recording = null
                cameraProvider?.unbindAll()
                Log.d("CameraModule", "Camera module destroyed")
            } catch (e: Exception) {
                Log.e("CameraModule", "Destroy error", e)
            }
        }

        // 권한 확인
        AsyncFunction("checkCameraPermission") { promise: Promise ->
            try {
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
                    "micGranted" to micGranted,
                    "status" to if (cameraGranted && micGranted) "granted" else "denied"
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "checkCameraPermission error", e)
                promise.resolve(mapOf("granted" to false, "status" to "error"))
            }
        }

        // 사진 촬영
        AsyncFunction("takePhoto") { promise: Promise ->
            try {
                if (imageCapture == null) {
                    promise.resolve(mapOf("success" to false, "error" to "Camera not initialized"))
                    return@AsyncFunction
                }

                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }

                val photoFile = File.createTempFile("photo_", ".jpg", context.cacheDir)
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
                Log.e("CameraModule", "takePhoto error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }

        // 카메라 시작 - 안전하고 단순한 버전
        AsyncFunction("startCamera") { facing: String, eventKey: String?, promise: Promise ->
            Log.d("CameraModule", "startCamera called: facing=$facing, eventKey=$eventKey")
            
            try {
                val context = appContext.reactContext
                if (context == null) {
                    Log.e("CameraModule", "Context is null")
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }

                val lifecycleOwner = appContext.currentActivity as? LifecycleOwner
                if (lifecycleOwner == null) {
                    Log.e("CameraModule", "LifecycleOwner is null")
                    promise.resolve(mapOf("success" to false, "error" to "Activity not available"))
                    return@AsyncFunction
                }

                Log.d("CameraModule", "Getting camera provider...")
                val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
                
                cameraProviderFuture.addListener({
                    try {
                        Log.d("CameraModule", "Camera provider listener triggered")
                        cameraProvider = cameraProviderFuture.get()
                        
                        Log.d("CameraModule", "Unbinding previous cameras...")
                        cameraProvider?.unbindAll()

                        val cameraSelector = if (facing == "front") {
                            CameraSelector.DEFAULT_FRONT_CAMERA
                        } else {
                            CameraSelector.DEFAULT_BACK_CAMERA
                        }

                        Log.d("CameraModule", "Creating ImageCapture...")
                        imageCapture = ImageCapture.Builder()
                            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                            .build()

                        // 스트리밍이 필요한 경우에만 ImageAnalysis 추가
                        if (eventKey != null) {
                            Log.d("CameraModule", "Setting up streaming...")
                            streamingEventName = eventKey
                            isStreaming = true
                            lastFrameTime = 0L

                            imageAnalyzer = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .setTargetResolution(Size(480, 640))
                                .build()
                            
                            imageAnalyzer?.setAnalyzer(cameraExecutor) { imageProxy ->
                                processFrame(imageProxy)
                            }

                            Log.d("CameraModule", "Binding camera with streaming...")
                            camera = cameraProvider?.bindToLifecycle(
                                lifecycleOwner,
                                cameraSelector,
                                imageCapture,
                                imageAnalyzer
                            )
                        } else {
                            Log.d("CameraModule", "Binding camera without streaming...")
                            camera = cameraProvider?.bindToLifecycle(
                                lifecycleOwner,
                                cameraSelector,
                                imageCapture
                            )
                        }

                        Log.d("CameraModule", "Camera started successfully")
                        promise.resolve(mapOf(
                            "success" to true,
                            "isRecording" to false,
                            "isStreaming" to isStreaming
                        ))

                    } catch (e: Exception) {
                        Log.e("CameraModule", "Camera binding error", e)
                        promise.resolve(mapOf("success" to false, "error" to "Camera binding failed: ${e.message}"))
                    }
                }, ContextCompat.getMainExecutor(context))
                
            } catch (e: Exception) {
                Log.e("CameraModule", "startCamera error", e)
                promise.resolve(mapOf("success" to false, "error" to "Failed to start camera: ${e.message}"))
            }
        }

        // 카메라 중지
        AsyncFunction("stopCamera") { promise: Promise ->
            try {
                Log.d("CameraModule", "Stopping camera...")
                isStreaming = false
                streamingEventName = null
                
                try {
                    recording?.stop()
                } catch (e: Exception) {
                    Log.e("CameraModule", "Error stopping recording", e)
                }
                recording = null

                try {
                    cameraProvider?.unbindAll()
                } catch (e: Exception) {
                    Log.e("CameraModule", "Error unbinding camera", e)
                }
                
                camera = null
                imageCapture = null
                videoCapture = null
                imageAnalyzer = null
                
                Log.d("CameraModule", "Camera stopped successfully")
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e("CameraModule", "stopCamera error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 비디오 녹화 시작 (선택적 기능)
        AsyncFunction("startRecording") { promise: Promise ->
            try {
                if (camera == null) {
                    promise.resolve(mapOf("success" to false, "error" to "Camera not started"))
                    return@AsyncFunction
                }
                
                val context = appContext.reactContext
                if (context == null) {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                // VideoCapture가 없으면 새로 생성
                if (videoCapture == null) {
                    val lifecycleOwner = appContext.currentActivity as? LifecycleOwner
                    if (lifecycleOwner == null) {
                        promise.resolve(mapOf("success" to false, "error" to "Activity not available"))
                        return@AsyncFunction
                    }
                    
                    val recorder = Recorder.Builder()
                        .setQualitySelector(QualitySelector.from(Quality.HD))
                        .build()
                    videoCapture = VideoCapture.withOutput(recorder)
                    
                    // 카메라를 다시 바인딩 (기존 UseCase + VideoCapture)
                    cameraProvider?.unbindAll()
                    
                    val useCases = mutableListOf<UseCase>()
                    imageCapture?.let { useCases.add(it) }
                    imageAnalyzer?.let { useCases.add(it) }
                    useCases.add(videoCapture!!)
                    
                    val cameraSelector = CameraSelector.DEFAULT_BACK_CAMERA
                    camera = cameraProvider?.bindToLifecycle(
                        lifecycleOwner,
                        cameraSelector,
                        *useCases.toTypedArray()
                    )
                }
                
                startVideoRecording(promise)
                
            } catch (e: Exception) {
                Log.e("CameraModule", "startRecording error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 비디오 녹화 중지
        AsyncFunction("stopRecording") { promise: Promise ->
            try {
                recording?.stop()
                recording = null
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e("CameraModule", "stopRecording error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }

        // 상태 확인
        AsyncFunction("getCameraStatus") { promise: Promise ->
            try {
                promise.resolve(mapOf(
                    "isRecording" to (recording != null),
                    "isStreaming" to isStreaming,
                    "hasCamera" to (camera != null)
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "getCameraStatus error", e)
                promise.resolve(mapOf(
                    "isRecording" to false,
                    "isStreaming" to false,
                    "hasCamera" to false
                ))
            }
        }
    }

    private fun startVideoRecording(promise: Promise) {
        try {
            val context = appContext.reactContext ?: run {
                promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                return
            }
            
            val videoCapture = this.videoCapture ?: run {
                promise.resolve(mapOf("success" to false, "error" to "Video capture not initialized"))
                return
            }

            val videoFile = File.createTempFile("video_", ".mp4", context.cacheDir)
            val outputOptions = FileOutputOptions.Builder(videoFile).build()

            val micPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
            
            var pendingRecording = videoCapture.output.prepareRecording(context, outputOptions)
            
            if (micPermission == PackageManager.PERMISSION_GRANTED) {
                pendingRecording = pendingRecording.withAudioEnabled()
            }

            recording = pendingRecording.start(ContextCompat.getMainExecutor(context)) { recordEvent ->
                when (recordEvent) {
                    is VideoRecordEvent.Start -> {
                        Log.d("CameraModule", "Recording started")
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
                            Log.e("CameraModule", "Recording error: ${recordEvent.error}")
                            sendEvent("onRecordingError", mapOf("error" to "Video error: ${recordEvent.error}"))
                        }
                        recording = null
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("CameraModule", "startVideoRecording error", e)
            promise.resolve(mapOf("success" to false, "error" to "Recording failed: ${e.message}"))
        }
    }

    private fun processFrame(imageProxy: ImageProxy) {
        try {
            if (!isStreaming || streamingEventName == null) {
                imageProxy.close()
                return
            }

            val currentTime = System.currentTimeMillis()
            if (currentTime - lastFrameTime < FRAME_INTERVAL_MS) {
                imageProxy.close()
                return
            }
            lastFrameTime = currentTime

            val bitmap = imageProxy.toBitmap()
            val matrix = Matrix()
            matrix.postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
            
            val rotatedBitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)

            val out = ByteArrayOutputStream()
            rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 30, out)
            val base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)

            mainHandler.post {
                sendEvent(streamingEventName!!, mapOf(
                    "type" to "cameraFrame",
                    "base64" to "data:image/jpeg;base64,$base64",
                    "width" to rotatedBitmap.width,
                    "height" to rotatedBitmap.height
                ))
            }

            bitmap.recycle()
            rotatedBitmap.recycle()

        } catch (e: Exception) {
            Log.e("CameraModule", "processFrame error", e)
        } finally {
            imageProxy.close()
        }
    }
}
