package expo.modules.customcamera

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Matrix
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.util.Log
import android.util.Size
import android.view.Surface
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.*
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.LifecycleOwner
import com.google.common.util.concurrent.ListenableFuture
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileWriter
import java.io.PrintWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors

class CameraModule : Module() {
    private var cameraProvider: ProcessCameraProvider? = null
    private var camera: Camera? = null
    private var imageCapture: ImageCapture? = null
    private var imageAnalyzer: ImageAnalysis? = null
    private var isStreaming = false
    private var lastFrameTime = 0L
    
    // 설정 가능한 파라미터 (기본값)
    private var targetFps = 10.0
    private var jpegQuality = 30
    private var maxWidth: Int? = null
    private var maxHeight: Int? = null
    private val frameIntervalMs: Long
        get() = (1000.0 / targetFps).toLong()
    
    private val mainHandler by lazy { Handler(Looper.getMainLooper()) }
    private val cameraExecutor by lazy { Executors.newSingleThreadExecutor() }
    
    private var currentFacing: String = "back"
    
    companion object {
        private const val CAMERA_PERMISSION_REQUEST_CODE = 1001
    }

    override fun definition() = ModuleDefinition {
        Name("CustomCamera")
        Events("onCameraFrame")

        OnCreate {
            Log.d("CameraModule", "Camera module created")
            setupCrashHandler()
        }

        OnDestroy {
            try {
                Log.d("CameraModule", "OnDestroy called")
                cleanupCamera()
                
                // Executor 종료로 메모리 누수 방지
                try {
                    cameraExecutor.shutdown()
                } catch (e: Exception) {
                    Log.e("CameraModule", "Executor shutdown error", e)
                }
            } catch (e: Exception) {
                Log.e("CameraModule", "Destroy error", e)
            }
        }
        
        // 안전한 카메라 정리
        Function("cleanupCamera") {
            cleanupCamera()
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
                
                promise.resolve(mapOf(
                    "granted" to cameraGranted,
                    "status" to if (cameraGranted) "granted" else "denied"
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "checkCameraPermission error", e)
                promise.resolve(mapOf("granted" to false, "status" to "error"))
            }
        }
        
        // 권한 요청
        AsyncFunction("requestCameraPermission") { promise: Promise ->
            try {
                val activity = appContext.currentActivity
                if (activity == null) {
                    promise.resolve(mapOf("granted" to false, "status" to "unavailable"))
                    return@AsyncFunction
                }
                
                val context = appContext.reactContext
                if (context == null) {
                    promise.resolve(mapOf("granted" to false, "status" to "unavailable"))
                    return@AsyncFunction
                }
                
                // 이미 권한이 있는지 확인
                val cameraGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                
                if (cameraGranted) {
                    promise.resolve(mapOf(
                        "granted" to true,
                        "status" to "granted"
                    ))
                    return@AsyncFunction
                }
                
                // 권한 요청
                activity.requestPermissions(arrayOf(Manifest.permission.CAMERA), CAMERA_PERMISSION_REQUEST_CODE)
                
                // 결과는 즉시 반환 (실제 권한 상태는 다시 checkCameraPermission으로 확인해야 함)
                promise.resolve(mapOf(
                    "granted" to false,
                    "status" to "requesting"
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "requestCameraPermission error", e)
                promise.resolve(mapOf("granted" to false, "status" to "error"))
            }
        }

        // 사진 촬영
        // 사진 촬영 (1프레임 캡처 방식 - 파일 저장 없음)
        AsyncFunction("takePhoto") { facingParam: String?, promise: Promise ->
            try {
                val facing = facingParam ?: "back"  // 기본값: 후면 카메라
                
                val context = appContext.reactContext
                if (context == null) {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }

                val activity = appContext.currentActivity
                if (activity == null) {
                    promise.resolve(mapOf("success" to false, "error" to "Activity not available"))
                    return@AsyncFunction
                }
                
                val lifecycleOwner = activity as? LifecycleOwner
                if (lifecycleOwner == null) {
                    promise.resolve(mapOf("success" to false, "error" to "LifecycleOwner not available"))
                    return@AsyncFunction
                }
                
                // 권한 체크
                val cameraPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                if (cameraPermission != PackageManager.PERMISSION_GRANTED) {
                    promise.resolve(mapOf("success" to false, "error" to "Camera permission not granted"))
                    return@AsyncFunction
                }

                // 임시 카메라 설정 (1프레임 촬영용)
                val tempCameraProviderFuture = ProcessCameraProvider.getInstance(activity)
                
                tempCameraProviderFuture.addListener({
                    var tempCamera: Camera? = null
                    var tempImageCapture: ImageCapture? = null
                    
                    try {
                        val tempProvider = tempCameraProviderFuture.get()
                        
                        val cameraSelector = if (facing == "front") {
                            CameraSelector.DEFAULT_FRONT_CAMERA
                        } else {
                            CameraSelector.DEFAULT_BACK_CAMERA
                        }

                        val rotation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            activity.display?.rotation ?: Surface.ROTATION_0
                        } else {
                            @Suppress("DEPRECATION")
                            activity.windowManager.defaultDisplay.rotation
                        }
                        
                        tempImageCapture = ImageCapture.Builder()
                            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                            .setTargetRotation(rotation)
                            .build()

                        tempCamera = tempProvider.bindToLifecycle(
                            lifecycleOwner,
                            cameraSelector,
                            tempImageCapture
                        )

                        tempImageCapture?.takePicture(
                            cameraExecutor,
                            object : ImageCapture.OnImageCapturedCallback() {
                                override fun onCaptureSuccess(imageProxy: ImageProxy) {
                                    try {
                                        val bitmap = imageProxy.toBitmap()
                                        val matrix = Matrix()
                                        matrix.postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
                                        
                                        val rotatedBitmap = Bitmap.createBitmap(
                                            bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true
                                        )
                                        bitmap.recycle()

                                        val base64: String
                                        ByteArrayOutputStream().use { out ->
                                            rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, 90, out)
                                            base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
                                        }
                                        
                                        val width = rotatedBitmap.width
                                        val height = rotatedBitmap.height
                                        rotatedBitmap.recycle()

                                        // 임시 카메라 정리
                                        mainHandler.post {
                                            try {
                                                tempProvider.unbindAll()
                                            } catch (e: Exception) {
                                                Log.e("CameraModule", "Error unbinding temp camera", e)
                                            }
                                        }

                                        promise.resolve(mapOf(
                                            "success" to true,
                                            "base64" to "data:image/jpeg;base64,$base64",
                                            "width" to width,
                                            "height" to height,
                                            "facing" to facing
                                        ))
                                    } catch (e: Exception) {
                                        Log.e("CameraModule", "Image processing error", e)
                                        promise.resolve(mapOf("success" to false, "error" to e.message))
                                    } finally {
                                        imageProxy.close()
                                    }
                                }

                                override fun onError(exception: ImageCaptureException) {
                                    // 임시 카메라 정리
                                    mainHandler.post {
                                        try {
                                            tempProvider.unbindAll()
                                        } catch (e: Exception) {
                                            Log.e("CameraModule", "Error unbinding temp camera", e)
                                        }
                                    }
                                    
                                    Log.e("CameraModule", "Capture error", exception)
                                    promise.resolve(mapOf("success" to false, "error" to exception.message))
                                }
                            }
                        )
                    } catch (e: Exception) {
                        Log.e("CameraModule", "Temp camera setup error", e)
                        promise.resolve(mapOf("success" to false, "error" to e.message))
                    }
                }, ContextCompat.getMainExecutor(context))
                
            } catch (e: Exception) {
                Log.e("CameraModule", "takePhoto error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }

        // 카메라 시작
        AsyncFunction("startCamera") { payloadMap: Map<String, Any?>, promise: Promise ->
            try {
                // 파라미터 파싱 (호환성 유지)
                val facing = payloadMap["facing"] as? String ?: "back"
                targetFps = (payloadMap["fps"] as? Number)?.toDouble() ?: 10.0
                jpegQuality = (payloadMap["quality"] as? Number)?.toInt() ?: 30
                maxWidth = (payloadMap["maxWidth"] as? Number)?.toInt()
                maxHeight = (payloadMap["maxHeight"] as? Number)?.toInt()
                
                // 값 범위 체크
                targetFps = targetFps.coerceIn(1.0, 30.0)
                jpegQuality = jpegQuality.coerceIn(1, 100)
                
                val context = appContext.reactContext
                if (context == null) {
                    Log.e("CameraModule", "Context not available")
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }

                val activity = appContext.currentActivity
                if (activity == null) {
                    Log.e("CameraModule", "Activity not available")
                    promise.resolve(mapOf("success" to false, "error" to "Activity not available"))
                    return@AsyncFunction
                }
                
                val lifecycleOwner = activity as? LifecycleOwner
                if (lifecycleOwner == null) {
                    Log.e("CameraModule", "LifecycleOwner not available")
                    promise.resolve(mapOf("success" to false, "error" to "LifecycleOwner not available"))
                    return@AsyncFunction
                }
                
                val cameraPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                if (cameraPermission != PackageManager.PERMISSION_GRANTED) {
                    Log.e("CameraModule", "Camera permission not granted")
                    promise.resolve(mapOf("success" to false, "error" to "Camera permission not granted"))
                    return@AsyncFunction
                }
                
                currentFacing = facing
                cleanupCamera()
                
                val cameraProviderFuture = ProcessCameraProvider.getInstance(activity)
                
                cameraProviderFuture.addListener({
                    try {
                        cameraProvider = cameraProviderFuture.get()
                        cameraProvider?.unbindAll()

                        val cameraSelector = if (facing == "front") {
                            CameraSelector.DEFAULT_FRONT_CAMERA
                        } else {
                            CameraSelector.DEFAULT_BACK_CAMERA
                        }

                        val rotation = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                            activity.display?.rotation ?: Surface.ROTATION_0
                        } else {
                            @Suppress("DEPRECATION")
                            activity.windowManager.defaultDisplay.rotation
                        }
                        
                        imageCapture = ImageCapture.Builder()
                            .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
                            .setTargetRotation(rotation)
                            .build()

                        val useCases = mutableListOf<UseCase>(imageCapture!!)

                        isStreaming = true
                        lastFrameTime = 0L

                        imageAnalyzer = ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .setTargetRotation(rotation)
                            .build()
                        
                        imageAnalyzer?.setAnalyzer(cameraExecutor) { imageProxy ->
                            processFrame(imageProxy)
                        }
                        
                        useCases.add(imageAnalyzer!!)
                        camera = cameraProvider?.bindToLifecycle(
                            lifecycleOwner,
                            cameraSelector,
                            *useCases.toTypedArray()
                        )

                        if (camera != null) {
                            promise.resolve(mapOf(
                                "success" to true,
                                "isActive" to true,
                                "facing" to facing,
                                "isRecording" to false,
                                "isStreaming" to isStreaming
                            ))
                        } else {
                            Log.e("CameraModule", "Camera binding returned null")
                            promise.resolve(mapOf("success" to false, "error" to "Camera binding returned null"))
                        }

                            } catch (e: Exception) {
                                saveDebugLog("ERROR in camera provider listener: ${e.message}")
                                saveDebugLog("Stack trace: ${e.stackTraceToString()}")
                                Log.e("CameraModule", "ERROR in camera provider listener", e)
                                Log.e("CameraModule", "Stack trace: ${e.stackTraceToString()}")
                                saveCrashLog("Camera binding error", e)
                                cleanupCamera()
                                promise.resolve(mapOf("success" to false, "error" to "Camera binding failed: ${e.message}"))
                            }
                    }, ContextCompat.getMainExecutor(context))
                    
            } catch (e: Exception) {
                saveDebugLog("ERROR in startCamera: ${e.message}")
                saveDebugLog("Stack trace: ${e.stackTraceToString()}")
                Log.e("CameraModule", "ERROR in startCamera", e)
                Log.e("CameraModule", "Stack trace: ${e.stackTraceToString()}")
                saveCrashLog("startCamera error", e)
                cleanupCamera()
                promise.resolve(mapOf("success" to false, "error" to "Failed to start camera: ${e.message}"))
            }
        }

        // 카메라 중지
        AsyncFunction("stopCamera") { promise: Promise ->
            try {
                cleanupCamera()
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e("CameraModule", "stopCamera error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }


        // 상태 확인
        AsyncFunction("getCameraStatus") { promise: Promise ->
            try {
                promise.resolve(mapOf(
                    "isStreaming" to isStreaming,
                    "hasCamera" to (camera != null)
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "getCameraStatus error", e)
                promise.resolve(mapOf(
                    "isStreaming" to false,
                    "hasCamera" to false
                ))
            }
        }
        
        // 크래시 로그 파일 목록 가져오기
        AsyncFunction("getCrashLogs") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val logsDir = context.getExternalFilesDir(null)
                val crashFiles = logsDir?.listFiles { file -> 
                    file.name.startsWith("camera_crash_") && file.name.endsWith(".txt")
                }?.sortedByDescending { it.lastModified() } ?: emptyList()
                
                val logList = crashFiles.map { file ->
                    mapOf(
                        "name" to file.name,
                        "path" to file.absolutePath,
                        "size" to file.length(),
                        "date" to file.lastModified()
                    )
                }
                
                promise.resolve(mapOf(
                    "success" to true,
                    "logs" to logList,
                    "count" to logList.size
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "getCrashLogs error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 크래시 로그 공유하기 (카카오톡, 이메일 등으로 전송)
        AsyncFunction("shareCrashLog") { filePath: String, promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val file = File(filePath)
                if (!file.exists()) {
                    promise.resolve(mapOf("success" to false, "error" to "File not found"))
                    return@AsyncFunction
                }
                
                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    file
                )
                
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_SUBJECT, "Camera Crash Log - ${file.name}")
                    putExtra(Intent.EXTRA_TEXT, "카메라 모듈 크래시 로그입니다.")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                
                val chooser = Intent.createChooser(shareIntent, "크래시 로그 공유").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                
                context.startActivity(chooser)
                
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e("CameraModule", "shareCrashLog error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 디버그 로그 가져오기
        AsyncFunction("getDebugLog") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val logsDir = context.getExternalFilesDir(null)
                val logFile = File(logsDir, "camera_debug.log")
                
                if (!logFile.exists()) {
                    promise.resolve(mapOf(
                        "success" to true,
                        "content" to "",
                        "path" to logFile.absolutePath,
                        "exists" to false
                    ))
                    return@AsyncFunction
                }
                
                val content = logFile.readText()
                
                promise.resolve(mapOf(
                    "success" to true,
                    "content" to content,
                    "path" to logFile.absolutePath,
                    "size" to logFile.length(),
                    "exists" to true
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "getDebugLog error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 디버그 로그 공유하기
        AsyncFunction("shareDebugLog") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val logsDir = context.getExternalFilesDir(null)
                val logFile = File(logsDir, "camera_debug.log")
                
                if (!logFile.exists()) {
                    promise.resolve(mapOf("success" to false, "error" to "Debug log file not found"))
                    return@AsyncFunction
                }
                
                val uri = FileProvider.getUriForFile(
                    context,
                    "${context.packageName}.fileprovider",
                    logFile
                )
                
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_STREAM, uri)
                    putExtra(Intent.EXTRA_SUBJECT, "Camera Debug Log")
                    putExtra(Intent.EXTRA_TEXT, "카메라 디버그 로그입니다.")
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                
                val chooser = Intent.createChooser(shareIntent, "디버그 로그 공유").apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                
                context.startActivity(chooser)
                
                promise.resolve(mapOf("success" to true))
            } catch (e: Exception) {
                Log.e("CameraModule", "shareDebugLog error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 디버그 로그 삭제
        AsyncFunction("clearDebugLog") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val logsDir = context.getExternalFilesDir(null)
                val logFile = File(logsDir, "camera_debug.log")
                
                val deleted = if (logFile.exists()) {
                    logFile.delete()
                } else {
                    true
                }
                
                promise.resolve(mapOf(
                    "success" to deleted,
                    "message" to if (deleted) "Debug log cleared" else "Failed to delete debug log"
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "clearDebugLog error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
        
        // 모든 크래시 로그 삭제
        AsyncFunction("clearCrashLogs") { promise: Promise ->
            try {
                val context = appContext.reactContext ?: run {
                    promise.resolve(mapOf("success" to false, "error" to "Context not available"))
                    return@AsyncFunction
                }
                
                val logsDir = context.getExternalFilesDir(null)
                val crashFiles = logsDir?.listFiles { file -> 
                    file.name.startsWith("camera_crash_") && file.name.endsWith(".txt")
                } ?: emptyArray()
                
                var deletedCount = 0
                crashFiles.forEach { file ->
                    if (file.delete()) deletedCount++
                }
                
                promise.resolve(mapOf(
                    "success" to true,
                    "deleted" to deletedCount
                ))
            } catch (e: Exception) {
                Log.e("CameraModule", "clearCrashLogs error", e)
                promise.resolve(mapOf("success" to false, "error" to e.message))
            }
        }
    }

    private var frameCounter = 0
    
    private fun processFrame(imageProxy: ImageProxy) {
        try {
            frameCounter++
            
            if (!isStreaming) {
                imageProxy.close()
                return
            }

            val currentTime = System.currentTimeMillis()
            if (currentTime - lastFrameTime < frameIntervalMs) {
                imageProxy.close()
                return
            }
            lastFrameTime = currentTime

            val bitmap = imageProxy.toBitmap()
            
            // 리사이즈 처리
            val resizedBitmap = if (maxWidth != null || maxHeight != null) {
                val srcWidth = bitmap.width
                val srcHeight = bitmap.height
                val scale = calculateScale(srcWidth, srcHeight, maxWidth, maxHeight)
                
                if (scale < 1.0) {
                    val newWidth = (srcWidth * scale).toInt()
                    val newHeight = (srcHeight * scale).toInt()
                    Bitmap.createScaledBitmap(bitmap, newWidth, newHeight, true).also {
                        bitmap.recycle()
                    }
                } else {
                    bitmap
                }
            } else {
                bitmap
            }
            
            val matrix = Matrix()
            matrix.postRotate(imageProxy.imageInfo.rotationDegrees.toFloat())
            
            val rotatedBitmap = Bitmap.createBitmap(resizedBitmap, 0, 0, resizedBitmap.width, resizedBitmap.height, matrix, true)
            
            // resizedBitmap 즉시 해제
            resizedBitmap.recycle()

            val base64: String
            ByteArrayOutputStream().use { out ->
                rotatedBitmap.compress(Bitmap.CompressFormat.JPEG, jpegQuality, out)
                base64 = Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
            }
            
            // 프레임 데이터 미리 준비 (width, height 캡처)
            val width = rotatedBitmap.width
            val height = rotatedBitmap.height
            
            // rotatedBitmap 즉시 해제
            rotatedBitmap.recycle()

            mainHandler.post {
                try {
                    val frameData = mapOf(
                        "type" to "cameraFrame",
                        "base64" to "data:image/jpeg;base64,$base64",
                        "width" to width,
                        "height" to height,
                        "frameNumber" to frameCounter,
                        "timestamp" to System.currentTimeMillis()
                    )
                    
                    sendEvent("onCameraFrame", frameData)
                } catch (e: Exception) {
                    Log.e("CameraModule", "Failed to send frame event", e)
                }
            }

        } catch (e: Exception) {
            Log.e("CameraModule", "processFrame error", e)
        } finally {
            imageProxy.close()
        }
    }
    
    // 안전한 카메라 정리 함수
    private fun cleanupCamera() {
        try {
            isStreaming = false
            frameCounter = 0
            
            imageAnalyzer?.let {
                try {
                    it.clearAnalyzer()
                } catch (e: Exception) {
                    Log.e("CameraModule", "Error clearing analyzer", e)
                }
            }
            
            cameraProvider?.let { provider ->
                try {
                    mainHandler.post {
                        try {
                            provider.unbindAll()
                        } catch (e: Exception) {
                            Log.e("CameraModule", "Error unbinding camera", e)
                        }
                    }
                } catch (e: Exception) {
                    Log.e("CameraModule", "Error posting unbind", e)
                }
            }
            
            camera = null
            imageCapture = null
            imageAnalyzer = null
        } catch (e: Exception) {
            Log.e("CameraModule", "Error in cleanupCamera", e)
        }
    }
    
    // 크래시 핸들러 설정
    private fun setupCrashHandler() {
        val defaultHandler = Thread.getDefaultUncaughtExceptionHandler()
        Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
            try {
                Log.e("CameraModule", "FATAL CRASH DETECTED!", throwable)
                saveCrashLog("FATAL CRASH", throwable)
            } catch (e: Exception) {
                Log.e("CameraModule", "Failed to save crash log", e)
            } finally {
                defaultHandler?.uncaughtException(thread, throwable)
            }
        }
    }
    
    // 리사이즈 스케일 계산
    private fun calculateScale(srcWidth: Int, srcHeight: Int, maxWidth: Int?, maxHeight: Int?): Double {
        if (maxWidth == null && maxHeight == null) return 1.0
        
        val widthScale = maxWidth?.let { srcWidth.toDouble() / it } ?: Double.MAX_VALUE
        val heightScale = maxHeight?.let { srcHeight.toDouble() / it } ?: Double.MAX_VALUE
        
        return 1.0 / Math.max(widthScale, heightScale).coerceAtLeast(1.0)
    }
    
    // 디버그 로그를 파일로 저장 (실시간 디버깅용)
    private fun saveDebugLog(message: String) {
        try {
            val context = appContext.reactContext ?: return
            val logsDir = context.getExternalFilesDir(null) ?: return
            
            val timestamp = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.getDefault()).format(Date())
            val logFile = File(logsDir, "camera_debug.log")
            
            // 파일이 너무 크면 새로 시작 (5MB 제한)
            if (logFile.exists() && logFile.length() > 5 * 1024 * 1024) {
                logFile.delete()
            }
            
            FileWriter(logFile, true).use { writer ->
                writer.appendLine("[$timestamp] $message")
            }
        } catch (e: Exception) {
            Log.e("CameraModule", "saveDebugLog error", e)
        }
    }
    
    // 크래시 로그를 파일로 저장
    private fun saveCrashLog(context: String, throwable: Throwable) {
        try {
            val ctx = appContext.reactContext ?: return
            val logsDir = ctx.getExternalFilesDir(null) ?: return
            
            // 오래된 크래시 로그 정리 (최대 10개 유지)
            val crashFiles = logsDir.listFiles { file ->
                file.name.startsWith("camera_crash_") && file.name.endsWith(".txt")
            }?.sortedByDescending { it.lastModified() } ?: emptyList()
            
            crashFiles.drop(9).forEach { it.delete() }
            
            val timestamp = SimpleDateFormat("yyyy-MM-dd_HH-mm-ss", Locale.getDefault()).format(Date())
            val fileName = "camera_crash_${timestamp}.txt"
            val logFile = File(logsDir, fileName)
            
            FileWriter(logFile, true).use { writer ->
                PrintWriter(writer).use { printer ->
                    printer.println("=".repeat(80))
                    printer.println("CAMERA MODULE CRASH LOG")
                    printer.println("=".repeat(80))
                    printer.println("Timestamp: ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.getDefault()).format(Date())}")
                    printer.println("Context: $context")
                    printer.println("Thread: ${Thread.currentThread().name}")
                    printer.println("-".repeat(80))
                    printer.println("ERROR MESSAGE:")
                    printer.println(throwable.message ?: "No message")
                    printer.println("-".repeat(80))
                    printer.println("STACK TRACE:")
                    throwable.printStackTrace(printer)
                    printer.println("=".repeat(80))
                    printer.println()
                    printer.println("앱에서 크래시 로그를 확인하고 공유하려면:")
                    printer.println("1. 앱 설정 또는 디버그 메뉴에서 '크래시 로그 보기' 선택")
                    printer.println("2. '로그 공유' 버튼을 눌러 카카오톡, 이메일 등으로 전송")
                    printer.println("3. 또는 파일 관리자에서 다음 경로로 접근:")
                    printer.println("   ${logFile.absolutePath}")
                    printer.println("=".repeat(80))
                }
            }
            
            Log.e("CameraModule", "💾 Crash log saved: ${logFile.absolutePath}")
            Log.e("CameraModule", "📱 Use getCrashLogs() and shareCrashLog() to access from app")
            
        } catch (e: Exception) {
            Log.e("CameraModule", "Failed to write crash log to file", e)
        }
    }
}
