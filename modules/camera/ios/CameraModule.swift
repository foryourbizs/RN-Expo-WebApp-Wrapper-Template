import ExpoModulesCore
import AVFoundation
import UIKit

public class CameraModule: Module {
    private var captureSession: AVCaptureSession?
    private var photoOutput: AVCapturePhotoOutput?
    private var videoDataOutput: AVCaptureVideoDataOutput?
    private var previewLayer: AVCaptureVideoPreviewLayer?
    private var currentCamera: AVCaptureDevice?
    private var isStreaming = false
    private var lastFrameTime: TimeInterval = 0
    
    // 설정 가능한 파라미터 (기본값)
    private var targetFPS: Double = 10.0
    private var jpegQuality: CGFloat = 0.3
    private var maxWidth: Int?
    private var maxHeight: Int?
    private var frameInterval: TimeInterval { 1.0 / targetFPS }
    
    private var frameCounter = 0
    private var currentFacing: String = "back"
    
    private let sessionQueue = DispatchQueue(label: "camera.session.queue")
    
    public func definition() -> ModuleDefinition {
        Name("CustomCamera")
        
        Events("onCameraFrame")
        
        OnCreate {
            // 모듈 초기화
        }
        
        OnDestroy {
            cleanup()
        }
        
        // 권한 확인
        AsyncFunction("checkCameraPermission") { (promise: Promise) in
            let cameraStatus = AVCaptureDevice.authorizationStatus(for: .video)
            let cameraGranted = cameraStatus == .authorized
            
            promise.resolve([
                "granted": cameraGranted,
                "status": cameraGranted ? "granted" : "denied"
            ])
        }
        
        // 권한 요청
        AsyncFunction("requestCameraPermission") { (promise: Promise) in
            Task {
                let cameraGranted = await AVCaptureDevice.requestAccess(for: .video)
                
                promise.resolve([
                    "granted": cameraGranted,
                    "status": cameraGranted ? "granted" : "denied"
                ])
            }
        }
        
        // 사진 촬영 (1프레임)
        AsyncFunction("takePhoto") { (facingParam: String?, promise: Promise) in
            let facing = facingParam ?? "back"
            
            self.sessionQueue.async {
                do {
                    // 임시 세션 생성
                    let tempSession = AVCaptureSession()
                    tempSession.sessionPreset = .photo
                    
                    // 카메라 디바이스 선택
                    guard let camera = self.getCameraDevice(facing: facing) else {
                        promise.reject("CAMERA_ERROR", "Camera device not available")
                        return
                    }
                    
                    let input = try AVCaptureDeviceInput(device: camera)
                    guard tempSession.canAddInput(input) else {
                        promise.reject("CAMERA_ERROR", "Cannot add camera input")
                        return
                    }
                    tempSession.addInput(input)
                    
                    let output = AVCapturePhotoOutput()
                    guard tempSession.canAddOutput(output) else {
                        promise.reject("CAMERA_ERROR", "Cannot add photo output")
                        return
                    }
                    tempSession.addOutput(output)
                    
                    tempSession.startRunning()
                    
                    // 사진 촬영
                    let settings = AVCapturePhotoSettings()
                    settings.photoQualityPrioritization = .quality
                    
                    let delegate = PhotoCaptureDelegate { result in
                        tempSession.stopRunning()
                        
                        switch result {
                        case .success(let data):
                            promise.resolve(data)
                        case .failure(let error):
                            promise.reject("CAPTURE_ERROR", error.localizedDescription)
                        }
                    }
                    
                    output.capturePhoto(with: settings, delegate: delegate)
                    
                } catch {
                    promise.reject("CAMERA_ERROR", error.localizedDescription)
                }
            }
        }
        
        // 카메라 스트리밍 시작
        AsyncFunction("startCamera") { (params: [String: Any], promise: Promise) in
            self.sessionQueue.async {
                do {
                    // 파라미터 파싱 (호환성 유지)
                    let facing = params["facing"] as? String ?? "back"
                    self.targetFPS = (params["fps"] as? Double ?? 10.0).clamped(to: 1.0...30.0)
                    
                    let qualityValue = (params["quality"] as? Int ?? 30).clamped(to: 1...100)
                    self.jpegQuality = CGFloat(qualityValue) / 100.0
                    
                    self.maxWidth = params["maxWidth"] as? Int
                    self.maxHeight = params["maxHeight"] as? Int
                    
                    try self.startCameraSession(facing: facing)
                    
                    promise.resolve([
                        "success": true,
                        "isActive": true,
                        "facing": facing,
                        "isRecording": false,
                        "isStreaming": self.isStreaming
                    ])
                } catch {
                    promise.resolve([
                        "success": false,
                        "error": error.localizedDescription
                    ])
                }
            }
        }
        
        // 카메라 중지
        AsyncFunction("stopCamera") { (promise: Promise) in
            self.cleanup()
            promise.resolve(["success": true])
        }
        
        // 카메라 상태 조회
        AsyncFunction("getCameraStatus") { (promise: Promise) in
            promise.resolve([
                "isStreaming": self.isStreaming,
                "facing": self.currentFacing,
                "hasCamera": self.captureSession != nil
            ])
        }
    }
    
    // MARK: - Private Methods
    
