/**
 * Camera View Component
 * Real-time camera preview for app-embedded camera control
 */

import { setCameraRef } from '@/lib/bridges/camera';
import { CameraType, CameraView } from 'expo-camera';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface CameraViewProps {
  visible: boolean;
  facing?: CameraType;
  onClose?: () => void;
}

export function AppCameraView({ visible, facing = 'back', onClose }: CameraViewProps) {
  const [cameraRefState, setCameraRefState] = useState<CameraView | null>(null);

  // Always set camera ref (even when not visible)
  useEffect(() => {
    if (cameraRefState) {
      setCameraRef(cameraRefState);
    }
    return () => {
      setCameraRef(null);
    };
  }, [cameraRefState]);

  // Render camera in background even when not visible
  return (
    <>
      {/* Hidden camera for ref initialization */}
      {!visible && (
        <View style={styles.hidden}>
          <CameraView
            ref={(ref) => setCameraRefState(ref)}
            style={styles.hiddenCamera}
            facing={facing}
          />
        </View>
      )}

      {/* Visible camera modal */}
      {visible && (
        <Modal
          visible={visible}
          transparent={false}
          animationType="slide"
          onRequestClose={onClose}
        >
          <View style={styles.container}>
            <CameraView
              ref={(ref) => setCameraRefState(ref)}
              style={styles.camera}
              facing={facing}
            />
            
            {onClose && (
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            )}
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    pointerEvents: 'none',
  },
  hiddenCamera: {
    width: 1,
    height: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});
