import ExpoModulesCore
import AVFoundation

public class MicrophoneModule: Module {
    private var captureSession: AVCaptureSession?
    private var audioOutput: AVCaptureAudioDataOutput?
    private let audioQueue = DispatchQueue(label: "audio.processing.queue")
    private var isStreaming = false
    private var chunkNumber = 0
    
    // 설정 가능한 파라미터
    private var targetSampleRate: Double = 44100.0  // 44.1kHz (기본값)
    private var maxChunkSize: Int = 2048  // 약 23ms 지연 (실시간성과 성능의 균형)
    
    public func definition() -> ModuleDefinition {
        Name("Microphone")
        
        Events("onAudioChunk")
        
        OnCreate {
            // 모듈 초기화
        }
        
        OnDestroy {
            cleanup()
        }
        
        // 권한 확인
        AsyncFunction("checkMicrophonePermission") { (promise: Promise) in
            let micStatus = AVCaptureDevice.authorizationStatus(for: .audio)
            let micGranted = micStatus == .authorized
            
            promise.resolve([
                "granted": micGranted,
                "status": micGranted ? "granted" : "denied"
            ])
        }
        
        // 권한 요청
        AsyncFunction("requestMicrophonePermission") { (promise: Promise) in
            Task {
                let micGranted = await AVCaptureDevice.requestAccess(for: .audio)
                
                promise.resolve([
                    "granted": micGranted,
                    "status": micGranted ? "granted" : "denied"
                ])
            }
        }
        
        // 녹음 시작
        AsyncFunction("startRecording") { (params: [String: Any], promise: Promise) in
            if self.isStreaming {
                promise.resolve(["success": false, "error": "Already streaming"])
                return
            }
            
            // 파라미터 파싱
            if let sampleRate = params["sampleRate"] as? Double {
                self.targetSampleRate = sampleRate.clamped(to: 8000.0...48000.0)
            } else {
                self.targetSampleRate = 44100.0
            }
            
            if let chunkSize = params["chunkSize"] as? Int {
                self.maxChunkSize = chunkSize.clamped(to: 512...8192)
            } else {
                self.maxChunkSize = 2048
            }
            
            // 권한 확인
            let micStatus = AVCaptureDevice.authorizationStatus(for: .audio)
            if micStatus != .authorized {
                promise.resolve(["success": false, "error": "Microphone permission not granted"])
                return
            }
            
            do {
                // 캡처 세션 생성
                let session = AVCaptureSession()
                session.sessionPreset = .high
                
                // 마이크 디바이스 선택
                guard let audioDevice = AVCaptureDevice.default(for: .audio) else {
                    promise.resolve(["success": false, "error": "Audio device not available"])
                    return
                }
                
                let audioInput = try AVCaptureDeviceInput(device: audioDevice)
                guard session.canAddInput(audioInput) else {
                    promise.resolve(["success": false, "error": "Cannot add audio input"])
                    return
                }
                session.addInput(audioInput)
                
                // 오디오 출력 설정
                let output = AVCaptureAudioDataOutput()
                output.setSampleBufferDelegate(self, queue: self.audioQueue)
                
                guard session.canAddOutput(output) else {
                    promise.resolve(["success": false, "error": "Cannot add audio output"])
                    return
                }
                session.addOutput(output)
                
                self.captureSession = session
                self.audioOutput = output
                self.chunkNumber = 0
                
                // 세션 시작
                session.startRunning()
                self.isStreaming = true
                
                promise.resolve(["success": true])
            } catch {
                self.cleanup()
                promise.resolve(["success": false, "error": error.localizedDescription])
            }
        }
        
        // 녹음 중지
        AsyncFunction("stopRecording") { (promise: Promise) in
            if !self.isStreaming {
                promise.resolve(["success": false, "error": "Not streaming"])
                return
            }
            
            self.cleanup()
            promise.resolve(["success": true])
        }
        
        // 마이크 상태 조회
        AsyncFunction("getMicrophoneStatus") { (promise: Promise) in
            promise.resolve([
                "isStreaming": self.isStreaming,
                "hasMicrophone": true
            ])
        }
    }
    
    private func cleanup() {
        isStreaming = false
        captureSession?.stopRunning()
        captureSession = nil
        audioOutput = nil
        chunkNumber = 0
    }
}

// AVCaptureAudioDataOutputSampleBufferDelegate 구현
extension MicrophoneModule: AVCaptureAudioDataOutputSampleBufferDelegate {
    public func captureOutput(_ output: AVCaptureOutput, didOutput sampleBuffer: CMSampleBuffer, from connection: AVCaptureConnection) {
        guard isStreaming else { return }
        
        // CMSampleBuffer에서 오디오 데이터 추출
        guard let blockBuffer = CMSampleBufferGetDataBuffer(sampleBuffer) else { return }
        
        var length: Int = 0
        var dataPointer: UnsafeMutablePointer<Int8>?
        
        let status = CMBlockBufferGetDataPointer(blockBuffer, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &dataPointer)
        
        guard status == kCMBlockBufferNoErr, let pointer = dataPointer else { return }
        
        // 데이터를 Data로 변환
        let data = Data(bytes: pointer, count: length)
        let base64String = data.base64EncodedString()
        
        chunkNumber += 1
        
        // 오디오 포맷 정보 가져오기
        let formatDescription = CMSampleBufferGetFormatDescription(sampleBuffer)
        let audioStreamBasicDescription = CMAudioFormatDescriptionGetStreamBasicDescription(formatDescription!)
        let sampleRate = audioStreamBasicDescription?.pointee.mSampleRate ?? 44100.0
        
        // 이벤트 전송
        self.sendEvent("onAudioChunk", [
            "type": "audioChunk",
            "base64": base64String,
            "chunkSize": length,
            "chunkNumber": chunkNumber,
            "timestamp": Int64(Date().timeIntervalSince1970 * 1000),
            "sampleRate": Int(sampleRate),
            "encoding": "pcm_16bit"
        ])
    }
}

// Comparable extension for clamping values
extension Comparable {
    func clamped(to range: ClosedRange<Self>) -> Self {
        return min(max(self, range.lowerBound), range.upperBound)
    }
}