    private func getCameraDevice(facing: String) -> AVCaptureDevice? {
        let position: AVCaptureDevice.Position = facing == "front" ? .front : .back
        
        if #available(iOS 13.0, *) {
            return AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: position)
        } else {
            return AVCaptureDevice.default(for: .video)
        }
    }
    
    private func startCameraSession(facing: String) throws {
        cleanup()
        
        currentFacing = facing
        
        let session = AVCaptureSession()
        session.sessionPreset = .high
        
        // 카메라 입력
        guard let camera = getCameraDevice(facing: facing) else {
            throw NSError(domain: "CameraModule", code: -1, userInfo: [NSLocalizedDescriptionKey: "Camera not available"])
        }
        currentCamera = camera
        
        let input = try AVCaptureDeviceInput(device: camera)
        guard session.canAddInput(input) else {
            throw NSError(domain: "CameraModule", code: -2, userInfo: [NSLocalizedDescriptionKey: "Cannot add input"])
        }
        session.addInput(input)
        
        // 비디오 출력 (프레임 스트리밍용)
        let output = AVCaptureVideoDataOutput()
        output.setSampleBufferDelegate(self, queue: sessionQueue)
        output.videoSettings = [
            kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
        ]
        
        guard session.canAddOutput(output) else {
            throw NSError(domain: "CameraModule", code: -3, userInfo: [NSLocalizedDescriptionKey: "Cannot add output"])
        }
        session.addOutput(output)
        
        captureSession = session
        videoDataOutput = output
        isStreaming = true
        frameCounter = 0
        lastFrameTime = 0
        
        session.startRunning()
    }
    
    private func cleanup() {
        sessionQueue.async {
            self.isStreaming = false
            self.frameCounter = 0
            self.captureSession?.stopRunning()
            self.captureSession = nil
            self.videoDataOutput = nil
            self.photoOutput = nil
            self.currentCamera = nil
        }
    }
}

// MARK: - AVCaptureVideoDataOutputSampleBufferDelegate

extension CameraModule: AVCaptureVideoDataOutputSampleBufferDelegate {
    public func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard isStreaming else { return }
        
        frameCounter += 1
        
        let currentTime = Date().timeIntervalSince1970
        if currentTime - lastFrameTime < frameInterval {
            return
        }
        lastFrameTime = currentTime
        
        guard let imageBuffer = CMSampleBufferGetImageBuffer(sampleBuffer) else {
            return
        }
        
        let ciImage = CIImage(cvPixelBuffer: imageBuffer)
        let context = CIContext()
        
        guard let cgImage = context.createCGImage(ciImage, from: ciImage.extent) else {
            return
        }
        
        var uiImage = UIImage(cgImage: cgImage)
        
        // 리사이즈 처리
        if let maxW = maxWidth, let maxH = maxHeight {
            uiImage = resizeImage(image: uiImage, maxWidth: CGFloat(maxW), maxHeight: CGFloat(maxH))
        } else if let maxW = maxWidth {
            uiImage = resizeImage(image: uiImage, maxWidth: CGFloat(maxW), maxHeight: .greatestFiniteMagnitude)
        } else if let maxH = maxHeight {
            uiImage = resizeImage(image: uiImage, maxWidth: .greatestFiniteMagnitude, maxHeight: CGFloat(maxH))
        }
        
        // JPEG 압축
        guard let imageData = uiImage.jpegData(compressionQuality: jpegQuality) else {
            return
        }
        
        let base64 = imageData.base64EncodedString()
        
        DispatchQueue.main.async {
            self.sendEvent("onCameraFrame", [
                "type": "cameraFrame",
                "base64": "data:image/jpeg;base64,\(base64)",
                "width": Int(uiImage.size.width),
                "height": Int(uiImage.size.height),
                "frameNumber": self.frameCounter,
                "timestamp": Int64(Date().timeIntervalSince1970 * 1000)
            ])
        }
    }
    
    // 이미지 리사이즈 헬퍼
    private func resizeImage(image: UIImage, maxWidth: CGFloat, maxHeight: CGFloat) -> UIImage {
        let size = image.size
        
        let widthRatio = maxWidth / size.width
        let heightRatio = maxHeight / size.height
        let ratio = min(widthRatio, heightRatio, 1.0)
        
        if ratio >= 1.0 {
            return image
        }
        
        let newSize = CGSize(width: size.width * ratio, height: size.height * ratio)
        
        UIGraphicsBeginImageContextWithOptions(newSize, false, 1.0)
        image.draw(in: CGRect(origin: .zero, size: newSize))
        let resizedImage = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        
        return resizedImage ?? image
    }
}

// MARK: - Extensions

extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        return min(max(self, range.lowerBound), range.upperBound)
    }
}

// MARK: - Photo Capture Delegate

private class PhotoCaptureDelegate: NSObject, AVCapturePhotoCaptureDelegate {
    private let completion: (Result<[String: Any], Error>) -> Void
    
    init(completion: @escaping (Result<[String: Any], Error>) -> Void) {
        self.completion = completion
        super.init()
    }
    
    func photoOutput(_ output: AVCapturePhotoOutput, didFinishProcessingPhoto photo: AVCapturePhoto, error: Error?) {
        if let error = error {
            completion(.failure(error))
            return
        }
        
        guard let imageData = photo.fileDataRepresentation(),
              let image = UIImage(data: imageData),
              let jpegData = image.jpegData(compressionQuality: 0.9) else {
            completion(.failure(NSError(domain: "PhotoCapture", code: -1, userInfo: [NSLocalizedDescriptionKey: "Failed to process photo"])))
            return
        }
        
        let base64 = jpegData.base64EncodedString()
        
        completion(.success([
            "success": true,
            "base64": "data:image/jpeg;base64,\(base64)",
            "width": Int(image.size.width),
            "height": Int(image.size.height),
            "facing": "back" // TODO: Pass facing from parent
        ]))
    }
}
